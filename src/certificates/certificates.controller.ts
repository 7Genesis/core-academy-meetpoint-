import { Controller, Get, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { CertificateService } from './certificates.service';

type TenantRequest = Request & { tenantId: string };

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get(':verificationCode')
  verify(
    @Req() request: TenantRequest,
    @Param('verificationCode') verificationCode: string,
  ) {
    return this.certificateService.verify(request.tenantId, verificationCode);
  }
}
