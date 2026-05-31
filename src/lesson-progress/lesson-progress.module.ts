import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { LessonProgressService } from './lesson-progress.service';

@Module({
  imports: [CertificatesModule],
  providers: [LessonProgressService],
  exports: [LessonProgressService],
})
export class LessonProgressModule {}
