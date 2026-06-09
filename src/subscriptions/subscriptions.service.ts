import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
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

type SubscriptionLifecycle = {
  renewalDate: Date;
  expiresAt: Date;
  daysRemaining: number;
  warningDaysRemaining: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  nextChargeDate: Date;
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
  data?: InfinitePayLinkResponse;
};

type InfinitePayPaymentCheckResponse = {
  success?: boolean;
  paid?: boolean;
  amount?: number | string;
};

type InfinitePayCheckoutItem = {
  quantity: number;
  price: number;
  name: string;
  description: string;
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

const BILLING_CYCLE_DAYS: Record<string, number> = {
  monthly: 30,
  semiannual: 180,
  annual: 365,
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
};

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
    const subscription = await this.reconcileCurrentSubscription(userId);
    const lifecycle = getSubscriptionLifecycle(subscription);
    return {
      active: isSubscriptionActive(subscription),
      subscription,
      lifecycle,
      status: subscription?.status ?? null,
      warning: lifecycle?.isExpiringSoon
        ? `Sua assinatura expira em ${formatRelativeSubscriptionDate(lifecycle.expiresAt)}.`
        : lifecycle?.isExpired
          ? 'Sua assinatura venceu e a conta foi colocada em renovação.'
          : '',
      shouldBlockAccount: Boolean(lifecycle?.isExpired),
    };
  }

  async hasActiveSubscription(userId: string) {
    const subscription = await this.reconcileCurrentSubscription(userId);
    return isSubscriptionActive(subscription);
  }

  async createCheckoutIntent(userId: string, dto: CheckoutIntentDto) {
    try {
      return await this.createCheckoutIntentUnsafe(userId, dto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error(
        JSON.stringify({
          message: 'Subscription checkout creation failed.',
          checkoutError: normalizeIntegrationError(error),
        }),
      );

      throw new ServiceUnavailableException({
        message: 'Could not create subscription checkout',
        details: getPublicIntegrationErrorDetails(error),
      });
    }
  }

  private async createCheckoutIntentUnsafe(userId: string, dto: CheckoutIntentDto) {
    if (!dto.planId?.trim()) {
      throw new BadRequestException('planId is required');
    }

    const plan = await this.findPlanById(dto.planId);
    if (!plan) {
      throw new BadRequestException('Subscription plan not found');
    }
    const persistedPlan = await this.ensureSubscriptionPlan(plan);

    const billingCycle = normalizeBillingCycle(dto.billingCycle);
    const amountCents = calculatePlanAmountCents(persistedPlan, billingCycle);
    const externalSubscriptionId = `meetpoint-subscription-${randomUUID()}`;

    const subscription = await (this.prisma as unknown as {
      subscription?: {
        create: (args: unknown) => Promise<Record<string, unknown>>;
      };
    }).subscription?.create({
      data: {
        userId,
        planId: persistedPlan.id,
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
            description: `Assinatura ${persistedPlan.name} - ${getBillingCycleLabel(billingCycle)}`,
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

    const billingCycle = normalizeBillingCycle(
      String(subscription.checkoutBillingCycle ?? 'monthly'),
    );
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
        cycle: billingCycle,
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

  private async ensureSubscriptionPlan(plan: PlanRecord) {
    try {
      const stored = await (this.prisma as unknown as {
        subscriptionPlan?: {
          upsert: (args: unknown) => Promise<PlanRecord>;
        };
      }).subscriptionPlan?.upsert({
        where: { id: plan.id },
        update: {
          name: plan.name,
          description: plan.description ?? null,
          price: plan.price,
          billingCycle: plan.billingCycle,
          features: plan.features,
          isActive: plan.isActive,
        },
        create: {
          id: plan.id,
          name: plan.name,
          description: plan.description ?? null,
          price: plan.price,
          billingCycle: plan.billingCycle,
          features: plan.features,
          isActive: plan.isActive,
        },
      });
      return stored ?? plan;
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(`Could not prepare subscription plan: ${error.message}`);
      }
      throw error;
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
      cycle?: string;
    },
  ) {
    const now = new Date();
    const billingCycle = normalizeBillingCycle(paymentData?.cycle);
    const lifecycle = buildSubscriptionLifecycle(billingCycle, now);
    const activationData =
      dto.status === 'ACTIVE'
        ? {
            startedAt: now,
            renewalDate: lifecycle.renewalDate,
            expiresAt: lifecycle.expiresAt,
            cancelledAt: null,
          }
          : dto.status === 'CANCELLED'
          ? { cancelledAt: now, expiresAt: now }
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
          data: { status: 'ACTIVE', blockedAt: null, blockedReason: null },
        });
      } else if (dto.status === 'EXPIRED' || dto.status === 'CANCELLED') {
        await (this.prisma as unknown as {
          user?: { update: (args: unknown) => Promise<unknown> };
        }).user?.update({
          where: { id: dto.userId },
          data: {
            status: 'PENDING_PAYMENT',
            blockedAt: now,
            blockedReason: `Assinatura ${dto.status === 'EXPIRED' ? 'expirada' : 'cancelada'} em ${now.toISOString()}`,
          },
        });
        await this.writeAuditLog({
          userId: dto.userId,
          subscriptionId: String(subscription?.id ?? dto.externalSubscriptionId),
          eventType: dto.status === 'EXPIRED' ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_CANCELLED',
          oldStatus: existing?.status ? String(existing.status) : null,
          newStatus: dto.status,
          paymentReference: eventId,
        });
        await this.writePlatformAuditLog({
          action: dto.status === 'EXPIRED' ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_CANCELLED',
          targetType: 'USER',
          targetId: dto.userId,
          metadata: {
            subscriptionId: String(subscription?.id ?? dto.externalSubscriptionId),
            previousStatus: existing?.status ? String(existing.status) : null,
            paymentReference: eventId,
            blockedReason: dto.status === 'EXPIRED' ? 'subscription_expired' : 'subscription_cancelled',
          },
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

  private async writePlatformAuditLog(data: {
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await (this.prisma as unknown as {
        platformAuditLog?: {
          create: (args: unknown) => Promise<unknown>;
        };
      }).platformAuditLog?.create({ data });
    } catch {
      // Platform audit can be unavailable before migrations in local development.
    }
  }

  private async reconcileCurrentSubscription(userId: string) {
    const subscription = await this.findLatestSubscription(userId);
    if (!subscription) return null;

    const lifecycle = getSubscriptionLifecycle(subscription);
    if (!lifecycle?.isExpired || subscription.status === 'EXPIRED') {
      return subscription;
    }

    const updatedSubscription = await (this.prisma as unknown as {
      subscription?: {
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
      user?: {
        update: (args: unknown) => Promise<unknown>;
      };
    });

    const expiredSubscription = await updatedSubscription.subscription?.update({
      where: { id: String(subscription.id) },
      data: {
        status: 'EXPIRED',
        expiresAt: lifecycle.expiresAt,
        renewalDate: lifecycle.renewalDate,
      },
    });

    await updatedSubscription.user?.update({
      where: { id: userId },
      data: {
        status: 'PENDING_PAYMENT',
        blockedAt: new Date(),
        blockedReason: `Assinatura expirada em ${lifecycle.expiresAt.toISOString()}`,
      },
    });

    if (expiredSubscription) {
      await this.writeAuditLog({
        userId,
        subscriptionId: String(expiredSubscription.id),
        eventType: 'SUBSCRIPTION_EXPIRED',
        oldStatus: String(subscription.status ?? 'ACTIVE'),
        newStatus: 'EXPIRED',
        paymentReference: String(subscription.externalSubscriptionId ?? expiredSubscription.id),
      });
      await this.writePlatformAuditLog({
        action: 'SUBSCRIPTION_EXPIRED',
        targetType: 'USER',
        targetId: userId,
        metadata: {
          subscriptionId: String(expiredSubscription.id),
          previousStatus: String(subscription.status ?? 'ACTIVE'),
          expiresAt: lifecycle.expiresAt.toISOString(),
          blockedReason: 'subscription_expired',
        },
      });
      return expiredSubscription;
    }

    return subscription;
  }

  private async createInfinitePayCheckoutLink(params: {
    amountCents: number;
    customerEmail: string;
    customerName: string;
    description: string;
    orderNsu: string;
  }) {
    assertPositiveIntegerCents(params.amountCents);
    const handle = getInfinitePayHandle();
    const redirectUrl = getInfinitePaySuccessUrl();
    const webhookUrl = getInfinitePaySubscriptionWebhookUrl();
    const item: InfinitePayCheckoutItem = {
      quantity: 1,
      price: params.amountCents,
      name: params.description,
      description: params.description,
    };
    const payload = {
      handle,
      items: [item],
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
    let raw: InfinitePayLinkResponse;
    let url: string;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      raw = await parseJsonResponse<InfinitePayLinkResponse>(response);
      if (response.ok) {
        const linkData = raw.data ?? raw;
        url = linkData.url ?? '';
        if (!optionalUrl(url)) {
          throw new ServiceUnavailableException({
            message: 'InfinitePay did not return a valid checkout URL',
            infinitePay: {
              endpoint,
              status: response.status,
              body: raw,
            },
          });
        }
      } else {
        throw new ServiceUnavailableException({
          message: 'InfinitePay checkout link creation failed',
          infinitePay: {
            endpoint,
            status: response.status,
            statusText: response.statusText,
            body: raw,
          },
        });
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException({
        message: 'InfinitePay checkout link creation request failed',
        details: normalizeIntegrationError(error),
      });
    }

    return {
      id: raw.id ?? raw.invoice_slug ?? raw.slug ?? params.orderNsu,
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
      throw new ServiceUnavailableException({
        message: 'InfinitePay payment_check did not confirm subscription',
        infinitePay: {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          body: paymentCheck,
        },
      });
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

function getBillingCycleDays(billingCycle: string) {
  return BILLING_CYCLE_DAYS[billingCycle] ?? BILLING_CYCLE_DAYS.monthly;
}

function getBillingCycleLabel(billingCycle: string) {
  return BILLING_CYCLE_LABELS[billingCycle] ?? BILLING_CYCLE_LABELS.monthly;
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

function buildSubscriptionLifecycle(
  billingCycle: string,
  startedAt = new Date(),
): SubscriptionLifecycle {
  const cycleDays = getBillingCycleDays(billingCycle);
  const expiresAt = addDays(startedAt, cycleDays);
  const warningDaysRemaining = Math.min(Math.max(Math.floor(cycleDays * 0.25), 7), 30);
  const warningAt = addDays(expiresAt, -warningDaysRemaining);
  const now = new Date();
  const daysRemaining = Math.ceil(
    (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return {
    renewalDate: expiresAt,
    expiresAt,
    daysRemaining,
    warningDaysRemaining,
    isExpiringSoon: now >= warningAt && now < expiresAt,
    isExpired: now >= expiresAt,
    nextChargeDate: expiresAt,
  };
}

function getSubscriptionLifecycle(subscription: Record<string, unknown> | null | undefined) {
  if (!subscription) return null;
  const billingCycle = normalizeBillingCycle(
    typeof subscription.checkoutBillingCycle === 'string'
      ? subscription.checkoutBillingCycle
      : typeof subscription.plan === 'object' && subscription.plan && 'billingCycle' in subscription.plan
        ? String((subscription.plan as { billingCycle?: string }).billingCycle ?? 'monthly')
        : 'monthly',
  );
  const startedAt = subscription.startedAt instanceof Date
    ? subscription.startedAt
    : typeof subscription.startedAt === 'string'
      ? new Date(subscription.startedAt)
      : new Date();
  const expiresAt = subscription.expiresAt instanceof Date
    ? subscription.expiresAt
    : typeof subscription.expiresAt === 'string'
      ? new Date(subscription.expiresAt)
      : null;
  const renewalDate = subscription.renewalDate instanceof Date
    ? subscription.renewalDate
    : typeof subscription.renewalDate === 'string'
      ? new Date(subscription.renewalDate)
      : null;
  const resolvedExpiresAt = expiresAt ?? addDays(startedAt, getBillingCycleDays(billingCycle));
  const resolvedRenewalDate = renewalDate ?? resolvedExpiresAt;
  const now = new Date();
  const daysRemaining = Math.ceil(
    (resolvedExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const warningDaysRemaining = Math.min(Math.max(Math.floor(getBillingCycleDays(billingCycle) * 0.25), 7), 30);
  const warningAt = addDays(resolvedExpiresAt, -warningDaysRemaining);
  return {
    renewalDate: resolvedRenewalDate,
    expiresAt: resolvedExpiresAt,
    daysRemaining,
    warningDaysRemaining,
    isExpiringSoon: now >= warningAt && now < resolvedExpiresAt,
    isExpired: now >= resolvedExpiresAt,
    nextChargeDate: resolvedExpiresAt,
  } satisfies SubscriptionLifecycle;
}

function formatRelativeSubscriptionDate(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
  return handle || 'meetpoint';
}

function assertPositiveIntegerCents(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new BadRequestException(
      `InfinitePay checkout amount must be a positive integer in cents. Received: ${amountCents}`,
    );
  }
}

function optionalUrl(candidate: string | undefined) {
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function getInfinitePaySuccessUrl() {
  return (
    optionalUrl(process.env.INFINITEPAY_SUCCESS_URL) ??
    optionalUrl(
      process.env.FRONTEND_PUBLIC_URL ??
        process.env.PUBLIC_FRONTEND_URL ??
        process.env.APP_PUBLIC_URL,
    ) ??
    'https://novalab.me/meetpoint/?page=profile&payment=success'
  );
}

function getInfinitePaySubscriptionWebhookUrl() {
  const explicitWebhook = optionalUrl(process.env.INFINITEPAY_SUBSCRIPTION_WEBHOOK_URL);
  if (explicitWebhook) return explicitWebhook;

  const legacyWebhook = optionalUrl(process.env.INFINITEPAY_WEBHOOK_URL);
  if (legacyWebhook) {
    return legacyWebhook.replace(
      '/webhooks/infinitepay',
      '/subscriptions/infinitepay-webhook',
    );
  }

  const apiBaseUrl = optionalUrl(
    process.env.API_PUBLIC_URL ??
      process.env.PUBLIC_API_URL ??
      process.env.BACKEND_PUBLIC_URL,
  );
  if (apiBaseUrl) {
    return new URL('/subscriptions/infinitepay-webhook', apiBaseUrl).toString();
  }

  return 'https://meetpoint-api-y46s.onrender.com/subscriptions/infinitepay-webhook';
}

function normalizeIntegrationError(error: unknown) {
  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      response?: {
        status?: unknown;
        statusText?: unknown;
        data?: unknown;
      };
      cause?: unknown;
    };
    return {
      message: typeof candidate.message === 'string' ? candidate.message : String(error),
      response: candidate.response
        ? {
            status: candidate.response.status,
            statusText: candidate.response.statusText,
            data: candidate.response.data,
          }
        : undefined,
      cause:
        candidate.cause instanceof Error
          ? candidate.cause.message
          : candidate.cause
            ? String(candidate.cause)
            : undefined,
    };
  }

  return { message: String(error) };
}

function getPublicIntegrationErrorDetails(error: unknown) {
  const normalized = normalizeIntegrationError(error);
  if (process.env.NODE_ENV === 'production') {
    return {
      message: normalized.message,
      responseStatus: normalized.response?.status,
    };
  }
  return normalized;
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
