import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesRealtimeService } from './courses-realtime.service';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController],
  providers: [CoursesRealtimeService, CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
