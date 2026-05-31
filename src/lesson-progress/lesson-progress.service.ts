import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateService } from '../certificates/certificates.service';
import { CompleteLessonDto } from './dto/complete-lesson.dto';

@Injectable()
export class LessonProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificateService: CertificateService,
  ) {}

  async toggleLessonWatched(tenantId: string, userId: string, lessonId: string) {
    return this.completeLesson(tenantId, userId, lessonId, {
      videoWatchedPercent: 100,
      taskSubmitted: true,
    });
  }

  async completeLesson(
    tenantId: string,
    userId: string,
    lessonId: string,
    dto: CompleteLessonDto,
  ) {
    const progress = await this.prisma.withTenant(tenantId, async (tx) => {
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, tenantId },
        select: {
          id: true,
          completionRequirement: true,
          requiredVideoPercent: true,
          progressWeight: true,
          module: { select: { courseId: true } },
        },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');

      const courseId = lesson.module.courseId;

      const enrollment = await tx.enrollment.findUnique({
        where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
        select: { id: true, paymentStatus: true },
      });
      if (!enrollment) throw new NotFoundException('Enrollment not found');
      if (!['FREE', 'PAID'].includes(enrollment.paymentStatus)) {
        throw new BadRequestException('Payment is not confirmed for this course');
      }

      this.assertCompletionAllowed(lesson, dto);

      const lessonProgress = await tx.lessonProgress.upsert({
        where: { tenantId_userId_lessonId: { tenantId, userId, lessonId } },
        create: {
          tenantId,
          userId,
          lessonId,
          isWatched: true,
          videoWatchedPercent: dto.videoWatchedPercent ?? 0,
          taskSubmittedAt: dto.taskSubmitted ? new Date() : null,
          evidenceUrl: dto.evidenceUrl,
          completionNote: dto.completionNote,
          completedAt: new Date(),
        },
        update: {
          isWatched: true,
          videoWatchedPercent: dto.videoWatchedPercent ?? 0,
          taskSubmittedAt: dto.taskSubmitted ? new Date() : undefined,
          evidenceUrl: dto.evidenceUrl,
          completionNote: dto.completionNote,
          completedAt: new Date(),
        },
      });

      const lessons = await tx.lesson.findMany({
        where: {
          tenantId,
          module: { courseId },
        },
        select: { id: true, progressWeight: true },
      });

      const completedProgress = await tx.lessonProgress.findMany({
        where: {
          tenantId,
          userId,
          isWatched: true,
          completedAt: { not: null },
          lesson: { module: { courseId } },
        },
        select: { lessonId: true },
      });

      const completedLessonIds = new Set(
        completedProgress.map((item) => item.lessonId),
      );
      const totalWeight = lessons.reduce(
        (sum, item) => sum + item.progressWeight,
        0,
      );
      const completedWeight = lessons
        .filter((item) => completedLessonIds.has(item.id))
        .reduce((sum, item) => sum + item.progressWeight, 0);
      const progressPercentage =
        totalWeight === 0 ? 0 : Math.floor((completedWeight / totalWeight) * 100);

      const enrollmentProgress = await tx.enrollment.update({
        where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
        data: {
          progressPercentage,
          isCompleted: progressPercentage === 100,
        },
      });

      return { lessonProgress, enrollment: enrollmentProgress, courseId };
    });

    const certificate =
      progress.enrollment.progressPercentage === 100
        ? await this.certificateService.generateCertificateIfComplete(
            tenantId,
            userId,
            progress.courseId,
          )
        : { generated: false, certificate: null };

    return { ...progress, certificate };
  }

  private assertCompletionAllowed(
    lesson: {
      completionRequirement: string;
      requiredVideoPercent: number;
    },
    dto: CompleteLessonDto,
  ) {
    if (
      lesson.completionRequirement === 'VIDEO_WATCHED' &&
      (dto.videoWatchedPercent ?? 0) < lesson.requiredVideoPercent
    ) {
      throw new BadRequestException(
        `Video must be watched at least ${lesson.requiredVideoPercent}%`,
      );
    }

    if (
      lesson.completionRequirement === 'TASK_SUBMITTED' &&
      !dto.taskSubmitted &&
      !dto.evidenceUrl
    ) {
      throw new BadRequestException('Task submission is required');
    }

    if (lesson.completionRequirement === 'MANUAL_CONFIRMATION') {
      throw new BadRequestException(
        'This lesson requires instructor confirmation',
      );
    }

    if (
      lesson.completionRequirement === 'ANY' &&
      (dto.videoWatchedPercent ?? 0) <= 0 &&
      !dto.taskSubmitted &&
      !dto.evidenceUrl
    ) {
      throw new BadRequestException(
        'At least one completion action is required',
      );
    }
  }
}
