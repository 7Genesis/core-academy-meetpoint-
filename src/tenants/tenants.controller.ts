import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantsService } from './tenants.service';

type TenantRequest = Request & { tenantId: string };

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  current(@Req() request: TenantRequest) {
    return this.tenantsService.findCurrent(request.tenantId);
  }
}
