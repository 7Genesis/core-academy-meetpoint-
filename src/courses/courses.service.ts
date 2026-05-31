import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateCourseDto) {
    return this.prisma.withTenant(tenantId, (tx) => {
      return tx.course.create({
        data: {
          ...dto,
          currency: dto.currency ?? 'BRL',
          platformFeeBps: dto.platformFeeBps ?? 1000,
          tenantId,
        },
      });
    });
  }

  findAll(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => {
      return tx.course.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async findOne(tenantId: string, id: string) {
    const course = await this.prisma.withTenant(tenantId, (tx) => {
      return tx.course.findFirst({
        where: { id, tenantId },
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: { lessons: { orderBy: { order: 'asc' } } },
          },
        },
      });
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }
}
