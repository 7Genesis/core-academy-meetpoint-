import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  PlatformPayoutStatus,
  Prisma,
  SupportTicketStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { DataMaskingService } from '../common/security/data-masking.service';
import { FieldEncryptionService } from '../common/security/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockUserDto } from './dto/block-user.dto';
import { CreateManagedAccountDto, type ManagedAccountSegment } from './dto/create-managed-account.dto';
import { CreatePlatformFeePayoutDto } from './dto/create-platform-fee-payout.dto';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdatePlatformStaffPermissionsDto } from './dto/update-platform-staff-permissions.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';

type DirectoryType = 'companies' | 'students' | 'teachers';

@Injectable()
export class PlatformAdminService {
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

  async createManagedAccount(dto: CreateManagedAccountDto, actorStaffId?: string) {
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
    const [passwordHash, linkedPasswordHashes] = await Promise.all([
      hash(dto.password, 12),
      Promise.all(linkedPeople.map((person) => hash(person.password, 12))),
    ]);
    const bio = this.decorateAccountBio(
      [
        normalizedReason ? `Origem administrativa: ${normalizedReason}` : '',
        normalizedCompanyName ? `Organizacao: ${normalizedCompanyName}` : '',
        'Conta criada pelo admin com cortesia administrativa.',
      ].filter(Boolean).join(' '),
      segment,
    );

    const result = await this.prisma.withPlatformAdmin(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          contactEmailVerifiedAt: new Date(),
          password: dto.password,
          passwordHash,
          role: segment === 'company' ? 'USER' : 'USER',
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
              bio: this.decorateLinkedPersonBio(
                `Vinculado a ${normalizedCompanyName || normalizedName}.`,
                normalizedCompanyName || normalizedName,
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

    return {
      ...result.user,
      email: this.dataMasking.maskEmail(result.user.email),
      accountSegment: segment,
      linkedPeople: result.linkedUsers.map((person) => ({
        ...person,
        email: this.dataMasking.maskEmail(person.email),
      })),
    };
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

  private listCompanies(tx: Prisma.TransactionClient, search: string) {
    return tx.tenant.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { subdomain: { contains: search, mode: 'insensitive' } },
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

  private decorateAccountBio(bio: string, segment: ManagedAccountSegment) {
    const marker = `[[account-segment:${segment}]]`;
    const cleanedBio = bio.trim();
    if (!cleanedBio) return marker;
    return cleanedBio.includes(marker) ? cleanedBio : `${cleanedBio} ${marker}`.trim();
  }

  private decorateLinkedPersonBio(bio: string, companyName: string) {
    const segmentMarker = '[[account-segment:student]]';
    const companyMarker = `[[company-link:${companyName.replace(/\]/g, '')}]]`;
    return `${bio.trim()} ${segmentMarker} ${companyMarker}`.trim();
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
                { email: { contains: search, mode: 'insensitive' } },
                { tenant: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
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
