import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentVisibility, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, creatorUserId: string, dto: CreateCourseDto) {
    return this.prisma.withTenant(tenantId, (tx) => {
      return tx.course.create({
        data: {
          ...dto,
          creatorUserId,
          currency: dto.currency ?? 'BRL',
          platformFeeBps: dto.platformFeeBps ?? 1000,
          visibility: ContentVisibility.PUBLIC,
          tenantId,
        },
      });
    });
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
          include: {
            tenant: {
              select: { id: true, name: true, subdomain: true },
            },
          },
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

  async update(id: string, user: AuthenticatedUser, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    this.assertOwnerOrAdmin(course.creatorUserId, user);

    return this.prisma.course.update({
      where: { id },
      data: dto,
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
    });
  }

  async delete(id: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    this.assertOwnerOrAdmin(course.creatorUserId, user);
    await this.prisma.course.delete({ where: { id } });
    return { deleted: true };
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
