import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
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

    const externalSubscriptionId =
      `mp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
          paymentProvider: dto.paymentProvider ?? 'mock',
          externalSubscriptionId,
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

      return {
        status: 'PENDING_PAYMENT',
        externalSubscriptionId,
        subscription,
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
            data: { status: dto.status, planId: dto.planId, ...activationData },
          })
        : await stored?.create({
            data: {
              userId: dto.userId,
              planId: dto.planId,
              status: dto.status,
              paymentProvider: 'provider',
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
