import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { CoursesService } from './courses.service';

type TenantRequest = Request & { tenantId: string };

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Req() request: TenantRequest, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(request.tenantId, dto);
  }

  @Get()
  findAll(@Req() request: TenantRequest) {
    return this.coursesService.findAll(request.tenantId);
  }

  @Get(':id')
  findOne(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.coursesService.findOne(request.tenantId, id);
  }
}
