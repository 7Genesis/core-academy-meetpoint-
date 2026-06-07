import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.subscriptionsService.listActivePlans();
  }

  @Get('me')
  me(@Req() request: Request & { user?: JwtPayload }) {
    return this.subscriptionsService.getCurrentSubscription(request.user!.sub);
  }

  @Post('checkout-intent')
  checkoutIntent(
    @Body() dto: { planId: string; paymentProvider?: string; billingCycle?: string },
    @Req() request: Request & { user?: JwtPayload },
  ) {
    return this.subscriptionsService.createCheckoutIntent(request.user!.sub, dto);
  }

  @Public()
  @Post('provider-webhook')
  providerWebhook(
    @Headers('x-subscription-signature') signature: string | undefined,
    @Headers('x-subscription-timestamp') timestamp: string | undefined,
    @Headers('x-subscription-event-id') eventId: string | undefined,
    @Body()
    dto: {
      userId: string;
      planId: string;
      externalSubscriptionId: string;
      eventType: string;
      status: 'PENDING_PAYMENT' | 'PAYMENT_PROCESSING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
    },
    @Req() request: RawBodyRequest<Request>,
  ) {
    const rawPayload =
      request.rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? {});
    return this.subscriptionsService.processProviderWebhook(
      dto,
      { signature, timestamp, eventId },
      rawPayload,
    );
  }
}
