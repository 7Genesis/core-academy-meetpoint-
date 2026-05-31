import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateLessonDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const module = await tx.module.findFirst({
        where: { id: dto.moduleId, tenantId },
        select: { id: true },
      });
      if (!module) throw new NotFoundException('Module not found');

      return tx.lesson.create({
        data: {
          title: dto.title,
          order: dto.order,
          videoUrl: dto.videoUrl,
          attachmentUrl: dto.attachmentUrl,
          completionRequirement: dto.completionRequirement ?? 'VIDEO_WATCHED',
          requiredVideoPercent: dto.requiredVideoPercent ?? 80,
          progressWeight: dto.progressWeight ?? 1,
          moduleId: dto.moduleId,
          tenantId,
        },
      });
    });
  }
}
