import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EnrollmentPaymentStatus,
  type EnrollmentPaymentStatus as EnrollmentPaymentStatusType,
} from '../common/prisma-enums';
import { DataMaskingService } from '../common/security/data-masking.service';
import { FieldEncryptionService } from '../common/security/field-encryption.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

const INFINITEPAY_GATEWAY = 'infinitepay';

type InfinitePayWebhookEvent = {
  amount?: number | string;
  capture_method?: string;
  invoice_slug?: string;
  installments?: number | string;
  items?: unknown;
  order_nsu?: string;
  paid_amount?: number | string;
  receipt_url?: string;
  transaction_nsu?: string;
};

type InfinitePayPaymentCheckResponse = {
  success?: boolean;
  paid?: boolean;
  amount?: number | string;
  paid_amount?: number | string;
  capture_method?: string;
};

type PaymentEventData = {
  amountCents: number;
  courseId: string;
  customerEmail?: string;
  eventId: string;
  eventType: string;
  gatewayPaymentId: string;
  orderNsu: string;
  paymentStatus: EnrollmentPaymentStatusType;
  receiptUrl?: string;
  tenantId: string;
  userId: string;
};

@Injectable()
export class WebhooksService {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly prisma: PrismaService,
    private readonly dataMasking: DataMaskingService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  async handleInfinitePayEvent(rawBody: Buffer | undefined, parsedBody: unknown) {
    const event = this.parseInfinitePayEvent(rawBody, parsedBody);
    const orderNsu = event.order_nsu?.trim();
    const transactionNsu = event.transaction_nsu?.trim();
    const invoiceSlug = event.invoice_slug?.trim();

    if (!orderNsu || !transactionNsu) {
      throw new BadRequestException(
        'InfinitePay order_nsu and transaction_nsu are required',
      );
    }

    const checkout = await this.prisma.withPlatformAdmin((tx) =>
      tx.paymentCheckout.findUnique({
        where: { orderNsu },
        select: {
          id: true,
          tenantId: true,
          userId: true,
          courseId: true,
          amountCents: true,
          status: true,
        },
      }),
    );
    if (!checkout) {
      throw new BadRequestException('Unknown InfinitePay order_nsu');
    }

    const amountCents = normalizeAmountCents(event.amount);
    if (amountCents !== checkout.amountCents) {
      throw new BadRequestException('InfinitePay amount does not match checkout');
    }

    await this.verifyInfinitePayPayment({
      amountCents,
      invoiceSlug,
      orderNsu,
      transactionNsu,
    });

    const payment: PaymentEventData = {
      amountCents,
      courseId: checkout.courseId,
      eventId: transactionNsu,
      eventType: 'payment.approved',
      gatewayPaymentId: transactionNsu,
      orderNsu,
      paymentStatus: EnrollmentPaymentStatus.PAID,
      receiptUrl: event.receipt_url,
      tenantId: checkout.tenantId,
      userId: checkout.userId,
    };

    const ledger = await this.registerWebhookEvent(payment.eventId, event, payment);

    if (ledger.duplicate) {
      return {
        ok: true,
        duplicate: true,
        eventId: payment.eventId,
        orderNsu,
      };
    }

    try {
      await this.prisma.withPlatformAdmin((tx) =>
        tx.paymentCheckout.update({
          where: { id: checkout.id },
          data: {
            status: EnrollmentPaymentStatus.PAID,
            transactionNsu,
            receiptUrl: event.receipt_url,
            paidAt: new Date(),
            payload: this.dataMasking.redactObject(event) as Prisma.InputJsonValue,
          },
        }),
      );

      const enrollment = await this.enrollmentsService.createFromPurchase(
        payment.tenantId,
        payment.userId,
        payment.courseId,
        {
          gateway: INFINITEPAY_GATEWAY,
          gatewayPaymentId: payment.gatewayPaymentId,
          amountCents: payment.amountCents,
          paymentStatus: payment.paymentStatus,
        },
      );

      await this.markWebhookEventProcessed(payment.eventId, 'PROCESSED');
      return {
        ok: true,
        eventId: payment.eventId,
        orderNsu,
        enrollment,
      };
    } catch (error) {
      await this.markWebhookEventFailed(
        payment.eventId,
        error instanceof Error ? error.message : 'Unknown webhook processing error',
      );
      throw error;
    }
  }

  private parseInfinitePayEvent(
    rawBody: Buffer | undefined,
    parsedBody: unknown,
  ): InfinitePayWebhookEvent {
    if (parsedBody && typeof parsedBody === 'object') {
      return parsedBody as InfinitePayWebhookEvent;
    }

    if (!rawBody) {
      throw new BadRequestException('Raw webhook body is required');
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as InfinitePayWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid InfinitePay webhook JSON');
    }
  }

  private async verifyInfinitePayPayment(params: {
    amountCents: number;
    invoiceSlug?: string;
    orderNsu: string;
    transactionNsu: string;
  }) {
    const handle = process.env.INFINITEPAY_HANDLE?.trim().replace(/^\$/, '');
    if (!handle) {
      throw new BadRequestException('INFINITEPAY_HANDLE is required for webhook verification');
    }
    if (!params.invoiceSlug) {
      throw new BadRequestException('InfinitePay invoice_slug is required');
    }

    const endpoint =
      process.env.INFINITEPAY_PAYMENT_CHECK_ENDPOINT ??
      'https://api.checkout.infinitepay.io/payment_check';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu: params.orderNsu,
        transaction_nsu: params.transactionNsu,
        slug: params.invoiceSlug,
      }),
    });
    const paymentCheck =
      await parseJsonResponse<InfinitePayPaymentCheckResponse>(response);

    if (!response.ok || !paymentCheck.success || !paymentCheck.paid) {
      throw new BadRequestException({
        message: 'InfinitePay payment_check did not confirm payment',
        status: response.status,
        response: paymentCheck,
      });
    }

    const confirmedAmount = normalizeAmountCents(paymentCheck.amount);
    if (confirmedAmount !== params.amountCents) {
      throw new BadRequestException('InfinitePay confirmed amount does not match checkout');
    }
  }

  private async registerWebhookEvent(
    eventId: string,
    event: InfinitePayWebhookEvent,
    payment: PaymentEventData,
  ) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const existing = await tx.paymentWebhookEvent.findUnique({
        where: {
          gateway_gatewayEventId: {
            gateway: INFINITEPAY_GATEWAY,
            gatewayEventId: eventId,
          },
        },
      });
      if (existing?.processedAt) return { duplicate: true };
      if (existing) return { duplicate: false };

      await tx.paymentWebhookEvent.create({
        data: {
          gateway: INFINITEPAY_GATEWAY,
          gatewayEventId: eventId,
          eventType: payment.eventType,
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
            gateway: INFINITEPAY_GATEWAY,
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
            gateway: INFINITEPAY_GATEWAY,
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
}

function normalizeAmountCents(value: number | string | undefined) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new BadRequestException('InfinitePay amount must be an integer in cents');
  }
  return amount;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { raw: text } as T;
  }
}
