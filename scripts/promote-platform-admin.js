const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMIN_PERMISSIONS = [
  'USERS_WRITE',
  'COMPANIES_WRITE',
  'COURSES_WRITE',
  'PAYMENTS_READ',
  'SUPPORT_WRITE',
  'MAINTENANCE_WRITE',
];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const email = requiredEnv('ADMIN_EMAIL').toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador MeetPoint';
  const tenantSubdomain = process.env.DEFAULT_TENANT_SUBDOMAIN?.trim() || 'meetpoint';
  const tenantName = process.env.DEFAULT_TENANT_NAME?.trim() || 'MeetPoint';

  const result = await prisma.$transaction(async (tx) => {
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
      throw new Error(`User not found for tenant ${tenantSubdomain} and email ${email}`);
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

    return {
      userId: user.id,
      staffId: staff.id,
      email,
      role: 'ADMIN',
      platformRole: 'OWNER',
      permissions: ADMIN_PERMISSIONS,
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
