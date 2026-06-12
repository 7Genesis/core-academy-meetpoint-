import {
  ForbiddenException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { ContentVisibility, Prisma, UserRole } from '@prisma/client';
import { interval, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesRealtimeService } from './courses-realtime.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesRealtime: CoursesRealtimeService,
  ) {}

  async create(tenantId: string, creatorUserId: string, dto: CreateCourseDto) {
    const course = await this.prisma.withTenant(tenantId, (tx) => {
      return tx.course.create({
        data: {
          ...dto,
          creatorUserId,
          currency: dto.currency ?? 'BRL',
          platformFeeBps: dto.platformFeeBps ?? 1000,
          visibility: ContentVisibility.PUBLIC,
          tenantId,
        },
        include: this.courseCatalogInclude(),
      });
    });
    this.coursesRealtime.publish({ kind: 'course.created', course });
    return course;
  }

  async findAll(query: ListCoursesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const search = query.search?.trim();
    const topic = query.topic?.trim();
    const where: Prisma.CourseWhereInput = {
      visibility: ContentVisibility.PUBLIC,
      ...(topic ? { topic: { equals: topic, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { instructorName: { contains: search, mode: 'insensitive' } },
              { linkedCompanyName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.withPlatformAdmin((tx) =>
      Promise.all([
        tx.course.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: this.courseCatalogInclude(),
        }),
        tx.course.count({ where }),
      ]),
    );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const course = await this.prisma.withPlatformAdmin((tx) =>
      tx.course.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true },
          },
          modules: {
            orderBy: { order: 'asc' },
            include: {
              lessons: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      }),
    );

    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  streamCatalog(): Observable<MessageEvent> {
    return merge(
      this.coursesRealtime.stream().pipe(
        map((event) => ({
          id:
            event.kind === 'course.deleted'
              ? event.courseId
              : String(event.course.id ?? ''),
          data: event,
        })),
      ),
      interval(25_000).pipe(
        map(() => ({
          data: {
            kind: 'keepalive',
            at: new Date().toISOString(),
          },
        })),
      ),
    );
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    this.assertOwnerOrAdmin(course.creatorUserId, user);

    const updated = await this.prisma.course.update({
      where: { id },
      data: dto,
      include: this.courseCatalogInclude(),
    });
    if (updated.visibility === ContentVisibility.PUBLIC) {
      this.coursesRealtime.publish({ kind: 'course.updated', course: updated });
    }
    return updated;
  }

  async delete(id: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    this.assertOwnerOrAdmin(course.creatorUserId, user);
    await this.prisma.course.delete({ where: { id } });
    this.coursesRealtime.publish({ kind: 'course.deleted', courseId: id });
    return { deleted: true };
  }

  private courseCatalogInclude() {
    return {
      tenant: {
        select: { id: true, name: true, subdomain: true },
      },
    } satisfies Prisma.CourseInclude;
  }

  private assertOwnerOrAdmin(ownerId: string | null, user: AuthenticatedUser) {
    if (
      ownerId === user.sub ||
      user.role === UserRole.ADMIN ||
      Boolean(user.platformRole)
    ) {
      return;
    }
    throw new ForbiddenException('Only the owner or an admin can change this course');
  }
}
