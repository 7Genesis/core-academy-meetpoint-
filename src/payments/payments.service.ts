import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EnrollmentPaymentStatus } from '../common/prisma-enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseCheckoutDto } from './dto/create-course-checkout.dto';

const INFINITEPAY_GATEWAY = 'infinitepay';

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

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCourseCheckout(
    tenantId: string,
    user: AuthenticatedUser,
    dto: CreateCourseCheckoutDto,
  ) {
    const checkoutReference = randomUUID();
    const orderNsu = `meetpoint-course-${checkoutReference}`;

    const prepared = await this.prisma.withTenant(tenantId, async (tx) => {
      const [userRecord, course] = await Promise.all([
        tx.user.findFirst({
          where: { id: user.sub, tenantId },
          select: { id: true, email: true, name: true, status: true },
        }),
        tx.course.findFirst({
          where: { id: dto.courseId, tenantId },
          select: {
            id: true,
            title: true,
            priceCents: true,
            currency: true,
            platformFeeBps: true,
          },
        }),
      ]);

      if (!userRecord) throw new NotFoundException('User not found');
      if (!course) throw new NotFoundException('Course not found');
      if (userRecord.status === 'BLOCKED') {
        throw new ForbiddenException('Blocked users cannot start checkout');
      }

      const amountCents = course.priceCents;
      const platformFeeCents = Math.round(
        (amountCents * course.platformFeeBps) / 10_000,
      );
      const producerNetCents = amountCents - platformFeeCents;
      const isFree = amountCents === 0;

      const enrollment = isFree
        ? await tx.enrollment.upsert({
            where: {
              tenantId_userId_courseId: {
                tenantId,
                userId: userRecord.id,
                courseId: course.id,
              },
            },
            create: {
              tenantId,
              userId: userRecord.id,
              courseId: course.id,
              paymentStatus: EnrollmentPaymentStatus.FREE,
              purchaseAmountCents: 0,
              platformFeeCents: 0,
              producerNetCents: 0,
            },
            update: {
              paymentStatus: EnrollmentPaymentStatus.FREE,
              purchaseAmountCents: 0,
              platformFeeCents: 0,
              producerNetCents: 0,
            },
          })
        : null;

      if (!isFree) {
        await tx.paymentCheckout.create({
          data: {
            gateway: INFINITEPAY_GATEWAY,
            orderNsu,
            tenantId,
            userId: userRecord.id,
            courseId: course.id,
            amountCents,
            currency: course.currency,
            status: EnrollmentPaymentStatus.PENDING,
          },
        });
      }

      return {
        userRecord,
        course,
        amountCents,
        platformFeeCents,
        producerNetCents,
        isFree,
        enrollment,
      };
    });

    const checkoutSession = prepared.isFree
      ? null
      : await this.createInfinitePayCheckoutSession({
          amountCents: prepared.amountCents,
          checkoutReference,
          courseTitle: prepared.course.title,
          currency: prepared.course.currency,
          customerEmail: prepared.userRecord.email,
          customerName: prepared.userRecord.name,
          orderNsu,
          successUrl: dto.successUrl,
        });

    if (checkoutSession) {
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.paymentCheckout.update({
          where: { orderNsu },
          data: {
            checkoutUrl: checkoutSession.url,
            gatewayCheckoutId: checkoutSession.id,
            payload: checkoutSession.raw as Prisma.InputJsonValue,
          },
        }),
      );
    }

    return {
      provider: prepared.isFree ? 'internal' : INFINITEPAY_GATEWAY,
      status: prepared.isFree ? 'FREE' : 'PENDING',
      courseId: prepared.course.id,
      courseTitle: prepared.course.title,
      amountCents: prepared.amountCents,
      currency: prepared.course.currency,
      platformFeeBps: prepared.course.platformFeeBps,
      platformFeeCents: prepared.platformFeeCents,
      producerNetCents: prepared.producerNetCents,
      paymentMethod: dto.paymentMethod ?? 'pix',
      checkoutReference,
      orderNsu,
      checkoutSession,
      enrollment: prepared.enrollment,
      security: {
        amountSource: 'server',
        tenantScoped: true,
        userScoped: true,
        webhookRequiredToReleaseCourse: !prepared.isFree,
        idempotencyKey: `${INFINITEPAY_GATEWAY}:${orderNsu}`,
      },
    };
  }

  private async createInfinitePayCheckoutSession(params: {
    amountCents: number;
    checkoutReference: string;
    courseTitle: string;
    currency: string;
    customerEmail: string;
    customerName: string;
    orderNsu: string;
    successUrl?: string;
  }) {
    if (params.currency.toUpperCase() !== 'BRL') {
      throw new BadRequestException('InfinitePay checkout supports BRL only');
    }

    const handle = this.getInfinitePayHandle();
    const redirectUrl = this.resolveCheckoutUrl(
      params.successUrl ?? process.env.INFINITEPAY_SUCCESS_URL,
      'successUrl',
    );
    const webhookUrl = this.resolveCheckoutUrl(
      process.env.INFINITEPAY_WEBHOOK_URL ?? this.deriveInfinitePayWebhookUrl(),
      'INFINITEPAY_WEBHOOK_URL',
      false,
    );
    const payload = {
      handle,
      items: [
        {
          quantity: 1,
          price: params.amountCents,
          description: params.courseTitle,
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
        message: 'InfinitePay checkout link creation failed',
        status: response.status,
        response: raw,
      });
    }

    const linkData = raw.data ?? raw;
    const checkoutUrl =
      linkData.url ??
      linkData.checkout_url ??
      linkData.checkoutUrl ??
      linkData.payment_url ??
      linkData.link ??
      this.buildDirectInfinitePayCheckoutUrl({
        handle,
        items: payload.items,
        orderNsu: params.orderNsu,
        redirectUrl,
        webhookUrl,
      });

    return {
      id: linkData.id ?? linkData.invoice_slug ?? linkData.slug ?? params.orderNsu,
      url: checkoutUrl,
      successUrl: redirectUrl,
      webhookUrl,
      live: true,
      raw,
    };
  }

  private getInfinitePayHandle() {
    const handle = process.env.INFINITEPAY_HANDLE?.trim().replace(/^\$/, '');
    if (!handle) {
      throw new BadRequestException('INFINITEPAY_HANDLE is required for paid checkout');
    }
    return handle;
  }

  private resolveCheckoutUrl(
    candidate: string | undefined,
    label: string,
    enforceAllowedOrigin = true,
  ) {
    if (!candidate) {
      throw new BadRequestException(`${label} is required for paid checkout`);
    }

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new BadRequestException(`${label} must be a valid URL`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(`${label} must use http or https`);
    }

    if (enforceAllowedOrigin) {
      const allowedOrigins = this.getAllowedCheckoutOrigins();
      if (allowedOrigins.length > 0 && !allowedOrigins.includes(parsed.origin)) {
        throw new BadRequestException(`${label} origin is not allowed`);
      }
    }

    return parsed.toString();
  }

  private getAllowedCheckoutOrigins() {
    const raw =
      process.env.CHECKOUT_ALLOWED_ORIGINS ??
      process.env.CORS_ORIGIN ??
      '';
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return null;
        }
      })
      .filter((origin): origin is string => Boolean(origin));
  }

  private deriveInfinitePayWebhookUrl() {
    const baseUrl =
      process.env.API_PUBLIC_URL ??
      process.env.PUBLIC_API_URL ??
      process.env.BACKEND_PUBLIC_URL;
    if (!baseUrl) return undefined;
    return new URL('/webhooks/infinitepay', baseUrl).toString();
  }

  private buildDirectInfinitePayCheckoutUrl(params: {
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
