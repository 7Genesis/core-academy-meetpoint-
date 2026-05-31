import {
  Body,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { EnrollmentPaymentStatus } from '@prisma/client';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PurchaseWebhookDto } from './dto/purchase-webhook.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Public()
  @Post('purchase-confirmed')
  async purchaseConfirmed(
    @Headers('x-webhook-secret') webhookSecret: string | undefined,
    @Body() dto: PurchaseWebhookDto,
  ) {
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (
      !expectedSecret ||
      !webhookSecret ||
      !timingSafeStringEqual(webhookSecret, expectedSecret)
    ) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const user = await this.prisma.withTenant(dto.tenantId, (tx) => {
      return tx.user.findFirst({
        where: { tenantId: dto.tenantId, email: dto.customerEmail },
        select: { id: true },
      });
    });

    if (!user) {
      throw new UnauthorizedException('Webhook user provisioning is not enabled');
    }

    const enrollment = await this.enrollmentsService.createFromPurchase(
      dto.tenantId,
      user.id,
      dto.courseId,
      {
        gateway: dto.gateway,
        gatewayPaymentId: dto.gatewayPaymentId,
        amountCents: dto.amountCents,
        paymentStatus: dto.paymentStatus ?? EnrollmentPaymentStatus.PAID,
      },
    );

    return {
      ok: true,
      gatewayPaymentId: dto.gatewayPaymentId,
      enrollment,
    };
  }

  @Public()
  @Post('stripe')
  stripeWebhook(
    @Headers('stripe-signature') stripeSignature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    return this.webhooksService.handleStripeEvent(
      stripeSignature,
      request.rawBody,
      request.body,
    );
  }
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
