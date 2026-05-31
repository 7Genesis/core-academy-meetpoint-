import {
  AccountStatus,
  PixKeyType,
  PlatformPermission,
  PlatformPayoutStatus,
  PlatformRole,
  Prisma,
  PrismaClient,
  SaleStatus,
  SupportTicketPriority,
  SupportTicketStatus,
  UserRole,
  EnrollmentPaymentStatus,
  LessonCompletionRequirement,
} from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  student: '22222222-2222-4222-8222-222222222222',
  teacher: '33333333-3333-4333-8333-333333333333',
  courseSaas: '44444444-4444-4444-8444-444444444444',
  courseCommunity: '55555555-5555-4555-8555-555555555555',
  moduleSaasIntro: '66666666-6666-4666-8666-666666666666',
  moduleSaasDelivery: '77777777-7777-4777-8777-777777777777',
  lessonRls: '88888888-8888-4888-8888-888888888888',
  lessonPrisma: '99999999-9999-4999-8999-999999999999',
  lessonVideo: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  enrollment: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  sale: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  certificate: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  platformOwner: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  supportStaff: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  ticketAccess: '12121212-1212-4121-8121-121212121212',
  ticketPayout: '34343434-3434-4343-8343-343434343434',
  payout: '56565656-5656-4565-8565-565656565656',
};

const demoPassword =
  process.env.SEED_DEMO_PASSWORD_HASH ??
  'demo-password-hash-change-before-production';

async function seedTenant(tx: Prisma.TransactionClient) {
  await tx.tenant.upsert({
    where: { subdomain: 'coreacademy' },
    update: {
      name: 'Core Academy',
    },
    create: {
      id: ids.tenant,
      name: 'Core Academy',
      subdomain: 'coreacademy',
    },
  });
}

async function seedUsers(tx: Prisma.TransactionClient) {
  await tx.user.upsert({
    where: {
      tenantId_email: {
        tenantId: ids.tenant,
        email: 'aluno@meetpoint.com',
      },
    },
    update: {
      status: AccountStatus.ACTIVE,
    },
    create: {
      id: ids.student,
      email: 'aluno@meetpoint.com',
      password: demoPassword,
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
      tenantId: ids.tenant,
    },
  });

  await tx.user.upsert({
    where: {
      tenantId_email: {
        tenantId: ids.tenant,
        email: 'professor@coreacademy.com',
      },
    },
    update: {
      status: AccountStatus.ACTIVE,
    },
    create: {
      id: ids.teacher,
      email: 'professor@coreacademy.com',
      password: demoPassword,
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      tenantId: ids.tenant,
    },
  });
}

async function seedCourses(tx: Prisma.TransactionClient) {
  await tx.course.upsert({
    where: { id: ids.courseSaas },
    update: {
      title: 'Arquitetura SaaS Multi-Tenant',
      priceCents: 49700,
      platformFeeBps: 1000,
    },
    create: {
      id: ids.courseSaas,
      title: 'Arquitetura SaaS Multi-Tenant',
      description:
        'Curso base sobre isolamento por tenant, Prisma, PostgreSQL e entrega de conteudo.',
      coverUrl: 'https://cdn.example.com/coreacademy/saas-cover.jpg',
      priceCents: 49700,
      currency: 'BRL',
      platformFeeBps: 1000,
      tenantId: ids.tenant,
    },
  });

  await tx.course.upsert({
    where: { id: ids.courseCommunity },
    update: {
      title: 'Comunidades, Conteudo e Retencao',
      priceCents: 0,
      platformFeeBps: 0,
    },
    create: {
      id: ids.courseCommunity,
      title: 'Comunidades, Conteudo e Retencao',
      description:
        'Curso gratuito sobre ativacao de comunidades, eventos e engajamento.',
      coverUrl: 'https://cdn.example.com/coreacademy/community-cover.jpg',
      priceCents: 0,
      currency: 'BRL',
      platformFeeBps: 0,
      tenantId: ids.tenant,
    },
  });
}

