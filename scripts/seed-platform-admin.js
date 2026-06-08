const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

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

function assertStrongPassword(password) {
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('ADMIN_PASSWORD must have at least 12 chars with uppercase, lowercase and number');
  }
}

async function main() {
  const email = requiredEnv('ADMIN_EMAIL').toLowerCase();
  const password = requiredEnv('ADMIN_PASSWORD');
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador MeetPoint';
  const city = process.env.ADMIN_CITY?.trim() || 'Juazeiro';
  const state = process.env.ADMIN_STATE?.trim().toUpperCase() || 'BA';
  const tenantSubdomain = process.env.DEFAULT_TENANT_SUBDOMAIN?.trim() || 'meetpoint';
  const tenantName = process.env.DEFAULT_TENANT_NAME?.trim() || 'MeetPoint';

  assertStrongPassword(password);

  const passwordHash = await hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.upsert({
      where: { subdomain: tenantSubdomain },
      update: { name: tenantName },
      create: { subdomain: tenantSubdomain, name: tenantName },
    });

    const existingUser = await tx.user.findFirst({
      where: { tenantId: tenant.id, email },
      select: { id: true },
    });

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            password: passwordHash,
            passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            name,
            city,
            state,
            acceptedTerms: true,
            acceptedPrivacyPolicy: true,
          },
        })
      : await tx.user.create({
          data: {
            tenantId: tenant.id,
            email,
            password: passwordHash,
            passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            name,
            city,
            state,
            acceptedTerms: true,
            acceptedPrivacyPolicy: true,
            contactEmailVerifiedAt: new Date(),
          },
        });

    const staff = await tx.platformStaff.upsert({
      where: { email },
      update: {
        name,
        role: 'OWNER',
        isActive: true,
      },
      create: {
        name,
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
      role: user.role,
      platformRole: staff.role,
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
