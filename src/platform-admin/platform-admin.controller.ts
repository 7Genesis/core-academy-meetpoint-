import {
  Body,
  Controller,
  Delete,
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
import { CreateManagedAccountDto } from './dto/create-managed-account.dto';
import { CreatePlatformFeePayoutDto } from './dto/create-platform-fee-payout.dto';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ReplySupportTicketDto } from './dto/reply-support-ticket.dto';
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
type SubscriptionDirectoryStatus =
  | 'all'
  | 'active'
  | 'pending'
  | 'inactive'
  | 'expiring'
  | 'expired'
  | 'cancelled'
  | 'suspended';
type AccessDirectoryStatus =
  | 'all'
  | 'online'
  | 'recent'
  | 'idle'
  | 'never'
  | 'blocked';

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

  @Get('subscriptions')
  @PlatformPermissions(PlatformPermission.PAYMENTS_READ)
  listSubscriptions(
    @Query('status') status: SubscriptionDirectoryStatus = 'all',
    @Query('search') search = '',
    @Query('warningDays') warningDays = '7',
  ) {
    return this.platformAdminService.listSubscriptions({
      status,
      search,
      warningDays: Number(warningDays),
    });
  }

  @Get('accesses')
  @PlatformPermissions(PlatformPermission.USERS_WRITE)
  listAccesses(
    @Query('status') status: AccessDirectoryStatus = 'all',
    @Query('search') search = '',
    @Query('onlineMinutes') onlineMinutes = '5',
    @Query('recentHours') recentHours = '24',
  ) {
    return this.platformAdminService.listAccesses({
      status,
      search,
      onlineMinutes: Number(onlineMinutes),
      recentHours: Number(recentHours),
    });
  }

  @Get('accounts')
  @PlatformPermissions(PlatformPermission.USERS_WRITE)
  listManagedAccounts(@Query('search') search = '') {
    return this.platformAdminService.listManagedAccounts(search);
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

  @Post('accounts')
  @PlatformPermissions(PlatformPermission.COMPANIES_WRITE)
  createAccount(@Req() request: PlatformRequest, @Body() dto: CreateManagedAccountDto) {
    return this.platformAdminService.createManagedAccount(dto, getActorStaffId(request));
  }

  @Post('accounts/:id/resend-access')
  @PlatformPermissions(PlatformPermission.COMPANIES_WRITE)
  resendManagedAccountAccess(@Req() request: PlatformRequest, @Param('id') id: string) {
    return this.platformAdminService.resendManagedAccountAccess(id, getActorStaffId(request));
  }

  @Delete('accounts/:id')
  @PlatformPermissions(PlatformPermission.COMPANIES_WRITE)
  deleteManagedAccount(@Req() request: PlatformRequest, @Param('id') id: string) {
    return this.platformAdminService.deleteManagedAccount(id, getActorStaffId(request));
  }

  @Delete('companies/:id')
  @PlatformPermissions(PlatformPermission.COMPANIES_WRITE)
  deleteCompany(@Req() request: PlatformRequest, @Param('id') id: string) {
    return this.platformAdminService.deleteCompanyTenant(id, getActorStaffId(request));
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

  @Post('tickets/:id/reply')
  @PlatformPermissions(PlatformPermission.SUPPORT_WRITE)
  replyTicket(
    @Req() request: PlatformRequest,
    @Param('id') id: string,
    @Body() dto: ReplySupportTicketDto,
  ) {
    return this.platformAdminService.replyTicket(
      id,
      dto,
      getActorStaffId(request),
    );
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

  @Delete('users/:id')
  @PlatformPermissions(PlatformPermission.USERS_WRITE)
  deleteUser(@Req() request: PlatformRequest, @Param('id') id: string) {
    return this.platformAdminService.deleteUser(id, getActorStaffId(request));
  }
}

function getActorStaffId(request: PlatformRequest) {
  return request.platformStaff?.id ?? request.user.sub;
}
