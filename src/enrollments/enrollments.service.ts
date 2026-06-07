import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SaleStatus,
} from '@prisma/client';
import {
  EnrollmentPaymentStatus,
  type EnrollmentPaymentStatus as EnrollmentPaymentStatusType,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../common/prisma-enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromPurchase(
    tenantId: string,
    userId: string,
    courseId: string,
    payment?: {
      gateway?: string;
      gatewayPaymentId?: string;
      amountCents?: number;
      paymentStatus?: EnrollmentPaymentStatusType;
    },
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [user, course] = await Promise.all([
        tx.user.findFirst({ where: { id: userId, tenantId } }),
        tx.course.findFirst({ where: { id: courseId, tenantId } }),
      ]);

      if (!user) throw new NotFoundException('User not found');
      if (!course) throw new NotFoundException('Course not found');

      const grossAmountCents = payment?.amountCents ?? course.priceCents;
      const paymentStatus =
        grossAmountCents === 0
          ? EnrollmentPaymentStatus.FREE
          : payment?.paymentStatus ?? EnrollmentPaymentStatus.PENDING;
      if (
        paymentStatus === EnrollmentPaymentStatus.PAID &&
        course.priceCents > 0 &&
        !payment?.gatewayPaymentId
      ) {
        throw new BadRequestException('Paid enrollments require a gateway payment id');
      }
      if (
        paymentStatus === EnrollmentPaymentStatus.PAID &&
        grossAmountCents < course.priceCents
      ) {
        throw new BadRequestException('Paid amount is lower than course price');
      }
      const platformFeeCents = Math.round(
        (grossAmountCents * course.platformFeeBps) / 10_000,
      );
      const producerNetCents = grossAmountCents - platformFeeCents;

      const enrollment = await tx.enrollment.upsert({
        where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
        create: {
          tenantId,
          userId,
          courseId,
          paymentStatus,
          purchaseAmountCents: grossAmountCents,
          platformFeeCents,
          producerNetCents,
          gatewayPaymentId: payment?.gatewayPaymentId,
        },
        update: {
          purchaseAmountCents: grossAmountCents,
          paymentStatus,
          platformFeeCents,
          producerNetCents,
          gatewayPaymentId: payment?.gatewayPaymentId,
        },
      });

      if (
        paymentStatus !== EnrollmentPaymentStatus.PAID &&
        paymentStatus !== EnrollmentPaymentStatus.FREE
      ) {
        await tx.supportTicket.create({
          data: {
            tenantId,
            userId,
            subject: `[Pagamento ${paymentStatus}] ${course.title}`,
            description: [
              `Aluno: ${user.email}`,
              `Curso: ${course.title}`,
              `Gateway: ${payment?.gateway ?? 'nao informado'}`,
              `Pagamento: ${payment?.gatewayPaymentId ?? 'nao informado'}`,
              `Status: ${paymentStatus}`,
            ].join('\n'),
            priority:
              paymentStatus === EnrollmentPaymentStatus.FAILED
                ? SupportTicketPriority.HIGH
                : SupportTicketPriority.MEDIUM,
            status: SupportTicketStatus.OPEN,
          },
        });
      }

      if (
        payment?.gatewayPaymentId &&
        grossAmountCents > 0 &&
        paymentStatus === EnrollmentPaymentStatus.PAID
      ) {
        await tx.courseSale.upsert({
          where: { gatewayPaymentId: payment.gatewayPaymentId },
          create: {
            tenantId,
            userId,
            courseId,
            gateway: payment.gateway ?? 'mock',
            gatewayPaymentId: payment.gatewayPaymentId,
            grossAmountCents,
            platformFeeBps: course.platformFeeBps,
            platformFeeCents,
            producerNetCents,
            currency: course.currency,
          },
          update: {
            grossAmountCents,
            platformFeeBps: course.platformFeeBps,
            platformFeeCents,
            producerNetCents,
            currency: course.currency,
          },
        });
      }

      if (
        payment?.gatewayPaymentId &&
        paymentStatus === EnrollmentPaymentStatus.REFUNDED
      ) {
        await tx.courseSale.updateMany({
          where: {
            gatewayPaymentId: payment.gatewayPaymentId,
            tenantId,
            userId,
            courseId,
          },
          data: {
            status: SaleStatus.REFUNDED,
          },
        });
      }

      return enrollment;
    });
  }
}
