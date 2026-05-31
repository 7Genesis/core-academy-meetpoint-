import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CompleteLessonDto } from '../lesson-progress/dto/complete-lesson.dto';
import { LessonProgressService } from '../lesson-progress/lesson-progress.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { LessonsService } from './lessons.service';

type TenantRequest = Request & { tenantId: string };

@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly lessonProgressService: LessonProgressService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Req() request: TenantRequest, @Body() dto: CreateLessonDto) {
    return this.lessonsService.create(request.tenantId, dto);
  }

  @Patch(':id/progress/toggle')
  toggleWatched(
    @Req() request: TenantRequest,
    @CurrentUser() user: { sub: string },
    @Param('id') lessonId: string,
  ) {
    return this.lessonProgressService.toggleLessonWatched(
      request.tenantId,
      user.sub,
      lessonId,
    );
  }

  @Patch(':id/progress/complete')
  completeLesson(
    @Req() request: TenantRequest,
    @CurrentUser() user: { sub: string },
    @Param('id') lessonId: string,
    @Body() dto: CompleteLessonDto,
  ) {
    return this.lessonProgressService.completeLesson(
      request.tenantId,
      user.sub,
      lessonId,
      dto,
    );
  }
}
