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
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { JwtPayload } from './jwt.strategy';
import { JwtKeyService } from './jwt-key.service';
import { TokenRevocationService } from './token-revocation.service';
import { LoginDto } from './dto/login.dto';
import { PrivacyConsentDto } from './dto/privacy-consent.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailVerificationService } from './email-verification.service';

type ConsentMetadata = {
  ip?: string;
  userAgent?: string;
};

const ACTIVE_ACCOUNT_STATUS = 'ACTIVE';
const PENDING_PAYMENT_ACCOUNT_STATUS = 'PENDING_PAYMENT';
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
    private readonly emailVerificationService: EmailVerificationService,
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
  }) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      status: user.status,
      accountSegment: parseAccountSegmentFromBio(user.bio),
      companyLinks: parseCompanyLinksFromBio(user.bio),
      name: user.name ?? '',
      city: user.city ?? '',
      state: user.state ?? '',
      profileImage: user.profileImage ?? '',
      bio: stripAccountMetadata(user.bio),
      acceptedTerms: Boolean(user.acceptedTerms),
      acceptedPrivacyPolicy: Boolean(user.acceptedPrivacyPolicy),
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
  const match = bio?.match(/\[\[account-segment:([a-z-]+)\]\]/i);
  const value = match?.[1]?.toLowerCase?.() ?? '';
  if (['student', 'teacher', 'company', 'sponsor', 'ambassador', 'platform', 'employee'].includes(value)) {
    return value;
  }
  return 'student';
}

function parseCompanyLinksFromBio(bio: string | null | undefined) {
  const matches = [...(bio?.matchAll(/\[\[company-link:([^\]]+)\]\]/gi) ?? [])];
  return [...new Set(matches.map((match) => match[1]?.trim()).filter(Boolean))];
}

function stripAccountMetadata(bio: string | null | undefined) {
  return (bio ?? '')
    .replace(/\s*\[\[account-segment:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[company-link:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLoginAllowedStatus(status: string) {
  return status === ACTIVE_ACCOUNT_STATUS || status === PENDING_PAYMENT_ACCOUNT_STATUS;
}