async function seedCourseContent(tx: Prisma.TransactionClient) {
  await tx.module.upsert({
    where: {
      courseId_order: {
        courseId: ids.courseSaas,
        order: 1,
      },
    },
    update: {
      title: 'Fundamentos SaaS',
    },
    create: {
      id: ids.moduleSaasIntro,
      title: 'Fundamentos SaaS',
      order: 1,
      courseId: ids.courseSaas,
      tenantId: ids.tenant,
    },
  });

  await tx.module.upsert({
    where: {
      courseId_order: {
        courseId: ids.courseSaas,
        order: 2,
      },
    },
    update: {
      title: 'Entrega de Conteudo',
    },
    create: {
      id: ids.moduleSaasDelivery,
      title: 'Entrega de Conteudo',
      order: 2,
      courseId: ids.courseSaas,
      tenantId: ids.tenant,
    },
  });

  await tx.lesson.upsert({
    where: {
      moduleId_order: {
        moduleId: ids.moduleSaasIntro,
        order: 1,
      },
    },
    update: {
      title: 'RLS no PostgreSQL',
    },
    create: {
      id: ids.lessonRls,
      title: 'RLS no PostgreSQL',
      order: 1,
      videoUrl: 'https://player.vimeo.com/video/demo-rls',
      attachmentUrl: 'https://s3.example.com/signed/rls.pdf',
      completionRequirement: LessonCompletionRequirement.VIDEO_WATCHED,
      requiredVideoPercent: 80,
      progressWeight: 10,
      moduleId: ids.moduleSaasIntro,
      tenantId: ids.tenant,
    },
  });

  await tx.lesson.upsert({
    where: {
      moduleId_order: {
        moduleId: ids.moduleSaasIntro,
        order: 2,
      },
    },
    update: {
      title: 'Prisma com Tenant Context',
    },
    create: {
      id: ids.lessonPrisma,
      title: 'Prisma com Tenant Context',
      order: 2,
      videoUrl: 'https://iframe.mediadelivery.net/embed/demo-prisma',
      attachmentUrl: 'https://s3.example.com/signed/prisma.pdf',
      completionRequirement: LessonCompletionRequirement.TASK_SUBMITTED,
      requiredVideoPercent: 80,
      progressWeight: 20,
      moduleId: ids.moduleSaasIntro,
      tenantId: ids.tenant,
    },
  });

  await tx.lesson.upsert({
    where: {
      moduleId_order: {
        moduleId: ids.moduleSaasDelivery,
        order: 1,
      },
    },
    update: {
      title: 'Videoaulas e materiais protegidos',
    },
    create: {
      id: ids.lessonVideo,
      title: 'Videoaulas e materiais protegidos',
      order: 1,
      videoUrl: 'https://iframe.mediadelivery.net/embed/demo-delivery',
      attachmentUrl: 'https://s3.example.com/signed/delivery.pdf',
      completionRequirement: LessonCompletionRequirement.VIDEO_WATCHED,
      requiredVideoPercent: 90,
      progressWeight: 70,
      moduleId: ids.moduleSaasDelivery,
      tenantId: ids.tenant,
    },
  });
}

async function seedCommercialFlow(tx: Prisma.TransactionClient) {
  const grossAmountCents = 49700;
  const platformFeeBps = 1000;
  const platformFeeCents = Math.round((grossAmountCents * platformFeeBps) / 10000);
  const producerNetCents = grossAmountCents - platformFeeCents;

  await tx.enrollment.upsert({
    where: {
      tenantId_userId_courseId: {
        tenantId: ids.tenant,
        userId: ids.student,
        courseId: ids.courseSaas,
      },
    },
    update: {
      progressPercentage: 64,
      paymentStatus: EnrollmentPaymentStatus.PAID,
      purchaseAmountCents: grossAmountCents,
      platformFeeCents,
      producerNetCents,
      gatewayPaymentId: 'seed-pay-saas-001',
    },
    create: {
      id: ids.enrollment,
      tenantId: ids.tenant,
      userId: ids.student,
      courseId: ids.courseSaas,
      progressPercentage: 64,
      isCompleted: false,
      paymentStatus: EnrollmentPaymentStatus.PAID,
      purchaseAmountCents: grossAmountCents,
      platformFeeCents,
      producerNetCents,
      gatewayPaymentId: 'seed-pay-saas-001',
    },
  });

  await tx.lessonProgress.upsert({
    where: {
      tenantId_userId_lessonId: {
        tenantId: ids.tenant,
        userId: ids.student,
        lessonId: ids.lessonRls,
      },
    },
    update: {
      isWatched: true,
      videoWatchedPercent: 100,
      completedAt: new Date(),
    },
    create: {
      tenantId: ids.tenant,
      userId: ids.student,
      lessonId: ids.lessonRls,
      isWatched: true,
      videoWatchedPercent: 100,
      completedAt: new Date(),
    },
  });

  await tx.courseSale.upsert({
    where: {
      gatewayPaymentId: 'seed-pay-saas-001',
    },
    update: {
      grossAmountCents,
      platformFeeBps,
      platformFeeCents,
      producerNetCents,
      status: SaleStatus.PAID,
    },
    create: {
      id: ids.sale,
      tenantId: ids.tenant,
      userId: ids.student,
      courseId: ids.courseSaas,
      gateway: 'asaas-mock',
      gatewayPaymentId: 'seed-pay-saas-001',
      grossAmountCents,
      platformFeeBps,
      platformFeeCents,
      producerNetCents,
      currency: 'BRL',
      status: SaleStatus.PAID,
    },
  });
}

