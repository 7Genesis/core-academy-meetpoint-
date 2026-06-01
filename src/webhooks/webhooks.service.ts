import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EnrollmentPaymentStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DataMaskingService } from '../common/security/data-masking.service';
import { FieldEncryptionService } from '../common/security/field-encryption.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: StripePaymentObject;
  };
};

type StripePaymentObject = {
  id?: string;
  amount?: number;
  amount_received?: number;
  amount_total?: number;
  customer_details?: { email?: string };
  metadata?: Record<string, string | undefined>;
  payment_intent?: string | { id?: string };
  receipt_email?: string;
};

type PaymentEventData = {
  amountCents: number;
  courseId?: string;
  customerEmail?: string;
  gatewayPaymentId: string;
  paymentStatus?: EnrollmentPaymentStatus;
  tenantId?: string;
  userId?: string;
};

@Injectable()
export class WebhooksService {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly prisma: PrismaService,
    private readonly dataMasking: DataMaskingService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  async handleStripeEvent(
    signatureHeader: string | undefined,
    rawBody: Buffer | undefined,
    parsedBody: unknown,
  ) {
    if (!rawBody) {
      throw new BadRequestException('Raw webhook body is required');
    }

    this.assertStripeSignature(signatureHeader, rawBody);

    const event = this.parseStripeEvent(rawBody, parsedBody);
    const eventId = event.id;
    const eventType = event.type;
    if (!eventId || !eventType) {
      throw new BadRequestException('Stripe event id and type are required');
    }

    const payment = this.extractPaymentData(event);
    const ledger = await this.registerWebhookEvent(
      eventId,
      eventType,
      event,
      payment,
    );

    if (ledger.duplicate) {
      return { ok: true, duplicate: true, eventId, eventType };
    }

    if (!payment.paymentStatus) {
      await this.markWebhookEventProcessed(eventId, 'IGNORED');
      return { ok: true, ignored: true, eventId, eventType };
    }

    if (!payment.tenantId || !payment.courseId) {
      await this.markWebhookEventFailed(
        eventId,
        'tenantId and courseId metadata are required',
      );
      throw new BadRequestException('tenantId and courseId metadata are required');
    }

    const userId =
      payment.userId ??
      (await this.findUserIdByEmail(payment.tenantId, payment.customerEmail));
    if (!userId) {
      await this.markWebhookEventFailed(
        eventId,
        'userId metadata or customer email matching an existing user is required',
      );
      throw new BadRequestException(
        'userId metadata or existing customer email is required',
      );
    }

    try {
      const enrollment = await this.enrollmentsService.createFromPurchase(
        payment.tenantId,
        userId,
        payment.courseId,
        {
          gateway: 'stripe',
          gatewayPaymentId: payment.gatewayPaymentId,
          amountCents: payment.amountCents,
          paymentStatus: payment.paymentStatus,
        },
      );

      await this.markWebhookEventProcessed(eventId, 'PROCESSED');
      return { ok: true, eventId, eventType, enrollment };
    } catch (error) {
      await this.markWebhookEventFailed(
        eventId,
        error instanceof Error ? error.message : 'Unknown webhook processing error',
      );
      throw error;
    }
  }

