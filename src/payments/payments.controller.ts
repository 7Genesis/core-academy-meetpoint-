import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { RequireActiveSubscription } from '../common/decorators/require-active-subscription.decorator';
import { CreateCourseCheckoutDto } from './dto/create-course-checkout.dto';
import { PaymentsService } from './payments.service';

type TenantRequest = Request & { tenantId: string };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('course-checkout')
  @RequireActiveSubscription()
  createCourseCheckout(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseCheckoutDto,
  ) {
    return this.paymentsService.createCourseCheckout(
      request.tenantId,
      user,
      dto,
    );
  }
}
