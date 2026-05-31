import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentPaymentStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseCheckoutDto } from './dto/create-course-checkout.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCourseCheckout(
    tenantId: string,
    user: AuthenticatedUser,
    dto: CreateCourseCheckoutDto,
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [userRecord, course] = await Promise.all([
        tx.user.findFirst({
          where: { id: user.sub, tenantId },
          select: { id: true, email: true, status: true },
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

      const checkoutReference = randomUUID();
      const amountCents = course.priceCents;
      const platformFeeCents = Math.round(
        (amountCents * course.platformFeeBps) / 10_000,
      );
      const producerNetCents = amountCents - platformFeeCents;
      const isFree = amountCents === 0;

      const metadata = {
        tenantId,
        userId: userRecord.id,
        courseId: course.id,
        checkoutReference,
      };
      const checkoutSession = isFree
        ? null
        : await this.createStripeCheckoutSession({
            amountCents,
            cancelUrl: dto.cancelUrl,
            checkoutReference,
            courseTitle: course.title,
            currency: course.currency,
            customerEmail: userRecord.email,
            metadata,
            successUrl: dto.successUrl,
          });

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

      return {
        provider: isFree ? 'internal' : 'stripe',
        status: isFree ? 'FREE' : 'PENDING',
        courseId: course.id,
        courseTitle: course.title,
        amountCents,
        currency: course.currency,
        platformFeeBps: course.platformFeeBps,
        platformFeeCents,
        producerNetCents,
        paymentMethod: dto.paymentMethod ?? 'card',
        checkoutReference,
        checkoutSession,
        enrollment,
        security: {
          amountSource: 'server',
          tenantScoped: true,
          userScoped: true,
          webhookRequiredToReleaseCourse: !isFree,
          idempotencyKey: `stripe:${checkoutReference}`,
        },
      };
    });
  }

  private async createStripeCheckoutSession(params: {
    amountCents: number;
    cancelUrl?: string;
    checkoutReference: string;
    courseTitle: string;
    currency: string;
    customerEmail: string;
    metadata: Record<string, string>;
    successUrl?: string;
  }) {
    const successUrl = this.resolveCheckoutUrl(
      params.successUrl ?? process.env.STRIPE_SUCCESS_URL,
      'successUrl',
    );
    const cancelUrl = this.resolveCheckoutUrl(
      params.cancelUrl ?? process.env.STRIPE_CANCEL_URL,
      'cancelUrl',
    );
    const stripe = this.getStripeClient();

    if (stripe) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          client_reference_id: params.checkoutReference,
          customer_email: params.customerEmail,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: params.metadata,
          payment_intent_data: {
            metadata: params.metadata,
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: params.currency.toLowerCase(),
                unit_amount: params.amountCents,
                product_data: {
                  name: params.courseTitle,
                },
              },
            },
          ],
        },
        {
          idempotencyKey: `course_checkout_${params.checkoutReference}`,
        },
      );

      return {
        id: session.id,
        url: session.url,
        successUrl,
        cancelUrl,
        live: true,
      };
    }

    return {
      id: `cs_prototype_${params.checkoutReference}`,
      url: process.env.STRIPE_CHECKOUT_BASE_URL
        ? `${process.env.STRIPE_CHECKOUT_BASE_URL}?session_id=cs_prototype_${params.checkoutReference}`
        : null,
      successUrl,
      cancelUrl,
      live: false,
    };
  }

  private resolveCheckoutUrl(candidate: string | undefined, label: string) {
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

    const allowedOrigins = this.getAllowedCheckoutOrigins();
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(parsed.origin)) {
      throw new BadRequestException(`${label} origin is not allowed`);
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

  private getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || secretKey.includes('change_me')) return null;
    return new Stripe(secretKey);
  }
}
