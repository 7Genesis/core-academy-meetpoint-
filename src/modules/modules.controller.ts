import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { RequireActiveSubscription } from '../common/decorators/require-active-subscription.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateModuleDto } from './dto/create-module.dto';
import { ModulesService } from './modules.service';

type TenantRequest = Request & { tenantId: string };

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Roles('ADMIN')
  @RequireActiveSubscription()
  @Post()
  create(@Req() request: TenantRequest, @Body() dto: CreateModuleDto) {
    return this.modulesService.create(request.tenantId, dto);
  }
}
