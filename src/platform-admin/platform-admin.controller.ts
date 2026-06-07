import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PlatformWide } from '../common/decorators/platform-wide.decorator';
import {
  PlatformPermission,
  type SupportTicketStatus,
} from '../common/prisma-enums';
import { BlockUserDto } from './dto/block-user.dto';
import { CreatePlatformFeePayoutDto } from './dto/create-platform-fee-payout.dto';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdatePlatformStaffPermissionsDto } from './dto/update-platform-staff-permissions.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformPermissions } from './platform-permissions.decorator';
import { PlatformAdminService } from './platform-admin.service';

type PlatformRequest = Request & {
  user: {
    sub: string;
    email: string;
    platformRole?: string;
  };
  platformStaff?: { id: string };
};

type DirectoryType = 'companies' | 'students' | 'teachers';

@PlatformWide()
@UseGuards(PlatformAdminGuard)
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('dashboard')
  @PlatformPermissions(PlatformPermission.PAYMENTS_READ)
  dashboard() {
    return this.platformAdminService.dashboard();
  }

  @Get('directory')
  @PlatformPermissions(PlatformPermission.USERS_WRITE)
  directory(
    @Query('type') type: DirectoryType = 'companies',
    @Query('search') search = '',
  ) {
    return this.platformAdminService.listDirectory(type, search);
  }

  @Get('staff')
  @PlatformPermissions(PlatformPermission.MAINTENANCE_WRITE)
  listStaff() {
    return this.platformAdminService.listStaff();
  }

  @Get('platform-fee-payouts')
  @PlatformPermissions(PlatformPermission.PAYMENTS_READ)
  listPlatformFeePayouts() {
    return this.platformAdminService.listPlatformFeePayouts();
  }

  @Post('platform-fee-payouts')
  @PlatformPermissions(PlatformPermission.MAINTENANCE_WRITE)
  createPlatformFeePayout(
    @Req() request: PlatformRequest,
    @Body() dto: CreatePlatformFeePayoutDto,
  ) {
    return this.platformAdminService.createPlatformFeePayout(
      dto,
      getActorStaffId(request),
    );
  }

  @Post('staff')
  @PlatformPermissions(PlatformPermission.MAINTENANCE_WRITE)
  createStaff(@Req() request: PlatformRequest, @Body() dto: CreatePlatformStaffDto) {
    return this.platformAdminService.createStaff(dto, getActorStaffId(request));
  }

  @Patch('staff/:id/permissions')
  @PlatformPermissions(PlatformPermission.MAINTENANCE_WRITE)
  updateStaffPermissions(
    @Req() request: PlatformRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformStaffPermissionsDto,
  ) {
    return this.platformAdminService.updateStaffPermissions(
      id,
      dto,
      getActorStaffId(request),
    );
  }

  @Get('tickets')
  @PlatformPermissions(PlatformPermission.SUPPORT_WRITE)
  listTickets(@Query('status') status?: SupportTicketStatus) {
    return this.platformAdminService.listTickets(status);
  }

  @Post('tickets')
  @PlatformPermissions(PlatformPermission.SUPPORT_WRITE)
  createTicket(@Body() dto: CreateSupportTicketDto) {
    return this.platformAdminService.createTicket(dto);
  }

  @Patch('tickets/:id/assume')
  @PlatformPermissions(PlatformPermission.SUPPORT_WRITE)
  assumeTicket(@Req() request: PlatformRequest, @Param('id') id: string) {
    return this.platformAdminService.assumeTicket(id, getActorStaffId(request));
  }

  @Patch('tickets/:id/status')
  @PlatformPermissions(PlatformPermission.SUPPORT_WRITE)
  updateTicketStatus(
    @Req() request: PlatformRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketStatusDto,
  ) {
    return this.platformAdminService.updateTicketStatus(
      id,
      dto,
      getActorStaffId(request),
    );
  }

  @Patch('users/:id/block')
  @PlatformPermissions(PlatformPermission.USERS_WRITE)
  blockUser(
    @Req() request: PlatformRequest,
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.platformAdminService.blockUser(id, dto, getActorStaffId(request));
  }

  @Patch('users/:id/unblock')
  @PlatformPermissions(PlatformPermission.USERS_WRITE)
  unblockUser(@Req() request: PlatformRequest, @Param('id') id: string) {
    return this.platformAdminService.unblockUser(id, getActorStaffId(request));
  }
}

function getActorStaffId(request: PlatformRequest) {
  return request.platformStaff?.id ?? request.user.sub;
}
