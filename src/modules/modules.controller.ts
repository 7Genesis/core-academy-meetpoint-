import { Body, Controller, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateModuleDto } from './dto/create-module.dto';
import { ModulesService } from './modules.service';

type TenantRequest = Request & { tenantId: string };

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Req() request: TenantRequest, @Body() dto: CreateModuleDto) {
    return this.modulesService.create(request.tenantId, dto);
  }
}
