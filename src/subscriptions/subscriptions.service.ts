import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type PlanRecord = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  billingCycle: string;
  features: unknown;
  isActive: boolean;
};

type CheckoutIntentDto = {
  planId: string;
  paymentProvider?: string;
  billingCycle?: string;
};

type SubscriptionWebhookDto = {
  userId: string;
  planId: string;
  externalSubscriptionId: string;
  eventType: string;
  status: 'PENDING_PAYMENT' | 'PAYMENT_PROCESSING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
};

type InfinitePaySubscriptionWebhookDto = {
  amount?: number | string;
  invoice_slug?: string;
  order_nsu?: string;
  paid_amount?: number | string;
  receipt_url?: string;
  transaction_nsu?: string;
};

export type InfinitePayLinkResponse = {
  id?: string;
  invoice_slug?: string;
  slug?: string;
  url?: string;
  checkout_url?: string;
  checkoutUrl?: string;
  payment_url?: string;
  link?: string;
  data?: InfinitePayLinkResponse;
};

type InfinitePayPaymentCheckResponse = {
  success?: boolean;
  paid?: boolean;
  amount?: number | string;
};

const fallbackPlans: PlanRecord[] = [
  {
    id: '00000000-0000-4000-8000-000000000049',
    name: 'PF Assinante',
    description: 'Acesso a comunidades, eventos, benefícios, feed e conteúdos selecionados.',
    price: 49.9,
    billingCycle: 'monthly',
    features: ['feed', 'opportunities', 'events', 'benefits', 'communities'],
    isActive: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000099',
    name: 'PJ Parceiro',
    description: 'Publicação de vagas, benefícios, conteúdos, cursos e presença em comunidades.',
    price: 99.9,
    billingCycle: 'monthly',
    features: ['jobs', 'benefits', 'courses', 'communities', 'events'],
    isActive: true,
  },
];

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActivePlans() {
    try {
      const plans = await (this.prisma as unknown as {
        subscriptionPlan?: {
          findMany: (args: unknown) => Promise<PlanRecord[]>;
        };
      }).subscriptionPlan?.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });
      return plans?.length ? plans : fallbackPlans;
    } catch {
      return fallbackPlans;
    }
  }

  async getCurrentSubscription(userId: string) {
    const subscription = await this.findLatestSubscription(userId);
    return {
      active: isSubscriptionActive(subscription),
      subscription,
    };
  }

  async hasActiveSubscription(userId: string) {
    const subscription = await this.findLatestSubscription(userId);
    return isSubscriptionActive(subscription);
  }

  async createCheckoutIntent(userId: string, dto: CheckoutIntentDto) {
    if (!dto.planId?.trim()) {
      throw new BadRequestException('planId is required');
    }

    const plan = await this.findPlanById(dto.planId);
    if (!plan) {
      throw new BadRequestException('Subscription plan not found');
    }

    const billingCycle = normalizeBillingCycle(dto.billingCycle);
    const amountCents = calculatePlanAmountCents(plan, billingCycle);
    const externalSubscriptionId = `meetpoint-subscription-${randomUUID()}`;

    try {
      const subscription = await (this.prisma as unknown as {
        subscription?: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
      }).subscription?.create({
        data: {
          userId,
          planId: dto.planId,
          status: 'PENDING_PAYMENT',
          paymentProvider: amountCents > 0 ? 'infinitepay' : dto.paymentProvider ?? 'internal',
          externalSubscriptionId,
          checkoutAmountCents: amountCents,
          checkoutBillingCycle: billingCycle,
        },
      });

      if (subscription) {
        await this.writeAuditLog({
          userId,
          subscriptionId: String(subscription.id),
          eventType: 'CHECKOUT_CREATED',
          oldStatus: null,
          newStatus: 'PENDING_PAYMENT',
          paymentReference: externalSubscriptionId,
        });
      }

      const checkoutSession =
        amountCents > 0
          ? await this.createInfinitePayCheckoutLink({
              amountCents,
              customerEmail: await this.findUserEmail(userId),
              customerName: await this.findUserName(userId),
              description: `Assinatura ${plan.name} - ${billingCycle}`,
              orderNsu: externalSubscriptionId,
            })
          : null;

      return {
        status: 'PENDING_PAYMENT',
        externalSubscriptionId,
        subscription,
        checkoutSession,
        webhookRequiredToActivateAccount: true,
      };
    } catch {
      return {
        status: 'PENDING_PAYMENT',
        externalSubscriptionId,
        webhookRequiredToActivateAccount: true,
      };
    }
  }

  async processInfinitePayWebhook(
    rawBody: Buffer | undefined,
    parsedBody: unknown,
  ) {
    const event = parseInfinitePaySubscriptionEvent(rawBody, parsedBody);
    const orderNsu = event.order_nsu?.trim();
    const transactionNsu = event.transaction_nsu?.trim();
    const invoiceSlug = event.invoice_slug?.trim();

    if (!orderNsu || !transactionNsu || !invoiceSlug) {
      throw new BadRequestException(
        'InfinitePay order_nsu, transaction_nsu and invoice_slug are required',
      );
    }

    const subscription = await (this.prisma as unknown as {
      subscription?: {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      };
    }).subscription?.findFirst({
      where: { externalSubscriptionId: orderNsu },
      include: { plan: true },
    });
    if (!subscription) {
      throw new BadRequestException('Unknown subscription order_nsu');
    }

    const expectedAmount = Number(subscription.checkoutAmountCents);
    const receivedAmount = normalizeAmountCents(event.amount);
    if (!Number.isInteger(expectedAmount) || receivedAmount !== expectedAmount) {
      throw new BadRequestException('InfinitePay subscription amount does not match');
    }

    await this.verifyInfinitePayPayment({
      amountCents: expectedAmount,
      invoiceSlug,
      orderNsu,
      transactionNsu,
    });

    const result = await this.upsertSubscriptionFromWebhook(
      {
        userId: String(subscription.userId),
        planId: String(subscription.planId),
        externalSubscriptionId: orderNsu,
        eventType: 'INFINITEPAY_SUBSCRIPTION_PAID',
        status: 'ACTIVE',
      },
      transactionNsu,
      {
        paidAt: new Date(),
        receiptUrl: event.receipt_url,
        transactionNsu,
      },
    );

    return { ok: true, orderNsu, transactionNsu, ...result };
  }

  async processProviderWebhook(
    dto: SubscriptionWebhookDto,
    headers: {
      signature?: string;
      timestamp?: string;
      eventId?: string;
    },
    rawPayload: string,
  ) {
    this.assertWebhookSignature(headers, rawPayload);
    if (!dto.userId || !dto.planId || !dto.externalSubscriptionId || !dto.status) {
      throw new BadRequestException('Invalid subscription webhook payload');
    }

    const eventId = headers.eventId || dto.externalSubscriptionId;
    const duplicate = await this.hasAuditEvent(eventId);
    if (duplicate) return { ok: true, duplicate: true, eventId };

    const result = await this.upsertSubscriptionFromWebhook(dto, eventId);
    return { ok: true, eventId, ...result };
  }

  private async findPlanById(planId: string) {
    try {
      const plan = await (this.prisma as unknown as {
        subscriptionPlan?: {
          findFirst: (args: unknown) => Promise<PlanRecord | null>;
        };
      }).subscriptionPlan?.findFirst({
        where: { id: planId, isActive: true },
      });
      return plan ?? fallbackPlans.find((candidate) => candidate.id === planId) ?? null;
    } catch {
      return fallbackPlans.find((candidate) => candidate.id === planId) ?? null;
    }
  }

  private async findLatestSubscription(userId: string) {
    try {
      return await (this.prisma as unknown as {
        subscription?: {
          findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        };
      }).subscription?.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });
    } catch {
      return null;
    }
  }

  private async upsertSubscriptionFromWebhook(
    dto: SubscriptionWebhookDto,
    eventId: string,
    paymentData?: {
      paidAt?: Date;
      receiptUrl?: string;
      transactionNsu?: string;
    },
  ) {
    const now = new Date();
    const activationData =
      dto.status === 'ACTIVE'
        ? {
            startedAt: now,
            renewalDate: addDays(now, 30),
            expiresAt: addDays(now, 35),
            cancelledAt: null,
          }
        : dto.status === 'CANCELLED'
          ? { cancelledAt: now }
        : {};
    const paymentUpdate = {
      ...(paymentData?.paidAt ? { paidAt: paymentData.paidAt } : {}),
      ...(paymentData?.receiptUrl ? { receiptUrl: paymentData.receiptUrl } : {}),
      ...(paymentData?.transactionNsu
        ? { transactionNsu: paymentData.transactionNsu }
        : {}),
      paymentProvider: 'infinitepay',
    };

    try {
      const stored = await (this.prisma as unknown as {
        subscription?: {
          findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
          create: (args: unknown) => Promise<Record<string, unknown>>;
          update: (args: unknown) => Promise<Record<string, unknown>>;
        };
        user?: {
          update: (args: unknown) => Promise<unknown>;
        };
      }).subscription;

      const existing = await stored?.findFirst({
        where: { externalSubscriptionId: dto.externalSubscriptionId },
      });
      const subscription = existing
        ? await stored?.update({
            where: { id: existing.id },
            data: {
              status: dto.status,
              planId: dto.planId,
              ...activationData,
              ...paymentUpdate,
            },
          })
        : await stored?.create({
            data: {
              userId: dto.userId,
              planId: dto.planId,
              status: dto.status,
              ...paymentUpdate,
              externalSubscriptionId: dto.externalSubscriptionId,
              ...activationData,
            },
          });

      if (dto.status === 'ACTIVE') {
        await (this.prisma as unknown as {
          user?: { update: (args: unknown) => Promise<unknown> };
        }).user?.update({
          where: { id: dto.userId },
          data: { status: 'ACTIVE' },
        });
      }

      if (subscription) {
        await this.writeAuditLog({
          userId: dto.userId,
          subscriptionId: String(subscription.id),
          eventType: dto.eventType || 'SUBSCRIPTION_WEBHOOK',
          oldStatus: existing?.status ? String(existing.status) : null,
          newStatus: dto.status,
          paymentReference: eventId,
        });
      }

      return { subscription };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async writeAuditLog(data: {
    userId: string;
    subscriptionId: string;
    eventType: string;
    oldStatus: string | null;
    newStatus: string | null;
    paymentReference: string;
  }) {
    try {
      await (this.prisma as unknown as {
        subscriptionAuditLog?: {
          create: (args: unknown) => Promise<unknown>;
        };
      }).subscriptionAuditLog?.create({ data });
    } catch {
      // Audit table can be unavailable before migrations in local development.
    }
  }

  private async hasAuditEvent(paymentReference: string) {
    try {
      const existing = await (this.prisma as unknown as {
        subscriptionAuditLog?: {
          findFirst: (args: unknown) => Promise<unknown>;
        };
      }).subscriptionAuditLog?.findFirst({
        where: { paymentReference },
      });
      return Boolean(existing);
    } catch {
      return false;
    }
  }

  private async createInfinitePayCheckoutLink(params: {
    amountCents: number;
    customerEmail: string;
    customerName: string;
    description: string;
    orderNsu: string;
  }) {
    const handle = getInfinitePayHandle();
    const redirectUrl = requireUrl(
      process.env.INFINITEPAY_SUCCESS_URL,
      'INFINITEPAY_SUCCESS_URL',
    );
    const webhookUrl = requireUrl(
      process.env.INFINITEPAY_SUBSCRIPTION_WEBHOOK_URL ??
        process.env.INFINITEPAY_WEBHOOK_URL?.replace(
          '/webhooks/infinitepay',
          '/subscriptions/infinitepay-webhook',
        ),
      'INFINITEPAY_SUBSCRIPTION_WEBHOOK_URL',
    );
    const payload = {
      handle,
      items: [
        {
          quantity: 1,
          price: params.amountCents,
          description: params.description,
        },
      ],
      order_nsu: params.orderNsu,
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
      customer: {
        name: params.customerName,
        email: params.customerEmail,
      },
    };
    const endpoint =
      process.env.INFINITEPAY_LINKS_ENDPOINT ??
      'https://api.checkout.infinitepay.io/links';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await parseJsonResponse<InfinitePayLinkResponse>(response);
    if (!response.ok) {
      throw new BadRequestException({
        message: 'InfinitePay subscription checkout link creation failed',
        status: response.status,
        response: raw,
      });
    }

    const linkData = raw.data ?? raw;
    const url =
      linkData.url ??
      linkData.checkout_url ??
      linkData.checkoutUrl ??
      linkData.payment_url ??
      linkData.link ??
      buildDirectInfinitePayCheckoutUrl({
        handle,
        items: payload.items,
        orderNsu: params.orderNsu,
        redirectUrl,
        webhookUrl,
      });

    return {
      id: linkData.id ?? linkData.invoice_slug ?? linkData.slug ?? params.orderNsu,
      url,
      successUrl: redirectUrl,
      webhookUrl,
      live: true,
      raw,
    };
  }

  private async verifyInfinitePayPayment(params: {
    amountCents: number;
    invoiceSlug: string;
    orderNsu: string;
    transactionNsu: string;
  }) {
    const endpoint =
      process.env.INFINITEPAY_PAYMENT_CHECK_ENDPOINT ??
      'https://api.checkout.infinitepay.io/payment_check';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: getInfinitePayHandle(),
        order_nsu: params.orderNsu,
        transaction_nsu: params.transactionNsu,
        slug: params.invoiceSlug,
      }),
    });
    const paymentCheck =
      await parseJsonResponse<InfinitePayPaymentCheckResponse>(response);

    if (!response.ok || !paymentCheck.success || !paymentCheck.paid) {
      throw new BadRequestException('InfinitePay payment_check did not confirm subscription');
    }

    if (normalizeAmountCents(paymentCheck.amount) !== params.amountCents) {
      throw new BadRequestException('InfinitePay confirmed subscription amount does not match');
    }
  }

  private async findUserEmail(userId: string) {
    const user = await (this.prisma as unknown as {
      user?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
    }).user?.findUnique({ where: { id: userId }, select: { email: true } });
    return String(user?.email ?? '');
  }

  private async findUserName(userId: string) {
    const user = await (this.prisma as unknown as {
      user?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
    }).user?.findUnique({ where: { id: userId }, select: { name: true } });
    return String(user?.name ?? 'MeetPoint');
  }

  private assertWebhookSignature(
    headers: { signature?: string; timestamp?: string },
    rawPayload: string,
  ) {
    const secret = process.env.SUBSCRIPTION_WEBHOOK_SECRET;
    if (!secret) {
      throw new UnauthorizedException('SUBSCRIPTION_WEBHOOK_SECRET is required');
    }
    if (!headers.signature || !headers.timestamp) {
      throw new UnauthorizedException('Missing subscription webhook signature');
    }

    const toleranceSeconds = Number(
      process.env.SUBSCRIPTION_WEBHOOK_TOLERANCE_SECONDS ?? 300,
    );
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(headers.timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
      throw new UnauthorizedException('Subscription webhook timestamp is outside tolerance');
    }

    const signedPayload = `${headers.timestamp}.${rawPayload}`;
    const expected = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const signatureBuffer = Buffer.from(headers.signature, 'hex');
    const valid =
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!valid) {
      throw new UnauthorizedException('Invalid subscription webhook signature');
    }
  }
}