async function seedPlatformAdmin(tx: Prisma.TransactionClient) {
  await tx.platformStaff.upsert({
    where: { email: 'admin@meetpoint.com' },
    update: {
      name: 'Operacao MeetPoint',
      role: PlatformRole.OWNER,
      isActive: true,
    },
    create: {
      id: ids.platformOwner,
      name: 'Operacao MeetPoint',
      email: 'admin@meetpoint.com',
      role: PlatformRole.OWNER,
      isActive: true,
    },
  });

  await tx.platformStaff.upsert({
    where: { email: 'julia@meetpoint.com' },
    update: {
      name: 'Julia Martins',
      role: PlatformRole.SUPPORT,
      isActive: true,
    },
    create: {
      id: ids.supportStaff,
      name: 'Julia Martins',
      email: 'julia@meetpoint.com',
      role: PlatformRole.SUPPORT,
      isActive: true,
    },
  });

  for (const permission of Object.values(PlatformPermission)) {
    await tx.platformStaffPermission.upsert({
      where: {
        staffId_permission: {
          staffId: ids.platformOwner,
          permission,
        },
      },
      update: {},
      create: {
        staffId: ids.platformOwner,
        permission,
      },
    });
  }

  for (const permission of [
    PlatformPermission.SUPPORT_WRITE,
    PlatformPermission.PAYMENTS_READ,
  ]) {
    await tx.platformStaffPermission.upsert({
      where: {
        staffId_permission: {
          staffId: ids.supportStaff,
          permission,
        },
      },
      update: {},
      create: {
        staffId: ids.supportStaff,
        permission,
      },
    });
  }
}

async function seedSupportAndPayouts(tx: Prisma.TransactionClient) {
  await tx.supportTicket.upsert({
    where: { id: ids.ticketAccess },
    update: {
      status: SupportTicketStatus.ASSIGNED,
      assignedToId: ids.supportStaff,
    },
    create: {
      id: ids.ticketAccess,
      tenantId: ids.tenant,
      userId: ids.student,
      assignedToId: ids.supportStaff,
      subject: 'Aluno nao recebeu email de compra',
      description: 'Validar notificacao de compra e reenvio do email transacional.',
      priority: SupportTicketPriority.HIGH,
      status: SupportTicketStatus.ASSIGNED,
    },
  });

  await tx.supportTicket.upsert({
    where: { id: ids.ticketPayout },
    update: {
      status: SupportTicketStatus.OPEN,
    },
    create: {
      id: ids.ticketPayout,
      tenantId: ids.tenant,
      subject: 'Empresa quer trocar chave Pix',
      description: 'Solicitacao de revisao documental antes da troca de chave Pix.',
      priority: SupportTicketPriority.MEDIUM,
      status: SupportTicketStatus.OPEN,
    },
  });

  await tx.platformFeePayout.upsert({
    where: { id: ids.payout },
    update: {
      amountCents: 2500,
      pixKeyType: PixKeyType.EMAIL,
      pixKey: 'financeiro@meetpoint.com',
      accountHolderName: 'MeetPoint Plataforma LTDA',
      accountDocument: '12.345.678/0001-90',
      status: PlatformPayoutStatus.REQUESTED,
    },
    create: {
      id: ids.payout,
      requestedByStaffId: ids.platformOwner,
      amountCents: 2500,
      pixKeyType: PixKeyType.EMAIL,
      pixKey: 'financeiro@meetpoint.com',
      accountHolderName: 'MeetPoint Plataforma LTDA',
      accountDocument: '12.345.678/0001-90',
      status: PlatformPayoutStatus.REQUESTED,
    },
  });
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
    await seedTenant(tx);
    await seedUsers(tx);
    await seedCourses(tx);
    await seedCourseContent(tx);
    await seedCommercialFlow(tx);
    await seedPlatformAdmin(tx);
    await seedSupportAndPayouts(tx);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