  private assertStripeSignature(
    signatureHeader: string | undefined,
    rawBody: Buffer,
  ) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new UnauthorizedException('STRIPE_WEBHOOK_SECRET is required');
    }
    if (!signatureHeader) {
      throw new UnauthorizedException('Missing Stripe signature');
    }

    const parts = new Map(
      signatureHeader.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key, value];
      }),
    );
    const timestamp = parts.get('t');
    const signatures = signatureHeader
      .split(',')
      .filter((part) => part.startsWith('v1='))
      .map((part) => part.slice(3));

    if (!timestamp || signatures.length === 0) {
      throw new UnauthorizedException('Invalid Stripe signature header');
    }

    const toleranceSeconds = Number(
      process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS ?? 300,
    );
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
      throw new UnauthorizedException('Stripe webhook timestamp is outside tolerance');
    }

    const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const isValid = signatures.some((signature) => {
      const signatureBuffer = Buffer.from(signature, 'hex');
      return (
        signatureBuffer.length === expectedBuffer.length &&
        timingSafeEqual(signatureBuffer, expectedBuffer)
      );
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
  }

  private parseStripeEvent(
    rawBody: Buffer,
    parsedBody: unknown,
  ): StripeWebhookEvent {
    if (parsedBody && typeof parsedBody === 'object') {
      return parsedBody as StripeWebhookEvent;
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as StripeWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid Stripe webhook JSON');
    }
  }

  private extractPaymentData(event: StripeWebhookEvent): PaymentEventData {
    const stripeObject = event.data?.object ?? {};
    const metadata = stripeObject.metadata ?? {};
    const paymentIntentId =
      typeof stripeObject.payment_intent === 'string'
        ? stripeObject.payment_intent
        : stripeObject.payment_intent?.id;
    const gatewayPaymentId = paymentIntentId ?? stripeObject.id;
    if (!gatewayPaymentId) {
      throw new BadRequestException('Stripe payment id is required');
    }

    return {
      tenantId: metadata.tenantId,
      userId: metadata.userId,
      courseId: metadata.courseId,
      customerEmail:
        stripeObject.customer_details?.email ??
        stripeObject.receipt_email ??
        metadata.customerEmail,
      gatewayPaymentId,
      amountCents: Number(
        stripeObject.amount_total ??
          stripeObject.amount_received ??
          stripeObject.amount ??
          metadata.amountCents ??
          0,
      ),
      paymentStatus: this.mapStripeEventToPaymentStatus(event.type),
    };
  }

  private mapStripeEventToPaymentStatus(eventType?: string) {
    if (
      eventType === 'checkout.session.completed' ||
      eventType === 'payment_intent.succeeded'
    ) {
      return EnrollmentPaymentStatus.PAID;
    }
    if (
      eventType === 'checkout.session.async_payment_failed' ||
      eventType === 'payment_intent.payment_failed'
    ) {
      return EnrollmentPaymentStatus.FAILED;
    }
    if (eventType === 'charge.refunded') {
      return EnrollmentPaymentStatus.REFUNDED;
    }
    return undefined;
  }

  private async registerWebhookEvent(
    eventId: string,
    eventType: string,
    event: StripeWebhookEvent,
    payment: PaymentEventData,
  ) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const existing = await tx.paymentWebhookEvent.findUnique({
        where: {
          gateway_gatewayEventId: {
            gateway: 'stripe',
            gatewayEventId: eventId,
          },
        },
      });
      if (existing?.processedAt) return { duplicate: true };
      if (existing) return { duplicate: false };

      await tx.paymentWebhookEvent.create({
        data: {
          gateway: 'stripe',
          gatewayEventId: eventId,
          eventType,
          tenantId: payment.tenantId,
          userId: payment.userId,
          courseId: payment.courseId,
          gatewayPaymentId: payment.gatewayPaymentId,
          status: 'RECEIVED',
          payload: this.dataMasking.redactObject(event) as Prisma.InputJsonValue,
          payloadEncrypted: this.fieldEncryption.encryptString(
            JSON.stringify(this.dataMasking.redactObject(event)),
          ),
        },
      });

      return { duplicate: false };
    });
  }

  private markWebhookEventProcessed(eventId: string, status: string) {
    return this.prisma.withPlatformAdmin((tx) =>
      tx.paymentWebhookEvent.update({
        where: {
          gateway_gatewayEventId: {
            gateway: 'stripe',
            gatewayEventId: eventId,
          },
        },
        data: {
          status,
          processedAt: new Date(),
          errorMessage: null,
        },
      }),
    );
  }

  private markWebhookEventFailed(eventId: string, errorMessage: string) {
    return this.prisma.withPlatformAdmin((tx) =>
      tx.paymentWebhookEvent.update({
        where: {
          gateway_gatewayEventId: {
            gateway: 'stripe',
            gatewayEventId: eventId,
          },
        },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      }),
    );
  }

  private async findUserIdByEmail(tenantId: string, email?: string) {
    if (!email) return null;
    const emailHash = this.fieldEncryption.hashForLookup(email, 'email');
    const user = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findFirst({
        where: {
          tenantId,
          OR: [
            ...(emailHash ? [{ emailHash }] : []),
            { email },
          ],
        },
        select: { id: true },
      }),
    );
    return user?.id ?? null;
  }
}
