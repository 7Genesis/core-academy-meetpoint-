import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificateService } from './certificates.service';

@Module({
  controllers: [CertificatesController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificatesModule {}
