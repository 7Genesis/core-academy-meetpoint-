import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { LessonProgressModule } from '../lesson-progress/lesson-progress.module';

@Module({
  imports: [LessonProgressModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
