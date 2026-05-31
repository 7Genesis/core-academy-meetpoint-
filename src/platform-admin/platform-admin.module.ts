import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminGuard, PlatformAdminService],
})
export class PlatformAdminModule {}
