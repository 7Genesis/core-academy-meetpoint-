import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAdminBootstrapService } from './platform-admin-bootstrap.service';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminGuard, PlatformAdminService, PlatformAdminBootstrapService],
})
export class PlatformAdminModule {}
