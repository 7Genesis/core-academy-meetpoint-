import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateModuleDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const course = await tx.course.findFirst({
        where: { id: dto.courseId, tenantId },
        select: { id: true },
      });
      if (!course) throw new NotFoundException('Course not found');

      return tx.module.create({
        data: {
          title: dto.title,
          order: dto.order,
          tenantId,
          courseId: dto.courseId,
        },
      });
    });
  }
}
