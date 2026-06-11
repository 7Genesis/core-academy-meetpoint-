import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CertificateService } from './certificates.service';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificateService: CertificateService) {}

  @Public()
  @Get(':verificationCode')
  verify(@Param('verificationCode') verificationCode: string) {
    return this.certificateService.verify(verificationCode);
  }
}