function isSubscriptionActive(subscription: Record<string, unknown> | null | undefined) {
  if (!subscription || subscription.status !== 'ACTIVE') return false;
  const expiresAt = typeof subscription.expiresAt === 'string' || subscription.expiresAt instanceof Date
    ? new Date(subscription.expiresAt)
    : null;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeBillingCycle(candidate: string | undefined) {
  if (candidate === 'semiannual' || candidate === 'annual') return candidate;
  return 'monthly';
}

function calculatePlanAmountCents(plan: PlanRecord, billingCycle: string) {
  const price = Number(plan.price);
  const multiplier =
    billingCycle === 'annual' ? 10 : billingCycle === 'semiannual' ? 5.5 : 1;
  return Math.round(price * multiplier * 100);
}

function parseInfinitePaySubscriptionEvent(
  rawBody: Buffer | undefined,
  parsedBody: unknown,
) {
  if (parsedBody && typeof parsedBody === 'object') {
    return parsedBody as InfinitePaySubscriptionWebhookDto;
  }
  if (!rawBody) {
    throw new BadRequestException('Raw InfinitePay subscription webhook body is required');
  }
  try {
    return JSON.parse(rawBody.toString('utf8')) as InfinitePaySubscriptionWebhookDto;
  } catch {
    throw new BadRequestException('Invalid InfinitePay subscription webhook JSON');
  }
}

function normalizeAmountCents(value: number | string | undefined) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new BadRequestException('InfinitePay amount must be an integer in cents');
  }
  return amount;
}

function getInfinitePayHandle() {
  const handle = process.env.INFINITEPAY_HANDLE?.trim().replace(/^\$/, '');
  if (!handle) {
    throw new BadRequestException('INFINITEPAY_HANDLE is required');
  }
  return handle;
}

function requireUrl(candidate: string | undefined, label: string) {
  if (!candidate) {
    throw new BadRequestException(`${label} is required`);
  }
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(`${label} must use http or https`);
    }
    return parsed.toString();
  } catch {
    throw new BadRequestException(`${label} must be a valid URL`);
  }
}

function buildDirectInfinitePayCheckoutUrl(params: {
  handle: string;
  items: Array<{ quantity: number; price: number; description: string }>;
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
}) {
  const checkoutUrl = new URL(
    `https://checkout.infinitepay.io/${encodeURIComponent(params.handle)}`,
  );
  checkoutUrl.searchParams.set('items', JSON.stringify(params.items));
  checkoutUrl.searchParams.set('order_nsu', params.orderNsu);
  checkoutUrl.searchParams.set('redirect_url', params.redirectUrl);
  checkoutUrl.searchParams.set('webhook_url', params.webhookUrl);
  return checkoutUrl.toString();
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
