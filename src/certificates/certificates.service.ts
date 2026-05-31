import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CertificateService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCertificateIfComplete(
    tenantId: string,
    userId: string,
    courseId: string,
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
      });

      if (!enrollment || enrollment.progressPercentage < 100) {
        return { generated: false, certificate: null };
      }

      const existingCertificate = await tx.certificate.findUnique({
        where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
      });

      if (existingCertificate) {
        return { generated: false, certificate: existingCertificate };
      }

      const certificate = await tx.certificate.create({
        data: { tenantId, userId, courseId },
      });

      return { generated: true, certificate };
    });
  }

  async verify(tenantId: string, verificationCode: string) {
    const certificate = await this.prisma.withTenant(tenantId, (tx) => {
      return tx.certificate.findFirst({
        where: { tenantId, verificationCode },
        include: {
          user: { select: { id: true, email: true } },
          course: { select: { id: true, title: true } },
        },
      });
    });

    if (!certificate) throw new NotFoundException('Certificate not found');
    return certificate;
  }
}
