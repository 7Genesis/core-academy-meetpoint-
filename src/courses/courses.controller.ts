import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RequireActiveSubscription } from '../common/decorators/require-active-subscription.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { CoursesService } from './courses.service';

type TenantRequest = Request & { tenantId: string };

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Roles('ADMIN')
  @RequireActiveSubscription()
  @Post()
  create(@Req() request: TenantRequest, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(request.tenantId, dto);
  }

  @Public()
  @Get()
  findAll(@Query() query: ListCoursesQueryDto) {
    return this.coursesService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }
}
