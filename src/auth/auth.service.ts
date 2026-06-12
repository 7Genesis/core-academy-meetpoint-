import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { AccountStatus, FriendRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FieldEncryptionService } from '../common/security/field-encryption.service';
import { JwtPayload } from './jwt.strategy';
import { JwtKeyService } from './jwt-key.service';
import { TokenRevocationService } from './token-revocation.service';
import { LoginDto } from './dto/login.dto';
import { PrivacyConsentDto } from './dto/privacy-consent.dto';
import { RegisterDto } from './dto/register.dto';
import { ContactNotificationService } from './contact-notification.service';
import { EmailVerificationService } from './email-verification.service';

type ConsentMetadata = {
  ip?: string;
  userAgent?: string;
};

const ACTIVE_ACCOUNT_STATUS = AccountStatus.ACTIVE;
const PENDING_PAYMENT_ACCOUNT_STATUS = AccountStatus.PENDING_PAYMENT;
const DISCOVERABLE_ACCOUNT_STATUSES = [
  ACTIVE_ACCOUNT_STATUS,
  PENDING_PAYMENT_ACCOUNT_STATUS,
  AccountStatus.PAYMENT_PROCESSING,
];
const DUMMY_BCRYPT_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8rLOHWfQ2PqR4QEc9Rtv1P3J9G/6nW';
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtKeyService: JwtKeyService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly contactNotificationService: ContactNotificationService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly fieldEncryptionService: FieldEncryptionService,
  ) {}

  async register(dto: RegisterDto, consentMetadata: ConsentMetadata = {}) {
    const normalizedName = dto.name.trim();
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedCity = dto.city.trim();
    const normalizedState = dto.state.trim().toUpperCase();

    if (!normalizedName || normalizedName.length < 3) {
      throw new BadRequestException('Name must contain at least 3 characters');
    }
    if (!normalizedCity || normalizedCity.length < 2) {
      throw new BadRequestException('City is required');
    }
    if (!normalizedState || normalizedState.length < 2) {
      throw new BadRequestException('State is required');
    }
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException('Password confirmation does not match');
    }
    if (!dto.acceptedTerms || !dto.acceptedPrivacyPolicy) {
      throw new BadRequestException('Terms and privacy policy must be accepted');
    }

    const tenant = await this.resolveDefaultTenant();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const normalizedPhone = normalizePhone(dto.phone);
    const phoneHash = this.fieldEncryptionService.hashForLookup(normalizedPhone, 'phone');
    const existingPhone = phoneHash
      ? await this.prisma.user.findFirst({
          where: { tenantId: tenant.id, contactPhoneHash: phoneHash },
          select: { id: true },
        })
      : null;

    if (existingPhone) {
      throw new ConflictException('Phone is already registered');
    }

    await this.emailVerificationService.consumeRegistrationCode(
      normalizedEmail,
      dto.emailVerificationCode,
    );

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: normalizedEmail,
        contactEmailVerifiedAt: new Date(),
        contactPhoneHash: phoneHash,
        contactPhoneEncrypted: this.fieldEncryptionService.encryptString(normalizedPhone),
        password: passwordHash,
        passwordHash,
        role: 'USER',
        status: PENDING_PAYMENT_ACCOUNT_STATUS,
        name: normalizedName,
        city: normalizedCity,
        state: normalizedState,
        profileImage: dto.profileImage?.trim() || null,
        bio: this.decorateAccountBio(dto.bio?.trim() || '', 'student'),
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      },
    });

    const termsConsent = await this.recordTermsConsent(
      user.id,
      dto.termsVersion ?? 'meetpoint-terms-current',
      consentMetadata,
    );
    const privacyConsent = await this.recordPrivacyConsent(
      user.id,
      {
        termsVersion: dto.termsVersion ?? 'meetpoint-terms-current',
        privacyVersion: dto.privacyVersion ?? 'meetpoint-privacy-current',
        consentType: 'registration',
      },
      consentMetadata,
    );

    await this.contactNotificationService.notifyRegistrationPendingPayment({
      email: normalizedEmail,
      name: normalizedName,
      phone: normalizedPhone,
    });

    return {
      user: this.toPublicUser(user),
      termsConsent,
      privacyConsent,
    };
  }

  async login(dto: LoginDto, consentMetadata: ConsentMetadata = {}) {
    if (
      !dto.termsAccepted
      || !dto.termsVersion?.trim()
      || !dto.privacyVersion?.trim()
      || !dto.consentType?.trim()
    ) {
      throw new BadRequestException('Privacy consent is required');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (!user) {
      await compare(dto.password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.verifyPassword(
      dto.password,
      user.passwordHash ?? user.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const platformStaff = await this.findActivePlatformStaff(normalizedEmail);
    const subscriptionState = await this.subscriptionsService.getCurrentSubscription(user.id);
    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!refreshedUser || !isLoginAllowedStatus(refreshedUser.status)) {
      throw new ForbiddenException('Account is not active');
    }

    const profile = {
      ...this.toPublicUser(refreshedUser),
      ...(platformStaff ? { platformRole: platformStaff.role } : {}),
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const termsConsent = await this.recordTermsConsent(user.id, dto.termsVersion, consentMetadata);
    const privacyConsent = await this.recordPrivacyConsent(user.id, dto, consentMetadata);

    return {
      accessToken: this.issueAccessToken(profile),
      user: {
        ...profile,
        subscription: subscriptionState.subscription,
        subscriptionActive: subscriptionState.active,
        subscriptionStatus: subscriptionState.status,
        subscriptionWarning: subscriptionState.warning,
        subscriptionShouldBlockAccount: subscriptionState.shouldBlockAccount,
        subscriptionLifecycle: subscriptionState.lifecycle,
      },
      termsConsent,
      privacyConsent,
    };
  }

  async getAuthenticatedUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Authenticated user is not active');
    }

    const subscriptionState = await this.subscriptionsService.getCurrentSubscription(user.id);
    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!refreshedUser || !isLoginAllowedStatus(refreshedUser.status)) {
      throw new UnauthorizedException('Authenticated user is not active');
    }

    return {
      accessToken: this.issueAccessToken({
        ...this.toPublicUser(refreshedUser),
        ...(payload.platformRole ? { platformRole: payload.platformRole } : {}),
      }),
      user: {
        ...this.toPublicUser(refreshedUser),
        ...(payload.platformRole ? { platformRole: payload.platformRole } : {}),
        subscription: subscriptionState.subscription,
        subscriptionActive: subscriptionState.active,
        subscriptionStatus: subscriptionState.status,
        subscriptionWarning: subscriptionState.warning,
        subscriptionShouldBlockAccount: subscriptionState.shouldBlockAccount,
        subscriptionLifecycle: subscriptionState.lifecycle,
      },
    };
  }

  async searchPeople(payload: JwtPayload, search = '') {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tenantId: true },
    });
    const tenantId = payload.tenantId ?? currentUser?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Authenticated user tenant is required');
    }

    const query = search.trim().slice(0, 80);
    const users = await this.prisma.withTenant(tenantId, async (tx) =>
      tx.user.findMany({
        where: {
          tenantId,
          id: { not: payload.sub },
          status: { in: DISCOVERABLE_ACCOUNT_STATUSES },
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' as const } },
                  { email: { contains: query, mode: 'insensitive' as const } },
                  { city: { contains: query, mode: 'insensitive' as const } },
                  { state: { contains: query, mode: 'insensitive' as const } },
                  { bio: { contains: query, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: query ? 20 : 12,
        select: {
          id: true,
          email: true,
          name: true,
          city: true,
          state: true,
          profileImage: true,
          bio: true,
          createdAt: true,
        },
      }),
    );

    const userIds = users.map((user) => user.id);
    const [
      followerCounts,
      followingCounts,
      acceptedFriendRequests,
      currentFollowing,
      sentRequests,
      incomingRequests,
      currentFriendRequests,
    ] = userIds.length
      ? await this.prisma.withPlatformAdmin((tx) =>
          Promise.all([
            tx.userFollow.groupBy({
              by: ['followingId'],
              where: { followingId: { in: userIds } },
              _count: { _all: true },
            }),
            tx.userFollow.groupBy({
              by: ['followerId'],
              where: { followerId: { in: userIds } },
              _count: { _all: true },
            }),
            tx.friendRequest.findMany({
              where: {
                status: FriendRequestStatus.ACCEPTED,
                OR: [
                  { requesterId: { in: userIds } },
                  { recipientId: { in: userIds } },
                ],
              },
              select: { requesterId: true, recipientId: true },
            }),
            tx.userFollow.findMany({
              where: { followerId: payload.sub, followingId: { in: userIds } },
              select: { followingId: true },
            }),
            tx.friendRequest.findMany({
              where: {
                requesterId: payload.sub,
                recipientId: { in: userIds },
                status: FriendRequestStatus.PENDING,
              },
              select: { recipientId: true },
            }),
            tx.friendRequest.findMany({
              where: {
                requesterId: { in: userIds },
                recipientId: payload.sub,
                status: FriendRequestStatus.PENDING,
              },
              select: { requesterId: true },
            }),
            tx.friendRequest.findMany({
              where: {
                status: FriendRequestStatus.ACCEPTED,
                OR: [
                  { requesterId: payload.sub, recipientId: { in: userIds } },
                  { requesterId: { in: userIds }, recipientId: payload.sub },
                ],
              },
              select: { requesterId: true, recipientId: true },
            }),
          ]),
        )
      : [[], [], [], [], [], [], []];

    const followerCountByUser = new Map(
      followerCounts.map((item) => [item.followingId, item._count._all]),
    );
    const followingCountByUser = new Map(
      followingCounts.map((item) => [item.followerId, item._count._all]),
    );
    const friendCountByUser = new Map<string, number>();
    acceptedFriendRequests.forEach((request) => {
      if (userIds.includes(request.requesterId)) {
        friendCountByUser.set(
          request.requesterId,
          (friendCountByUser.get(request.requesterId) ?? 0) + 1,
        );
      }
      if (userIds.includes(request.recipientId)) {
        friendCountByUser.set(
          request.recipientId,
          (friendCountByUser.get(request.recipientId) ?? 0) + 1,
        );
      }
    });
    const followingIds = new Set(currentFollowing.map((item) => item.followingId));
    const sentRequestIds = new Set(sentRequests.map((item) => item.recipientId));
    const incomingRequestIds = new Set(incomingRequests.map((item) => item.requesterId));
    const friendIds = new Set(
      currentFriendRequests.map((request) =>
        request.requesterId === payload.sub ? request.recipientId : request.requesterId,
      ),
    );

    return users.map((user) => ({
      id: user.id,
      name: user.name || 'Perfil MeetPoint',
      handle: buildPublicHandle(user.name, user.email, user.id),
      initials: buildInitials(user.name || user.email),
      city: [user.city, user.state].filter(Boolean).join(', ') || 'MeetPoint',
      bio: stripAccountMetadata(user.bio) || 'Perfil cadastrado na plataforma.',
      photo: user.profileImage ?? '',
      accountSegment: parseAccountSegmentFromBio(user.bio),
      createdAt: user.createdAt,
      followers: followerCountByUser.get(user.id) ?? 0,
      following: followingCountByUser.get(user.id) ?? 0,
      friends: friendCountByUser.get(user.id) ?? 0,
      isFollowing: followingIds.has(user.id),
      friendRequestSent: sentRequestIds.has(user.id),
      incomingFriendRequest: incomingRequestIds.has(user.id),
      isFriend: friendIds.has(user.id),
    }));
  }

  private issueAccessToken(profile: {
    sub: string;
    email: string;
    role: 'ADMIN' | 'USER';
    tenantId?: string;
    platformRole?: 'OWNER' | 'SUPPORT' | 'OPERATIONS' | 'MAINTENANCE';
  }) {
    return this.jwtService.sign(
      {
        sub: profile.sub,
        email: profile.email,
        role: profile.role,
        tenantId: profile.tenantId,
        ...(profile.platformRole ? { platformRole: profile.platformRole } : {}),
      },
      {
        ...this.jwtKeyService.getSignOptions(),
        jwtid: randomUUID(),
      },
    );
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'USER';
    tenantId: string;
    status: string;
    name?: string | null;
    city?: string | null;
    state?: string | null;
    profileImage?: string | null;
    bio?: string | null;
    acceptedTerms?: boolean | null;
    acceptedPrivacyPolicy?: boolean | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    lastLoginAt?: Date | null;
    contactPhoneVerifiedAt?: Date | null;
  }) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      status: user.status,
      accountSegment: parseAccountSegmentFromBio(user.bio),
      adminGrantedAccess: hasManagedAccountAccess(user.bio),
      companyLinks: parseCompanyLinksFromBio(user.bio),
      name: user.name ?? '',
      city: user.city ?? '',
      state: user.state ?? '',
      profileImage: user.profileImage ?? '',
      bio: stripAccountMetadata(user.bio),
      acceptedTerms: Boolean(user.acceptedTerms),
      acceptedPrivacyPolicy: Boolean(user.acceptedPrivacyPolicy),
      phoneVerified: Boolean(user.contactPhoneVerifiedAt),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
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

  private decorateAccountBio(bio: string, segment: string) {
    const marker = buildAccountSegmentMarker(segment);
    const cleanedBio = bio.trim();
    if (!cleanedBio) return marker;
    return cleanedBio.includes(marker) ? cleanedBio : `${cleanedBio} ${marker}`.trim();
  }

  private findActivePlatformStaff(email: string) {
    const normalizedEmail = email.toLowerCase();
    return this.prisma.withPlatformAdmin((tx) =>
      tx.platformStaff.findFirst({
        where: {
          isActive: true,
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
        select: { id: true, role: true, isActive: true },
      }),
    ).then((staff) => (staff?.isActive ? staff : null));
  }

  private async verifyPassword(plainPassword: string, storedHash: string) {
    if (!storedHash?.startsWith('$2')) {
      await compare(plainPassword, DUMMY_BCRYPT_HASH);
      return false;
    }

    return compare(plainPassword, storedHash);
  }

  private async recordTermsConsent(
    userId: string,
    termsVersion: string,
    metadata: ConsentMetadata,
  ) {
    const consent = {
      userId,
      termsVersion: termsVersion.trim(),
      acceptedAt: new Date(),
      ip: metadata.ip ?? '',
      userAgent: metadata.userAgent ?? '',
    };

    try {
      const stored = await (this.prisma as unknown as {
        termsConsent?: {
          create: (args: { data: typeof consent }) => Promise<typeof consent & { id: string }>;
        };
      }).termsConsent?.create({ data: consent });

      return stored ?? consent;
    } catch {
      return consent;
    }
  }

  private async recordPrivacyConsent(
    userId: string,
    dto: Pick<LoginDto, 'termsVersion' | 'privacyVersion' | 'consentType'> & {
      accepted?: boolean;
      country?: string;
    },
    metadata: ConsentMetadata,
  ) {
    const consent = {
      userId,
      termsVersion: dto.termsVersion.trim(),
      privacyVersion: dto.privacyVersion.trim(),
      consentType: dto.consentType.trim(),
      accepted: dto.accepted ?? true,
      acceptedAt: dto.accepted === false ? null : new Date(),
      ipAddress: metadata.ip ?? '',
      userAgent: metadata.userAgent ?? '',
      country: dto.country ?? '',
    };

    try {
      const stored = await (this.prisma as unknown as {
        userPrivacyConsent?: {
          create: (args: { data: typeof consent }) => Promise<typeof consent & { id: string }>;
        };
      }).userPrivacyConsent?.create({ data: consent });

      return stored ?? consent;
    } catch {
      return consent;
    }
  }

  async acceptPrivacyConsent(
    userId: string,
    dto: PrivacyConsentDto,
    metadata: ConsentMetadata,
  ) {
    if (!dto.accepted) {
      throw new BadRequestException('Privacy consent must be accepted');
    }

    return this.recordPrivacyConsent(userId, dto, metadata);
  }

  async logout(user?: Pick<JwtPayload, 'jti' | 'exp'>) {
    await this.tokenRevocationService.revokeJti(user?.jti, user?.exp);
    return { ok: true };
  }

  jwks() {
    return this.jwtKeyService.getJwks();
  }
}

function buildAccountSegmentMarker(segment: string) {
  return `[[account-segment:${segment}]]`;
}

function parseAccountSegmentFromBio(bio: string | null | undefined) {
  const match =
    bio?.match(/\[\[managed-account-segment:([a-z-]+)\]\]/i) ??
    bio?.match(/\[\[account-segment:([a-z-]+)\]\]/i);
  const value = match?.[1]?.toLowerCase?.() ?? '';
  if (['student', 'teacher', 'company', 'sponsor', 'ambassador', 'platform', 'employee'].includes(value)) {
    return value;
  }
  return 'student';
}

function hasManagedAccountAccess(bio: string | null | undefined) {
  return /\[\[managed-account:(main|linked)\]\]/i.test(bio ?? '');
}

function parseCompanyLinksFromBio(bio: string | null | undefined) {
  const matches = [...(bio?.matchAll(/\[\[company-link:([^\]]+)\]\]/gi) ?? [])];
  return [...new Set(matches.map((match) => match[1]?.trim()).filter(Boolean))];
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  let normalized = '';

  if (digits.length === 10 || digits.length === 11) {
    normalized = `+55${digits}`;
  } else if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    normalized = `+${digits}`;
  } else if (digits.length >= 10 && digits.length <= 15) {
    normalized = `+${digits}`;
  }

  if (!/^\+\d{10,15}$/.test(normalized)) {
    throw new BadRequestException('Valid WhatsApp phone is required');
  }

  return normalized;
}

function stripAccountMetadata(bio: string | null | undefined) {
  return (bio ?? '')
    .replace(/\s*Origem administrativa:\s*[^.]+\.?/gi, ' ')
    .replace(/\s*Organizacao:\s*[^.]+\.?/gi, ' ')
    .replace(/\s*Conta criada pelo admin com cortesia administrativa\.?/gi, ' ')
    .replace(/\s*\[\[managed-account:(main|linked)\]\]\s*/gi, ' ')
    .replace(/\s*\[\[managed-account-segment:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[managed-account-company:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[managed-account-parent:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[account-segment:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[company-link:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPublicHandle(name: string | null | undefined, email: string, id: string) {
  const source = name?.trim() || email.split('@')[0] || 'perfil';
  const slug = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
  return `@${slug || 'perfil'}${id.slice(0, 4)}`;
}

function buildInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'MP';
}

function isLoginAllowedStatus(status: string) {
  return status === ACTIVE_ACCOUNT_STATUS || status === PENDING_PAYMENT_ACCOUNT_STATUS;
}
