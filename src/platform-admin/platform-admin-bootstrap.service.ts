import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_PERMISSIONS = [
  'USERS_WRITE',
  'COMPANIES_WRITE',
  'COURSES_WRITE',
  'PAYMENTS_READ',
  'SUPPORT_WRITE',
  'MAINTENANCE_WRITE',
] as const;

@Injectable()
export class PlatformAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformAdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    if (!email) return;

    const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || 'Administrador MeetPoint';
    const tenantSubdomain = process.env.DEFAULT_TENANT_SUBDOMAIN?.trim() || 'meetpoint';
    const tenantName = process.env.DEFAULT_TENANT_NAME?.trim() || 'MeetPoint';

    try {
      await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.upsert({
          where: { subdomain: tenantSubdomain },
          update: { name: tenantName },
          create: { subdomain: tenantSubdomain, name: tenantName },
        });

        const user = await tx.user.findFirst({
          where: { tenantId: tenant.id, email },
          select: { id: true, email: true, name: true },
        });

        if (!user) {
          this.logger.warn(
            `ADMIN_BOOTSTRAP_EMAIL configured but user was not found for tenant ${tenantSubdomain}.`,
          );
          return;
        }

        await tx.user.update({
          where: { id: user.id },
          data: {
            role: 'ADMIN',
            status: 'ACTIVE',
            acceptedTerms: true,
            acceptedPrivacyPolicy: true,
          },
        });

        const staff = await tx.platformStaff.upsert({
          where: { email },
          update: {
            name: name || user.name || user.email,
            role: 'OWNER',
            isActive: true,
          },
          create: {
            name: name || user.name || user.email,
            email,
            role: 'OWNER',
            isActive: true,
          },
        });

        await tx.platformStaffPermission.deleteMany({ where: { staffId: staff.id } });
        await tx.platformStaffPermission.createMany({
          data: ADMIN_PERMISSIONS.map((permission) => ({
            staffId: staff.id,
            permission,
          })),
          skipDuplicates: true,
        });
      });

      this.logger.log('Platform admin bootstrap completed.');
    } catch (error) {
      this.logger.error('Platform admin bootstrap failed.', error instanceof Error ? error.stack : String(error));
    }
  }
}
