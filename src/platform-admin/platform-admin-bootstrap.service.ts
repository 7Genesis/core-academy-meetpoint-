import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { hash } from 'bcryptjs';
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
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim() || '';
    const tenantSubdomain = process.env.DEFAULT_TENANT_SUBDOMAIN?.trim() || 'meetpoint';
    const tenantName = process.env.DEFAULT_TENANT_NAME?.trim() || 'MeetPoint';

    try {
      const passwordHash = password ? await hash(password, 12) : null;
      await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.upsert({
          where: { subdomain: tenantSubdomain },
          update: { name: tenantName },
          create: { subdomain: tenantSubdomain, name: tenantName },
        });

        const existingUser = await tx.user.findFirst({
          where: { tenantId: tenant.id, email },
          select: { id: true, email: true, name: true },
        });

        if (!existingUser && !passwordHash) {
          this.logger.warn(
            `ADMIN_BOOTSTRAP_EMAIL configured but user was not found for tenant ${tenantSubdomain} and no ADMIN_BOOTSTRAP_PASSWORD was provided.`,
          );
          return;
        }

        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                ...(passwordHash ? { password: passwordHash, passwordHash } : {}),
                role: 'ADMIN',
                status: 'ACTIVE',
                acceptedTerms: true,
                acceptedPrivacyPolicy: true,
              },
            })
          : await tx.user.create({
              data: {
                tenantId: tenant.id,
                email,
                password: passwordHash!,
                passwordHash: passwordHash!,
                role: 'ADMIN',
                status: 'ACTIVE',
                name,
                city: process.env.ADMIN_BOOTSTRAP_CITY?.trim() || '',
                state: process.env.ADMIN_BOOTSTRAP_STATE?.trim().toUpperCase() || '',
                acceptedTerms: true,
                acceptedPrivacyPolicy: true,
                contactEmailVerifiedAt: new Date(),
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
