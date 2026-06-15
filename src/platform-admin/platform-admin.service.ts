import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  PlatformPayoutStatus,
  Prisma,
  SubscriptionStatus,
  SupportTicketStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import * as nodemailer from 'nodemailer';
import { DataMaskingService } from '../common/security/data-masking.service';
import { FieldEncryptionService } from '../common/security/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockUserDto } from './dto/block-user.dto';
import { CreateManagedAccountDto, type ManagedAccountSegment } from './dto/create-managed-account.dto';
import { CreatePlatformFeePayoutDto } from './dto/create-platform-fee-payout.dto';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ReplySupportTicketDto } from './dto/reply-support-ticket.dto';
import { UpdatePlatformStaffPermissionsDto } from './dto/update-platform-staff-permissions.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';

type DirectoryType = 'companies' | 'students' | 'teachers';
type SubscriptionDirectoryStatus =
  | 'all'
  | 'active'
  | 'pending'
  | 'inactive'
  | 'expiring'
  | 'expired'
  | 'cancelled'
  | 'suspended';
type AccessDirectoryStatus =
  | 'all'
  | 'online'
  | 'recent'
  | 'idle'
  | 'never'
  | 'blocked';
type ListSubscriptionsOptions = {
  status?: SubscriptionDirectoryStatus;
  search?: string;
  warningDays?: number;
};
type ListAccessesOptions = {
  status?: AccessDirectoryStatus;
  search?: string;
  onlineMinutes?: number;
  recentHours?: number;
};
const MANAGED_ACCOUNT_MAIN_MARKER = '[[managed-account:main]]';
const MANAGED_ACCOUNT_LINKED_MARKER = '[[managed-account:linked]]';
const MANAGED_ACCOUNT_SEGMENT_PREFIX = '[[managed-account-segment:';
const MANAGED_ACCOUNT_COMPANY_PREFIX = '[[managed-account-company:';
const MANAGED_ACCOUNT_PARENT_PREFIX = '[[managed-account-parent:';
const LEGACY_ACCOUNT_SEGMENT_PREFIX = '[[account-segment:';
const LEGACY_COMPANY_LINK_PREFIX = '[[company-link:';
const SUBSCRIPTION_WARNING_DAYS = 7;
const DAY_MS = 1000 * 60 * 60 * 24;
const ACCESS_ONLINE_WINDOW_MINUTES = 5;
const ACCESS_RECENT_WINDOW_HOURS = 24;

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataMasking: DataMaskingService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  async dashboard() {
    const [
      companies,
      students,
      teachers,
      courses,
      openTickets,
      blockedUsers,
      platformRevenue,
      platformPayouts,
    ] = await this.prisma.withPlatformAdmin((tx) =>
      Promise.all([
        tx.tenant.count(),
        tx.user.count({ where: { role: 'USER' } }),
        tx.user.count({ where: { role: 'ADMIN' } }),
        tx.course.count(),
        tx.supportTicket.count({
          where: { status: { in: ['OPEN', 'ASSIGNED'] } },
        }),
        tx.user.count({ where: { status: AccountStatus.BLOCKED } }),
        tx.courseSale.aggregate({
          where: { status: 'PAID' },
          _sum: { platformFeeCents: true, grossAmountCents: true },
        }),
        tx.platformFeePayout.aggregate({
          where: {
            status: {
              in: [
                PlatformPayoutStatus.REQUESTED,
                PlatformPayoutStatus.PROCESSING,
                PlatformPayoutStatus.PAID,
              ],
            },
          },
          _sum: { amountCents: true },
        }),
      ]),
    );
    const platformRevenueCents = platformRevenue._sum.platformFeeCents ?? 0;
    const platformPayoutsCents = platformPayouts._sum.amountCents ?? 0;

    return {
      companies,
      students,
      teachers,
      courses,
      openTickets,
      blockedUsers,
      grossSalesCents: platformRevenue._sum.grossAmountCents ?? 0,
      platformRevenueCents,
      platformPayoutsCents,
      platformAvailableBalanceCents: Math.max(
        platformRevenueCents - platformPayoutsCents,
        0,
      ),
    };
  }

  async listPlatformFeePayouts() {
    const payouts = await this.prisma.withPlatformAdmin((tx) =>
      tx.platformFeePayout.findMany({
        orderBy: { requestedAt: 'desc' },
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
        },
      }),
    );

    return payouts.map((payout) => ({
      ...payout,
      pixKey: this.maskEncryptedValue(payout.pixKey),
      accountDocument: this.maskEncryptedValue(payout.accountDocument),
      requestedBy: payout.requestedBy
        ? {
            ...payout.requestedBy,
            email: this.dataMasking.maskEmail(payout.requestedBy.email),
          }
        : null,
    }));
  }

  async listSubscriptions(options: ListSubscriptionsOptions = {}) {
    const query = options.search?.trim() ?? '';
    const status = options.status ?? 'all';
    const warningDays = Number.isFinite(options.warningDays)
      ? Math.min(Math.max(Math.trunc(options.warningDays ?? SUBSCRIPTION_WARNING_DAYS), 1), 90)
      : SUBSCRIPTION_WARNING_DAYS;
    const now = new Date();
    const warningLimit = addDays(now, warningDays);
    const statusWhere = buildSubscriptionStatusWhere(status, now, warningLimit);
    const searchWhere = query ? buildSubscriptionSearchWhere(query) : undefined;
    const where: Prisma.SubscriptionWhereInput = {
      AND: [statusWhere, searchWhere].filter(Boolean) as Prisma.SubscriptionWhereInput[],
    };

    return this.prisma.withPlatformAdmin(async (tx) => {
      const [
        subscriptions,
        filteredTotal,
        groupedByStatus,
        expiringSoon,
        withoutSubscription,
      ] = await Promise.all([
        tx.subscription.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 200,
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                billingCycle: true,
                isActive: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                city: true,
                state: true,
                role: true,
                status: true,
                bio: true,
                tenant: {
                  select: {
                    id: true,
                    name: true,
                    subdomain: true,
                  },
                },
              },
            },
          },
        }),
        tx.subscription.count({ where }),
        tx.subscription.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        tx.subscription.count({
          where: {
            status: SubscriptionStatus.ACTIVE,
            expiresAt: { gte: now, lte: warningLimit },
          },
        }),
        tx.user.count({
          where: {
            subscriptions: { none: {} },
          },
        }),
      ]);

      const statusCounts = groupedByStatus.reduce<Record<string, number>>(
        (accumulator, item) => ({
          ...accumulator,
          [item.status]: item._count._all,
        }),
        {},
      );
      const active = statusCounts[SubscriptionStatus.ACTIVE] ?? 0;
      const pending =
        (statusCounts[SubscriptionStatus.PENDING_PAYMENT] ?? 0) +
        (statusCounts[SubscriptionStatus.PAYMENT_PROCESSING] ?? 0);
      const inactive =
        (statusCounts[SubscriptionStatus.SUSPENDED] ?? 0) +
        (statusCounts[SubscriptionStatus.EXPIRED] ?? 0) +
        (statusCounts[SubscriptionStatus.CANCELLED] ?? 0);

      return {
        generatedAt: now.toISOString(),
        warningDays,
        filteredTotal,
        showing: subscriptions.length,
        summary: {
          total: groupedByStatus.reduce((total, item) => total + item._count._all, 0),
          active,
          pending,
          inactive,
          suspended: statusCounts[SubscriptionStatus.SUSPENDED] ?? 0,
          expired: statusCounts[SubscriptionStatus.EXPIRED] ?? 0,
          cancelled: statusCounts[SubscriptionStatus.CANCELLED] ?? 0,
          expiringSoon,
          withoutSubscription,
          byStatus: statusCounts,
        },
        items: subscriptions.map((subscription) => {
          const expirationDate = resolveSubscriptionExpirationDate(subscription);
          const daysRemaining = expirationDate
            ? Math.ceil((expirationDate.getTime() - now.getTime()) / DAY_MS)
            : null;
          const accountSegment =
            this.parseManagedAccountSegment(subscription.user.bio) ??
            (subscription.user.role === 'ADMIN' ? 'teacher' : 'student');
          const statusGroup = getSubscriptionStatusGroup(
            subscription.status,
            daysRemaining,
            warningDays,
          );

          return {
            id: subscription.id,
            status: subscription.status,
            statusGroup,
            paymentProvider: subscription.paymentProvider,
            externalSubscriptionId: subscription.externalSubscriptionId,
            checkoutAmountCents: subscription.checkoutAmountCents,
            checkoutBillingCycle: subscription.checkoutBillingCycle,
            transactionNsu: subscription.transactionNsu,
            receiptUrl: subscription.receiptUrl,
            startedAt: subscription.startedAt,
            paidAt: subscription.paidAt,
            expiresAt: expirationDate,
            renewalDate: subscription.renewalDate ?? expirationDate,
            cancelledAt: subscription.cancelledAt,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
            daysRemaining,
            daysUntilExpiration:
              typeof daysRemaining === 'number' ? Math.max(daysRemaining, 0) : null,
            daysOverdue:
              typeof daysRemaining === 'number' && daysRemaining < 0
                ? Math.abs(daysRemaining)
                : 0,
            isExpiringSoon: statusGroup === 'expiring',
            plan: {
              id: subscription.plan.id,
              name: subscription.plan.name,
              billingCycle: subscription.plan.billingCycle,
              priceCents: Math.round(Number(subscription.plan.price) * 100),
              isActive: subscription.plan.isActive,
            },
            user: {
              id: subscription.user.id,
              name: subscription.user.name,
              email: this.dataMasking.maskEmail(subscription.user.email),
              city: subscription.user.city,
              state: subscription.user.state,
              status: subscription.user.status,
              accountSegment,
              tenant: subscription.user.tenant,
            },
          };
        }),
      };
    });
  }

  async listAccesses(options: ListAccessesOptions = {}) {
    const query = options.search?.trim() ?? '';
    const status = options.status ?? 'all';
    const onlineMinutes = Number.isFinite(options.onlineMinutes)
      ? Math.min(Math.max(Math.trunc(options.onlineMinutes ?? ACCESS_ONLINE_WINDOW_MINUTES), 1), 120)
      : ACCESS_ONLINE_WINDOW_MINUTES;
    const recentHours = Number.isFinite(options.recentHours)
      ? Math.min(Math.max(Math.trunc(options.recentHours ?? ACCESS_RECENT_WINDOW_HOURS), 1), 168)
      : ACCESS_RECENT_WINDOW_HOURS;
    const now = new Date();
    const onlineSince = new Date(now.getTime() - onlineMinutes * 60_000);
    const recentSince = new Date(now.getTime() - recentHours * 60 * 60_000);
    const statusWhere = buildAccessStatusWhere(status, onlineSince, recentSince);
    const searchWhere = query ? buildAccessSearchWhere(query) : undefined;
    const where: Prisma.UserWhereInput = {
      AND: [statusWhere, searchWhere].filter(Boolean) as Prisma.UserWhereInput[],
    };

    return this.prisma.withPlatformAdmin(async (tx) => {
      const [
        users,
        filteredTotal,
        total,
        online,
        recent,
        idle,
        never,
        blocked,
      ] = await Promise.all([
        tx.user.findMany({
          where,
          orderBy: [
            { lastActivityAt: { sort: 'desc', nulls: 'last' } },
            { lastLoginAt: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' },
          ],
          take: 200,
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            tenantId: true,
            name: true,
            city: true,
            state: true,
            bio: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
            lastActivityAt: true,
            tenant: { select: { id: true, name: true, subdomain: true } },
          },
        }),
        tx.user.count({ where }),
        tx.user.count(),
        tx.user.count({ where: { lastActivityAt: { gte: onlineSince } } }),
        tx.user.count({ where: { lastActivityAt: { gte: recentSince } } }),
        tx.user.count({ where: { lastActivityAt: { lt: recentSince } } }),
        tx.user.count({ where: { lastActivityAt: null } }),
        tx.user.count({ where: { status: AccountStatus.BLOCKED } }),
      ]);

      return {
        generatedAt: now.toISOString(),
        onlineWindowMinutes: onlineMinutes,
        recentWindowHours: recentHours,
        filteredTotal,
        showing: users.length,
        summary: {
          total,
          online,
          recent,
          idle,
          never,
          blocked,
        },
        items: users.map((user) => {
          const lastActivityAt = user.lastActivityAt ?? user.lastLoginAt;
          const accountSegment =
            this.parseManagedAccountSegment(user.bio) ??
            (user.role === 'ADMIN' ? 'teacher' : 'student');
          const statusGroup = getAccessStatusGroup(
            user.status,
            lastActivityAt,
            onlineSince,
            recentSince,
          );
          const minutesSinceActivity = lastActivityAt
            ? Math.max(0, Math.floor((now.getTime() - lastActivityAt.getTime()) / 60_000))
            : null;

          return {
            id: user.id,
            name: user.name,
            email: this.dataMasking.maskEmail(user.email),
            accountSegment,
            status: user.status,
            statusGroup,
            city: user.city,
            state: user.state,
            tenant: user.tenant,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
            lastActivityAt,
            minutesSinceActivity,
            isOnline: statusGroup === 'online',
          };
        }),
      };
    });
  }

  async createManagedAccount(dto: CreateManagedAccountDto, actorStaffId?: string) {
    try {
      const segment = dto.segment;
      const normalizedEmail = dto.email.trim().toLowerCase();
      const normalizedName = dto.name.trim();
      const normalizedCity = dto.city.trim();
      const normalizedState = dto.state.trim().toUpperCase();
      const normalizedCompanyName = dto.companyName?.trim() ?? '';
      const normalizedReason = dto.reason?.trim() ?? '';
      const linkedPeople = (dto.linkedPeople ?? [])
        .map((person) => ({
          name: person.name.trim(),
          email: person.email.trim().toLowerCase(),
          password: person.password.trim(),
        }))
        .filter((person) => person.name && person.email && person.password);

      if (!normalizedName || !normalizedEmail || !normalizedCity || !normalizedState) {
        throw new BadRequestException('Nome, email, cidade e estado sao obrigatorios');
      }
      if (segment === 'company' && !normalizedCompanyName) {
        throw new BadRequestException('Empresa exige nome da organizacao');
      }

      const tenant =
        segment === 'company'
          ? await this.createCompanyTenant(normalizedCompanyName || normalizedName)
          : await this.resolveDefaultTenant();
      const requestedEmails = [normalizedEmail, ...linkedPeople.map((person) => person.email)];
      const duplicatedPayloadEmail = requestedEmails.find(
        (email, index) => requestedEmails.indexOf(email) !== index,
      );
      if (duplicatedPayloadEmail) {
        throw new ConflictException(
          `O email ${duplicatedPayloadEmail} foi informado mais de uma vez`,
        );
      }
      const existingUser = await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          email: { in: requestedEmails },
        },
        select: { email: true, bio: true },
      });
      if (existingUser) {
        const accountOrigin = this.isManagedAccount(existingUser.bio)
          ? 'criada pelo admin'
          : 'já existente';
        throw new ConflictException(
          `O email ${existingUser.email} já está cadastrado como conta ${accountOrigin}. Use outro email ou edite a conta existente.`,
        );
      }
      const [passwordHash, linkedPasswordHashes] = await Promise.all([
        hash(dto.password, 12),
        Promise.all(linkedPeople.map((person) => hash(person.password, 12))),
      ]);
      const bio = this.decorateManagedAccountBio(
        [
          normalizedReason ? `Origem administrativa: ${normalizedReason}` : '',
          normalizedCompanyName ? `Organizacao: ${normalizedCompanyName}` : '',
          'Conta criada pelo admin com cortesia administrativa.',
        ].filter(Boolean).join(' '),
        segment,
        normalizedCompanyName,
      );

      const result = await this.prisma.withPlatformAdmin(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: normalizedEmail,
            contactEmailVerifiedAt: new Date(),
            password: passwordHash,
            passwordHash,
            role: 'USER',
            status: AccountStatus.ACTIVE,
            name: normalizedName,
            city: normalizedCity,
            state: normalizedState,
            bio,
            acceptedTerms: true,
            acceptedPrivacyPolicy: true,
          },
          select: {
            id: true,
            email: true,
            role: true,
            tenantId: true,
            status: true,
            name: true,
            city: true,
            state: true,
            bio: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
            tenant: { select: { id: true, name: true, subdomain: true } },
          },
        });

        const linkedUsers = await Promise.all(
          linkedPeople.map((person, index) =>
            tx.user.create({
              data: {
                tenantId: tenant.id,
                email: person.email,
                contactEmailVerifiedAt: new Date(),
                password: linkedPasswordHashes[index],
                passwordHash: linkedPasswordHashes[index],
                role: 'USER',
                status: AccountStatus.ACTIVE,
                name: person.name,
                city: normalizedCity,
                state: normalizedState,
                bio: this.decorateManagedLinkedBio(
                  `Vinculado a ${normalizedCompanyName || normalizedName}.`,
                  normalizedCompanyName || normalizedName,
                  user.id,
                ),
                acceptedTerms: true,
                acceptedPrivacyPolicy: true,
              },
              select: {
                id: true,
                email: true,
                name: true,
                status: true,
                tenantId: true,
                bio: true,
                createdAt: true,
              },
            }),
          ),
        );

        await this.audit(tx, {
          actorStaffId,
          action: 'MANAGED_ACCOUNT_CREATED',
          targetType: 'User',
          targetId: user.id,
          metadata: {
            segment,
            email: this.dataMasking.maskEmail(normalizedEmail),
            companyName: normalizedCompanyName,
            grantFreeAccess: true,
            linkedPeopleCount: linkedUsers.length,
          },
        });

        return { user, linkedUsers };
      });

      const credentialEmails = await this.sendManagedAccountCredentialEmails([
        {
          email: normalizedEmail,
          name: normalizedName,
          password: dto.password,
          segment,
        },
        ...linkedPeople.map((person) => ({
          email: person.email,
          name: person.name,
          password: person.password,
          segment: 'employee' as const,
          companyName: normalizedCompanyName || normalizedName,
        })),
      ]);

      return {
        ...result.user,
        email: this.dataMasking.maskEmail(result.user.email),
        accountSegment: segment,
        credentialEmails,
        linkedPeople: result.linkedUsers.map((person) => ({
          ...person,
          email: this.dataMasking.maskEmail(person.email),
        })),
      };
    } catch (error) {
      if (isPrismaKnownRequestError(error, 'P2002')) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : 'campo único';
        throw new ConflictException(
          `Já existe uma conta com esses dados (${target}). Use outro email ou edite a conta existente.`,
        );
      }
      throw error;
    }
  }

  async listManagedAccounts(search = '') {
    const query = search.trim();

    return this.prisma.withPlatformAdmin(async (tx) => {
      const managedAccounts = await tx.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { bio: { contains: MANAGED_ACCOUNT_MAIN_MARKER } },
                { bio: { contains: LEGACY_ACCOUNT_SEGMENT_PREFIX } },
              ],
            },
            ...(query
              ? [{
                  OR: [
                    { name: { contains: query, mode: 'insensitive' as const } },
                    { email: { contains: query, mode: 'insensitive' as const } },
                    { city: { contains: query, mode: 'insensitive' as const } },
                    { state: { contains: query, mode: 'insensitive' as const } },
                    { bio: { contains: query, mode: 'insensitive' as const } },
                    { tenant: { name: { contains: query, mode: 'insensitive' as const } } },
                  ],
                }]
              : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          tenantId: true,
          name: true,
          city: true,
          state: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          tenant: { select: { id: true, name: true, subdomain: true } },
        },
      });

      const managedLinkedUsers = await tx.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { bio: { contains: MANAGED_ACCOUNT_LINKED_MARKER } },
                { bio: { contains: LEGACY_COMPANY_LINK_PREFIX } },
              ],
            },
            ...(query
              ? [{
                  OR: [
                    { name: { contains: query, mode: 'insensitive' as const } },
                    { email: { contains: query, mode: 'insensitive' as const } },
                    { city: { contains: query, mode: 'insensitive' as const } },
                    { state: { contains: query, mode: 'insensitive' as const } },
                    { bio: { contains: query, mode: 'insensitive' as const } },
                    { tenant: { name: { contains: query, mode: 'insensitive' as const } } },
                  ],
                }]
              : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          tenantId: true,
          name: true,
          city: true,
          state: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          tenant: { select: { id: true, name: true, subdomain: true } },
        },
      });

      const mainAccounts = managedAccounts
        .filter((user) => this.isManagedMainAccount(user.bio))
        .map((user) => {
        const accountSegment = this.parseManagedAccountSegment(user.bio) ?? 'student';
        const companyName = this.parseManagedAccountCompanyName(user.bio) ?? '';
        const linkedPeople = managedLinkedUsers.filter((linkedUser) => {
          const parentId = this.parseManagedAccountParentId(linkedUser.bio);
          if (parentId === user.id) return true;
          return Boolean(
            companyName &&
              linkedUser.bio?.includes(
                `${LEGACY_COMPANY_LINK_PREFIX}${companyName}]]`,
              ),
          );
        });

        return {
          ...user,
          email: this.dataMasking.maskEmail(user.email),
          accountSegment,
          companyName,
          linkedPeopleCount: linkedPeople.length,
          linkedPeople: linkedPeople.map((person) => ({
            id: person.id,
            name: person.name,
            email: this.dataMasking.maskEmail(person.email),
            status: person.status,
            createdAt: person.createdAt,
          })),
          permissions: this.getManagedAccountPermissions(accountSegment),
        };
      });

      return mainAccounts;
    });
  }

  async resendManagedAccountAccess(userId: string, actorStaffId?: string) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          status: true,
          bio: true,
          tenant: { select: { id: true, name: true, subdomain: true } },
        },
      });

      if (!user || !this.isManagedAccount(user.bio)) {
        throw new NotFoundException('Managed account not found');
      }

      const password = this.generateTemporaryPassword();
      const passwordHash = await hash(password, 12);

      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          passwordHash,
          status: AccountStatus.ACTIVE,
          contactEmailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          status: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
          tenant: { select: { id: true, name: true, subdomain: true } },
        },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'MANAGED_ACCOUNT_ACCESS_RESENT',
        targetType: 'User',
        targetId: updated.id,
        metadata: {
          email: this.dataMasking.maskEmail(updated.email),
          accountSegment: this.parseManagedAccountSegment(updated.bio),
        },
      });

      await this.sendManagedAccountCredentialEmail({
        email: updated.email,
        name: updated.name,
        password,
        segment: this.parseManagedAccountSegment(updated.bio) ?? 'student',
        companyName: this.parseManagedAccountCompanyName(updated.bio) ?? undefined,
      });

      return {
        ...updated,
        email: this.dataMasking.maskEmail(updated.email),
        accountSegment: this.parseManagedAccountSegment(updated.bio) ?? 'student',
      };
    });
  }

  async deleteManagedAccount(userId: string, actorStaffId?: string) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, bio: true, tenantId: true },
      });

      if (!user || !this.isManagedAccount(user.bio)) {
        throw new NotFoundException('Managed account not found');
      }

      const companyName = this.parseManagedAccountCompanyName(user.bio);
      const linkedUsers = await tx.user.findMany({
        where: {
          OR: [
            { bio: { contains: `[[managed-account-parent:${user.id}]]` } },
            ...(companyName
              ? [{ bio: { contains: `${LEGACY_COMPANY_LINK_PREFIX}${companyName}]]` } }]
              : []),
          ],
        },
        select: { id: true },
      });

      if (linkedUsers.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: linkedUsers.map((person) => person.id) } },
        });
      }

      await this.deleteUserCascade(tx, user.id);

      await this.audit(tx, {
        actorStaffId,
        action: 'MANAGED_ACCOUNT_DELETED',
        targetType: 'User',
        targetId: user.id,
        metadata: {
          email: this.dataMasking.maskEmail(user.email),
          linkedPeopleDeleted: linkedUsers.length,
        },
      });

      return {
        deleted: true,
        id: user.id,
        email: this.dataMasking.maskEmail(user.email),
        linkedPeopleDeleted: linkedUsers.length,
      };
    });
  }

  async deleteCompanyTenant(tenantId: string, actorStaffId?: string) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, subdomain: true, createdAt: true },
      });

      if (!tenant) {
        throw new NotFoundException('Company not found');
      }

      const tenantUsers = await tx.user.findMany({
        where: { tenantId },
        select: { id: true },
      });
      for (const tenantUser of tenantUsers) {
        await this.deleteUserCascade(tx, tenantUser.id);
      }

      await tx.tenant.delete({
        where: { id: tenantId },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'COMPANY_DELETED',
        targetType: 'Tenant',
        targetId: tenantId,
        metadata: {
          name: tenant.name,
          subdomain: tenant.subdomain,
        },
      });

      return {
        deleted: true,
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      };
    });
  }

  async createPlatformFeePayout(
    dto: CreatePlatformFeePayoutDto,
    actorStaffId?: string,
  ) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const [platformRevenue, platformPayouts, actorStaff] = await Promise.all([
        tx.courseSale.aggregate({
          where: { status: 'PAID' },
          _sum: { platformFeeCents: true },
        }),
        tx.platformFeePayout.aggregate({
          where: {
            status: {
              in: [
                PlatformPayoutStatus.REQUESTED,
                PlatformPayoutStatus.PROCESSING,
                PlatformPayoutStatus.PAID,
              ],
            },
          },
          _sum: { amountCents: true },
        }),
        actorStaffId
          ? tx.platformStaff.findUnique({ where: { id: actorStaffId } })
          : Promise.resolve(null),
      ]);

      const availableBalanceCents =
        (platformRevenue._sum.platformFeeCents ?? 0) -
        (platformPayouts._sum.amountCents ?? 0);

      if (dto.amountCents > availableBalanceCents) {
        throw new BadRequestException('Insufficient platform fee balance');
      }

      const payout = await tx.platformFeePayout.create({
        data: {
          requestedByStaffId: actorStaff?.id,
          amountCents: dto.amountCents,
          pixKeyType: dto.pixKeyType,
          pixKey: this.fieldEncryption.encryptString(dto.pixKey) ?? '',
          accountHolderName: dto.accountHolderName,
          accountDocument: this.fieldEncryption.encryptString(dto.accountDocument),
        },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'PLATFORM_FEE_PIX_PAYOUT_REQUESTED',
        targetType: 'PlatformFeePayout',
        targetId: payout.id,
        metadata: {
          amountCents: dto.amountCents,
          pixKeyType: dto.pixKeyType,
          accountHolderName: dto.accountHolderName,
          pixKey: '[encrypted]',
        },
      });

      return {
        ...payout,
        pixKey: this.maskEncryptedValue(payout.pixKey),
        accountDocument: this.maskEncryptedValue(payout.accountDocument),
      };
    });
  }

  listDirectory(type: DirectoryType, search = '') {
    const query = search.trim();
    if (type === 'companies') {
      return this.prisma.withPlatformAdmin((tx) => this.listCompanies(tx, query));
    }
    if (type === 'students') {
      return this.prisma.withPlatformAdmin((tx) =>
        this.listUsers(tx, 'USER', query),
      );
    }
    if (type === 'teachers') {
      return this.prisma.withPlatformAdmin((tx) =>
        this.listUsers(tx, 'ADMIN', query),
      );
    }
    throw new BadRequestException('Invalid directory type');
  }

  listStaff() {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const staff = await tx.platformStaff.findMany({
        orderBy: { createdAt: 'desc' },
        include: { permissions: true },
      });

      return staff.map((member) => ({
        ...member,
        email: this.dataMasking.maskEmail(member.email),
      }));
    });
  }

  async createStaff(dto: CreatePlatformStaffDto, actorStaffId?: string) {
    const staff = await this.prisma.withPlatformAdmin(async (tx) => {
      const created = await tx.platformStaff.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          emailHash: this.fieldEncryption.hashForLookup(dto.email, 'email'),
          emailEncrypted: this.fieldEncryption.encryptString(dto.email),
          role: dto.role ?? 'SUPPORT',
          permissions: {
            createMany: {
              data: dto.permissions.map((permission) => ({ permission })),
              skipDuplicates: true,
            },
          },
        },
        include: { permissions: true },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'PLATFORM_STAFF_CREATED',
        targetType: 'PlatformStaff',
        targetId: created.id,
        metadata: {
          email: this.dataMasking.maskEmail(created.email),
          permissions: dto.permissions,
        },
      });

      return { ...created, email: this.dataMasking.maskEmail(created.email) };
    });

    return staff;
  }

  async updateStaffPermissions(
    staffId: string,
    dto: UpdatePlatformStaffPermissionsDto,
    actorStaffId?: string,
  ) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const existing = await tx.platformStaff.findUnique({
        where: { id: staffId },
      });
      if (!existing) throw new NotFoundException('Platform staff not found');

      await tx.platformStaffPermission.deleteMany({ where: { staffId } });
      const updated = await tx.platformStaff.update({
        where: { id: staffId },
        data: {
          isActive: dto.isActive ?? existing.isActive,
          permissions: {
            createMany: {
              data: dto.permissions.map((permission) => ({ permission })),
              skipDuplicates: true,
            },
          },
        },
        include: { permissions: true },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'PLATFORM_STAFF_PERMISSIONS_UPDATED',
        targetType: 'PlatformStaff',
        targetId: staffId,
        metadata: { permissions: dto.permissions, isActive: updated.isActive },
      });

      return { ...updated, email: this.dataMasking.maskEmail(updated.email) };
    });
  }

  async createTicket(dto: CreateSupportTicketDto) {
    const ticket = await this.prisma.withPlatformAdmin((tx) =>
      tx.supportTicket.create({
        data: {
          subject: this.dataMasking.sanitizeText(dto.subject) ?? dto.subject,
          description: this.fieldEncryption.encryptString(dto.description) ?? '',
          priority: dto.priority ?? 'MEDIUM',
          tenantId: dto.tenantId,
          userId: dto.userId,
        },
      }),
    );

    return this.maskSupportTicket(ticket);
  }

  async listTickets(status?: SupportTicketStatus) {
    const tickets = await this.prisma.withPlatformAdmin((tx) => tx.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        user: { select: { id: true, email: true, role: true, status: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    }));

    return tickets.map((ticket) => this.maskSupportTicket(ticket));
  }

  async assumeTicket(ticketId: string, actorStaffId: string) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const staff = await tx.platformStaff.findUnique({
        where: { id: actorStaffId },
      });
      if (!staff || !staff.isActive) {
        throw new BadRequestException('Active platform staff is required');
      }

      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          assignedToId: actorStaffId,
          status: 'ASSIGNED',
        },
        include: { assignedTo: true },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'SUPPORT_TICKET_ASSIGNED',
        targetType: 'SupportTicket',
        targetId: ticketId,
        metadata: { subject: updated.subject },
      });

      return this.maskSupportTicket(updated);
    });
  }

  async replyTicket(
    ticketId: string,
    dto: ReplySupportTicketDto,
    actorStaffId?: string,
  ) {
    const safeMessage = this.dataMasking.sanitizeText(dto.message)?.trim();
    if (!safeMessage) throw new BadRequestException('Reply message is required');

    const result = await this.prisma.withPlatformAdmin(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          user: { select: { email: true } },
          tenant: { select: { name: true } },
        },
      });
      if (!ticket) throw new NotFoundException('Support ticket not found');

      const requesterEmail =
        this.fieldEncryption.decryptString(ticket.requesterEmailEncrypted) ||
        ticket.user?.email ||
        null;
      const previousDescription =
        this.fieldEncryption.decryptString(ticket.description) ?? '';
      const replyEntry = [
        previousDescription,
        '',
        `[Resposta do suporte - ${new Date().toISOString()}]`,
        safeMessage,
      ].filter(Boolean).join('\n');
      const assignee = actorStaffId
        ? await tx.platformStaff.findUnique({
            where: { id: actorStaffId },
            select: { id: true },
          })
        : null;
      const updateData = {
        description: this.fieldEncryption.encryptString(replyEntry),
        status: ticket.status === 'OPEN' ? 'ASSIGNED' : ticket.status,
        ...(ticket.assignedToId || !assignee?.id
          ? {}
          : { assignedToId: assignee.id }),
      };

      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          tenant: { select: { id: true, name: true, subdomain: true } },
          user: { select: { id: true, email: true, role: true, status: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'SUPPORT_TICKET_REPLIED',
        targetType: 'SupportTicket',
        targetId: ticketId,
        metadata: {
          notifiedByEmail: Boolean(requesterEmail),
          subject: ticket.subject,
        },
      });

      return {
        ticket: updated,
        requesterEmail,
        tenantName: ticket.tenant?.name,
      };
    });

    const emailDelivery = await this.sendSupportReplyEmail({
      to: result.requesterEmail,
      subject: result.ticket.subject,
      message: safeMessage,
      tenantName: result.tenantName,
    });

    return {
      ticket: this.maskSupportTicket(result.ticket),
      notification: emailDelivery,
    };
  }

  async updateTicketStatus(
    ticketId: string,
    dto: UpdateSupportTicketStatusDto,
    actorStaffId?: string,
  ) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: dto.status,
          resolvedAt:
            dto.status === 'RESOLVED' || dto.status === 'CLOSED'
              ? new Date()
              : null,
        },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'SUPPORT_TICKET_STATUS_UPDATED',
        targetType: 'SupportTicket',
        targetId: ticketId,
        metadata: { status: dto.status },
      });

      return this.maskSupportTicket(updated);
    });
  }

  async blockUser(userId: string, dto: BlockUserDto, actorStaffId?: string) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.BLOCKED,
          blockedAt: new Date(),
          blockedReason: this.dataMasking.sanitizeText(dto.reason),
        },
        select: {
          id: true,
          email: true,
          role: true,
          tenantId: true,
          status: true,
          blockedAt: true,
          blockedReason: true,
        },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'USER_BLOCKED',
        targetType: 'User',
        targetId: userId,
        metadata: {
          reason: this.dataMasking.sanitizeText(dto.reason),
          tenantId: user.tenantId,
        },
      });

      return { ...updated, email: this.dataMasking.maskEmail(updated.email) };
    });
  }

  async unblockUser(userId: string, actorStaffId?: string) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.ACTIVE,
          blockedAt: null,
          blockedReason: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
          tenantId: true,
          status: true,
        },
      });

      await this.audit(tx, {
        actorStaffId,
        action: 'USER_UNBLOCKED',
        targetType: 'User',
        targetId: userId,
        metadata: { tenantId: user.tenantId },
      });

      return { ...updated, email: this.dataMasking.maskEmail(updated.email) };
    });
  }

  async deleteUser(userId: string, actorStaffId?: string) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, tenantId: true, role: true },
      });
      if (!user) throw new NotFoundException('User not found');

      await this.deleteUserCascade(tx, userId);

      await this.audit(tx, {
        actorStaffId,
        action: 'USER_DELETED',
        targetType: 'User',
        targetId: userId,
        metadata: {
          email: this.dataMasking.maskEmail(user.email),
          tenantId: user.tenantId,
          role: user.role,
        },
      });

      return {
        deleted: true,
        id: userId,
        email: this.dataMasking.maskEmail(user.email),
      };
    });
  }

  private async deleteUserCascade(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    await tx.subscriptionAuditLog.deleteMany({ where: { userId } });
    await tx.subscription.deleteMany({ where: { userId } });
    await tx.paymentWebhookEvent.deleteMany({ where: { userId } });
    await tx.paymentCheckout.deleteMany({ where: { userId } });
    await tx.courseSale.deleteMany({ where: { userId } });
    await tx.certificate.deleteMany({ where: { userId } });
    await tx.lessonProgress.deleteMany({ where: { userId } });
    await tx.enrollment.deleteMany({ where: { userId } });
    await tx.userPrivacyConsent.deleteMany({ where: { userId } });
    await tx.termsConsent.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  }

  private listCompanies(tx: Prisma.TransactionClient, search: string) {
    return tx.tenant.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { subdomain: { contains: search, mode: 'insensitive' } },
              {
                users: {
                  some: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                      { city: { contains: search, mode: 'insensitive' } },
                      { state: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            courses: true,
            supportTickets: true,
          },
        },
      },
    });
  }

  private async createCompanyTenant(name: string) {
    const baseSubdomain = this.slugify(name);
    const subdomain = await this.resolveUniqueSubdomain(baseSubdomain);

    return this.prisma.tenant.create({
      data: {
        name,
        subdomain,
      },
    });
  }

  private async resolveDefaultTenant() {
    const subdomain = process.env.DEFAULT_TENANT_SUBDOMAIN?.trim() || 'meetpoint';
    const name = process.env.DEFAULT_TENANT_NAME?.trim() || 'MeetPoint';

    return this.prisma.tenant.upsert({
      where: { subdomain },
      update: {},
      create: { subdomain, name },
    });
  }

  private async resolveUniqueSubdomain(baseSubdomain: string) {
    const fallback = baseSubdomain || 'empresa';
    let candidate = fallback;
    let counter = 1;
    while (await this.prisma.tenant.findUnique({ where: { subdomain: candidate } })) {
      candidate = `${fallback}-${counter++}`;
    }
    return candidate;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  private decorateManagedAccountBio(
    bio: string,
    segment: ManagedAccountSegment,
    companyName = '',
  ) {
    const cleanedBio = bio.trim();
    const markers = [
      MANAGED_ACCOUNT_MAIN_MARKER,
      `${MANAGED_ACCOUNT_SEGMENT_PREFIX}${segment}]]`,
      companyName
        ? `${MANAGED_ACCOUNT_COMPANY_PREFIX}${this.normalizeManagedAccountMarkerValue(companyName)}]]`
        : '',
    ].filter(Boolean);

    return `${cleanedBio} ${markers.join(' ')}`.trim();
  }

  private decorateManagedLinkedBio(
    bio: string,
    companyName: string,
    parentUserId: string,
  ) {
    const cleanedBio = bio.trim();
    const markers = [
      MANAGED_ACCOUNT_LINKED_MARKER,
      `${MANAGED_ACCOUNT_SEGMENT_PREFIX}student]]`,
      `${MANAGED_ACCOUNT_COMPANY_PREFIX}${this.normalizeManagedAccountMarkerValue(companyName)}]]`,
      `${MANAGED_ACCOUNT_PARENT_PREFIX}${parentUserId}]]`,
    ];

    return `${cleanedBio} ${markers.join(' ')}`.trim();
  }

  private isManagedAccount(bio: string | null | undefined) {
    return Boolean(
      bio?.includes(MANAGED_ACCOUNT_MAIN_MARKER) ||
        bio?.includes(MANAGED_ACCOUNT_LINKED_MARKER) ||
        bio?.includes(LEGACY_ACCOUNT_SEGMENT_PREFIX),
    );
  }

  private isManagedMainAccount(bio: string | null | undefined) {
    if (!bio) return false;
    if (bio.includes(MANAGED_ACCOUNT_MAIN_MARKER)) return true;
    return (
      bio.includes(LEGACY_ACCOUNT_SEGMENT_PREFIX) &&
      !bio.includes(LEGACY_COMPANY_LINK_PREFIX)
    );
  }

  private parseManagedAccountSegment(
    bio: string | null | undefined,
  ): ManagedAccountSegment | null {
    const match =
      bio?.match(/\[\[managed-account-segment:([^\]]+)\]\]/) ??
      bio?.match(/\[\[account-segment:([^\]]+)\]\]/);
    const segment = match?.[1];
    if (
      segment === 'student' ||
      segment === 'teacher' ||
      segment === 'company' ||
      segment === 'sponsor' ||
      segment === 'ambassador'
    ) {
      return segment;
    }
    return null;
  }

  private parseManagedAccountCompanyName(bio: string | null | undefined) {
    const match =
      bio?.match(/\[\[managed-account-company:([^\]]+)\]\]/) ??
      bio?.match(/\[\[company-link:([^\]]+)\]\]/);
    if (match?.[1]) return match[1].trim();

    const legacyTextMatch = bio?.match(/Organizacao:\s*([^.[\]]+)/i);
    return legacyTextMatch?.[1]?.trim() ?? null;
  }

  private parseManagedAccountParentId(bio: string | null | undefined) {
    const match = bio?.match(/\[\[managed-account-parent:([^\]]+)\]\]/);
    return match?.[1]?.trim() ?? null;
  }

  private normalizeManagedAccountMarkerValue(value: string) {
    return value.replace(/\]\]/g, '').replace(/\[/g, '').trim();
  }

  private generateTemporaryPassword() {
    const token = randomBytes(9)
      .toString('base64url')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 12);
    return `Mp${token}7!`;
  }

  private getManagedAccountPermissions(segment: ManagedAccountSegment) {
    if (segment === 'sponsor') {
      return ['Divulgar benefícios', 'Patrocínios', 'Relacionamento comercial'];
    }
    if (segment === 'ambassador') {
      return ['Divulgar MeetPoint', 'Indicações', 'Comunidades e eventos'];
    }
    if (segment === 'company') {
      return ['Conta empresa', 'Publicar vagas', 'Solicitar benefícios'];
    }
    if (segment === 'teacher') {
      return ['Conta PJ', 'Publicar cursos', 'Publicar eventos'];
    }
    return ['Conta PF', 'Acesso de cortesia'];
  }

  private async listUsers(
    tx: Prisma.TransactionClient,
    role: 'ADMIN' | 'USER',
    search: string,
  ) {
    const users = await tx.user.findMany({
      where: {
        role,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { state: { contains: search, mode: 'insensitive' } },
                { tenant: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        city: true,
        state: true,
        role: true,
        status: true,
        tenantId: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, subdomain: true } },
        _count: {
          select: {
            enrollments: true,
            supportTickets: true,
          },
        },
      },
    });

    return users.map((user) => ({
      ...user,
      email: this.dataMasking.maskEmail(user.email),
    }));
  }

  private audit(
    tx: Prisma.TransactionClient,
    data: {
      actorStaffId?: string;
      action: string;
      targetType: string;
      targetId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return this.createAuditLog(tx, data);
  }

  private async sendManagedAccountCredentialEmails(
    recipients: Array<{
      email: string;
      name: string;
      password: string;
      segment: ManagedAccountSegment | 'employee';
      companyName?: string;
    }>,
  ) {
    const deliveries = await Promise.allSettled(
      recipients.map((recipient) => this.sendManagedAccountCredentialEmail(recipient)),
    );

    return recipients.map((recipient, index) => {
      const delivery = deliveries[index];
      const sent = delivery?.status === 'fulfilled';
      const failureReason =
        delivery?.status === 'rejected'
          ? this.getMailFailureReason(delivery.reason)
          : undefined;

      if (!sent) {
        this.logger.error(
          `Managed account credential email failed for ${this.dataMasking.maskEmail(recipient.email)}: ${failureReason}`,
          delivery?.status === 'rejected' && delivery.reason instanceof Error
            ? delivery.reason.stack
            : undefined,
        );
      }

      return {
        email: this.dataMasking.maskEmail(recipient.email),
        sent,
        failureReason,
      };
    });
  }

  private async sendManagedAccountCredentialEmail(recipient: {
    email: string;
    name: string;
    password: string;
    segment: ManagedAccountSegment | 'employee';
    companyName?: string;
  }) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from =
      process.env.SMTP_FROM?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      'MeetPoint <no-reply@meetpoint.com>';

    if (!host || !user || !pass) {
      throw new Error('SMTP is not configured for managed account credential email');
    }

    const accessUrl =
      process.env.MEETPOINT_FRONTEND_URL?.trim() ||
      process.env.FRONTEND_URL?.trim() ||
      'https://novalab.me/meetpoint/';
    const segmentLabel =
      recipient.segment === 'employee'
        ? `pessoa vinculada${recipient.companyName ? ` a ${recipient.companyName}` : ''}`
        : this.getManagedAccountSegmentLabel(recipient.segment);
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === 'true';

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid SMTP_PORT: ${process.env.SMTP_PORT ?? ''}`);
    }
    if ((port === 465 && !secure) || (port === 587 && secure)) {
      throw new Error(
        `Invalid SMTP encryption combination: port ${port} requires SMTP_SECURE=${port === 465 ? 'true' : 'false'}`,
      );
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: process.env.SMTP_REQUIRE_TLS?.trim().toLowerCase() === 'true',
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      auth: { user, pass },
    });

    try {
      const result = await transport.sendMail({
        from,
        to: recipient.email,
        subject: 'Seu acesso MeetPoint foi criado',
        text: [
          `Ola, ${recipient.name}.`,
          '',
          `Uma conta ${segmentLabel} foi criada para voce pela administracao da MeetPoint.`,
          '',
          `Acesso: ${accessUrl}`,
          `Login: ${recipient.email}`,
          `Senha temporaria: ${recipient.password}`,
          '',
          'Por seguranca, altere a senha no primeiro acesso ou solicite troca ao suporte se nao reconhecer essa criacao.',
          '',
          'MeetPoint',
        ].join('\n'),
        html: this.buildManagedAccountCredentialEmailHtml({
          accessUrl,
          email: recipient.email,
          name: recipient.name,
          password: recipient.password,
          segmentLabel,
        }),
      });

      if (!result.accepted?.length || result.rejected?.length) {
        throw new Error(
          `SMTP did not accept recipient. Accepted: ${result.accepted?.length ?? 0}; rejected: ${result.rejected?.length ?? 0}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `SMTP send failed. host=${host} port=${port} secure=${secure} user=${this.dataMasking.maskEmail(user)} from=${from} recipient=${this.dataMasking.maskEmail(recipient.email)} reason=${this.getMailFailureReason(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      transport.close();
    }
  }

  private getMailFailureReason(error: unknown) {
    if (!error || typeof error !== 'object') {
      return String(error ?? 'unknown SMTP error');
    }

    const smtpError = error as {
      code?: string;
      command?: string;
      response?: string;
      responseCode?: number;
      message?: string;
    };
    return [
      smtpError.code && `code=${smtpError.code}`,
      smtpError.command && `command=${smtpError.command}`,
      smtpError.responseCode && `responseCode=${smtpError.responseCode}`,
      smtpError.response && `response=${smtpError.response}`,
      smtpError.message && `message=${smtpError.message}`,
    ]
      .filter(Boolean)
      .join(' | ') || 'unknown SMTP error';
  }

  private async sendSupportReplyEmail(params: {
    to: string | null;
    subject: string;
    message: string;
    tenantName?: string;
  }) {
    if (!params.to) {
      return { sent: false, reason: 'ticket_without_requester_email' };
    }

    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from =
      process.env.SMTP_FROM?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      'MeetPoint <no-reply@meetpoint.com>';

    if (!host || !user || !pass) {
      return { sent: false, reason: 'smtp_not_configured' };
    }

    const accessUrl =
      process.env.MEETPOINT_FRONTEND_URL?.trim() ||
      process.env.FRONTEND_URL?.trim() ||
      'https://novalab.me/meetpoint/';
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE?.trim().toLowerCase() === 'true',
      auth: { user, pass },
    });

    await transport.sendMail({
      from,
      to: params.to,
      subject: 'O suporte MeetPoint respondeu seu atendimento',
      text: [
        'O suporte MeetPoint respondeu seu atendimento.',
        '',
        `Ticket: ${params.subject}`,
        params.tenantName ? `Conta: ${params.tenantName}` : '',
        '',
        params.message,
        '',
        `Acesse: ${accessUrl}`,
      ].filter(Boolean).join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;background:#fffaf0;padding:28px;color:#111318">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6dcc5;border-radius:18px;padding:28px">
            <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px">
              <span style="display:inline-grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#f4ce55;font-weight:900">MP</span>
              <strong style="font-size:22px">MeetPoint</strong>
            </div>
            <h1 style="font-size:24px;line-height:1.15;margin:0 0 12px">O suporte respondeu seu atendimento</h1>
            <p style="font-size:15px;line-height:1.5;margin:0 0 16px"><strong>Ticket:</strong> ${escapeHtml(params.subject)}</p>
            <div style="background:#fff3c7;border:2px solid #111318;border-radius:14px;padding:18px;margin-bottom:18px">
              ${escapeHtml(params.message).replace(/\n/g, '<br>')}
            </div>
            <a href="${escapeHtml(accessUrl)}" style="display:inline-block;background:#111318;color:#fff8dc;text-decoration:none;border-radius:999px;padding:13px 18px;font-weight:900">Abrir MeetPoint</a>
          </div>
        </div>
      `,
    });

    return {
      sent: true,
      to: this.dataMasking.maskEmail(params.to),
    };
  }

  private getManagedAccountSegmentLabel(segment: ManagedAccountSegment) {
    if (segment === 'student') return 'Pessoa Fisica';
    if (segment === 'teacher') return 'Pessoa Juridica';
    if (segment === 'company') return 'Empresa';
    if (segment === 'sponsor') return 'Patrocinador';
    return 'Embaixador';
  }

  private buildManagedAccountCredentialEmailHtml(params: {
    accessUrl: string;
    email: string;
    name: string;
    password: string;
    segmentLabel: string;
  }) {
    return `
      <div style="font-family:Arial,sans-serif;background:#fffaf0;padding:28px;color:#111318">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6dcc5;border-radius:18px;padding:28px">
          <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px">
            <span style="display:inline-grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#f4ce55;font-weight:900">MP</span>
            <strong style="font-size:22px">MeetPoint</strong>
          </div>
          <h1 style="font-size:26px;line-height:1.1;margin:0 0 12px">Seu acesso foi criado</h1>
          <p style="font-size:16px;line-height:1.5;margin:0 0 18px">Ola, ${escapeHtml(params.name)}. Uma conta ${escapeHtml(params.segmentLabel)} foi criada para voce pela administracao da MeetPoint.</p>
          <div style="background:#fff3c7;border:2px solid #111318;border-radius:14px;padding:18px;margin-bottom:18px">
            <p style="margin:0 0 10px"><strong>Acesso:</strong> <a href="${escapeHtml(params.accessUrl)}">${escapeHtml(params.accessUrl)}</a></p>
            <p style="margin:0 0 10px"><strong>Login:</strong> ${escapeHtml(params.email)}</p>
            <p style="margin:0"><strong>Senha temporaria:</strong> ${escapeHtml(params.password)}</p>
          </div>
          <p style="font-size:14px;line-height:1.5;margin:0;color:#4b5563">Por seguranca, altere a senha no primeiro acesso ou solicite troca ao suporte se nao reconhecer essa criacao.</p>
        </div>
      </div>
    `;
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    data: {
      actorStaffId?: string;
      action: string;
      targetType: string;
      targetId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const actorStaff = data.actorStaffId
      ? await tx.platformStaff.findUnique({ where: { id: data.actorStaffId } })
      : null;

    return tx.platformAuditLog.create({
      data: {
        actorStaffId: actorStaff?.id,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: this.dataMasking.redactObject(
          data.metadata,
        ) as Prisma.InputJsonValue,
        metadataEncrypted: this.fieldEncryption.encryptString(
          JSON.stringify(this.dataMasking.redactObject(data.metadata ?? {})),
        ),
      },
    });
  }

  private maskEncryptedValue(value: string | null | undefined) {
    const decrypted = this.fieldEncryption.decryptString(value);
    if (!decrypted) return decrypted ?? null;
    if (decrypted.includes('@')) return this.dataMasking.maskEmail(decrypted);
    if (/\d/.test(decrypted)) return this.dataMasking.maskDocument(decrypted);
    return '[protected]';
  }

  private maskSupportTicket<
    T extends {
      description?: string | null;
      requesterEmailEncrypted?: string | null;
      requesterIpEncrypted?: string | null;
      requesterGeoEncrypted?: string | null;
      user?: { email?: string | null } | null;
      assignedTo?: { email?: string | null } | null;
    },
  >(ticket: T) {
    const decryptedDescription = this.fieldEncryption.decryptString(
      ticket.description,
    );

    return {
      ...ticket,
      description: this.dataMasking.redactText(decryptedDescription) ?? '',
      requesterEmailEncrypted: this.maskEncryptedValue(
        ticket.requesterEmailEncrypted,
      ),
      requesterIpEncrypted: ticket.requesterIpEncrypted ? '[protected]' : null,
      requesterGeoEncrypted: ticket.requesterGeoEncrypted ? '[protected]' : null,
      user: ticket.user
        ? {
            ...ticket.user,
            email: this.dataMasking.maskEmail(ticket.user.email),
          }
        : ticket.user,
      assignedTo: ticket.assignedTo
        ? {
            ...ticket.assignedTo,
            email: this.dataMasking.maskEmail(ticket.assignedTo.email),
          }
        : ticket.assignedTo,
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildSubscriptionStatusWhere(
  status: SubscriptionDirectoryStatus,
  now: Date,
  warningLimit: Date,
): Prisma.SubscriptionWhereInput {
  if (status === 'all') return {};
  if (status === 'active') return { status: SubscriptionStatus.ACTIVE };
  if (status === 'pending') {
    return {
      status: {
        in: [
          SubscriptionStatus.PENDING_PAYMENT,
          SubscriptionStatus.PAYMENT_PROCESSING,
        ],
      },
    };
  }
  if (status === 'inactive') {
    return {
      status: {
        in: [
          SubscriptionStatus.SUSPENDED,
          SubscriptionStatus.EXPIRED,
          SubscriptionStatus.CANCELLED,
        ],
      },
    };
  }
  if (status === 'expiring') {
    return {
      status: SubscriptionStatus.ACTIVE,
      expiresAt: { gte: now, lte: warningLimit },
    };
  }
  if (status === 'expired') {
    return {
      OR: [
        { status: SubscriptionStatus.EXPIRED },
        { status: SubscriptionStatus.ACTIVE, expiresAt: { lt: now } },
      ],
    };
  }
  if (status === 'cancelled') return { status: SubscriptionStatus.CANCELLED };
  if (status === 'suspended') return { status: SubscriptionStatus.SUSPENDED };

  throw new BadRequestException('Invalid subscription status filter');
}

function buildSubscriptionSearchWhere(search: string): Prisma.SubscriptionWhereInput {
  return {
    OR: [
      { externalSubscriptionId: { contains: search, mode: 'insensitive' } },
      { transactionNsu: { contains: search, mode: 'insensitive' } },
      { paymentProvider: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { city: { contains: search, mode: 'insensitive' } } },
      { user: { state: { contains: search, mode: 'insensitive' } } },
      { user: { tenant: { name: { contains: search, mode: 'insensitive' } } } },
      { plan: { name: { contains: search, mode: 'insensitive' } } },
      { plan: { billingCycle: { contains: search, mode: 'insensitive' } } },
    ],
  };
}

function getSubscriptionStatusGroup(
  status: SubscriptionStatus,
  daysRemaining: number | null,
  warningDays: number,
) {
  if (
    status === SubscriptionStatus.ACTIVE &&
    typeof daysRemaining === 'number' &&
    daysRemaining >= 0 &&
    daysRemaining <= warningDays
  ) {
    return 'expiring';
  }
  if (
    status === SubscriptionStatus.PENDING_PAYMENT ||
    status === SubscriptionStatus.PAYMENT_PROCESSING
  ) {
    return 'pending';
  }
  if (status === SubscriptionStatus.ACTIVE) {
    return typeof daysRemaining === 'number' && daysRemaining < 0
      ? 'expired'
      : 'active';
  }
  if (status === SubscriptionStatus.EXPIRED) return 'expired';
  return 'inactive';
}

function resolveSubscriptionExpirationDate(subscription: {
  status: SubscriptionStatus;
  startedAt: Date | null;
  expiresAt: Date | null;
  renewalDate: Date | null;
  checkoutBillingCycle: string | null;
  plan: { billingCycle: string };
}) {
  if (subscription.expiresAt) return subscription.expiresAt;
  if (subscription.renewalDate) return subscription.renewalDate;
  if (!subscription.startedAt) return null;
  if (
    subscription.status !== SubscriptionStatus.ACTIVE &&
    subscription.status !== SubscriptionStatus.SUSPENDED
  ) {
    return null;
  }
  return addDays(
    subscription.startedAt,
    getAdminBillingCycleDays(
      subscription.checkoutBillingCycle ?? subscription.plan.billingCycle,
    ),
  );
}

function buildAccessStatusWhere(
  status: AccessDirectoryStatus,
  onlineSince: Date,
  recentSince: Date,
): Prisma.UserWhereInput {
  if (status === 'all') return {};
  if (status === 'online') return { lastActivityAt: { gte: onlineSince } };
  if (status === 'recent') return { lastActivityAt: { gte: recentSince } };
  if (status === 'idle') return { lastActivityAt: { lt: recentSince } };
  if (status === 'never') return { lastActivityAt: null };
  if (status === 'blocked') return { status: AccountStatus.BLOCKED };

  throw new BadRequestException('Invalid access status filter');
}

function buildAccessSearchWhere(search: string): Prisma.UserWhereInput {
  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { state: { contains: search, mode: 'insensitive' } },
      { bio: { contains: search, mode: 'insensitive' } },
      { tenant: { name: { contains: search, mode: 'insensitive' } } },
      { tenant: { subdomain: { contains: search, mode: 'insensitive' } } },
    ],
  };
}

function getAccessStatusGroup(
  accountStatus: AccountStatus,
  lastActivityAt: Date | null,
  onlineSince: Date,
  recentSince: Date,
) {
  if (accountStatus === AccountStatus.BLOCKED) return 'blocked';
  if (!lastActivityAt) return 'never';
  if (lastActivityAt >= onlineSince) return 'online';
  if (lastActivityAt >= recentSince) return 'recent';
  return 'idle';
}

function getAdminBillingCycleDays(billingCycle: string) {
  if (billingCycle === 'annual') return 365;
  if (billingCycle === 'semiannual') return 180;
  return 30;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isPrismaKnownRequestError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'clientVersion' in error)
  ) && (error as { code?: string }).code === code;
}
