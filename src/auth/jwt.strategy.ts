import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtKeyService } from './jwt-key.service';
import { TokenRevocationService } from './token-revocation.service';

export type JwtPayload = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'USER';
  tenantId?: string;
  platformRole?: 'OWNER' | 'SUPPORT' | 'OPERATIONS' | 'MAINTENANCE';
  jti?: string;
  exp?: number;
  iat?: number;
};

const ACTIVITY_WRITE_THROTTLE_MS = 60_000;
const activityWriteCache = new Map<string, number>();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly jwtKeyService: JwtKeyService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        jwtFromHttpOnlyCookie,
      ]),
      ignoreExpiration: false,
      algorithms: [jwtKeyService.getAlgorithm()],
      issuer: jwtKeyService.getIssuer(),
      audience: jwtKeyService.getAudience(),
      passReqToCallback: true,
      secretOrKeyProvider: (_request, rawToken, done) => {
        try {
          const header = decodeJwtHeader(rawToken);
          if (header.alg === 'none' || header.alg !== jwtKeyService.getAlgorithm()) {
            throw new Error('JWT algorithm is not trusted');
          }
          done(null, jwtKeyService.getVerificationKey(header.kid));
        } catch (error) {
          done(error, undefined);
        }
      },
    });
  }

  async validate(_request: Request, payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.email || !payload.role || !payload.jti) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    if (await this.tokenRevocationService.isRevoked(payload.jti)) {
      throw new UnauthorizedException('JWT has been revoked');
    }
    void this.touchUserActivity(payload.sub);
    return payload;
  }

  private async touchUserActivity(userId: string) {
    const nowMs = Date.now();
    const lastWrite = activityWriteCache.get(userId) ?? 0;
    if (nowMs - lastWrite < ACTIVITY_WRITE_THROTTLE_MS) return;

    activityWriteCache.set(userId, nowMs);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActivityAt: new Date(nowMs) },
      });
    } catch {
      activityWriteCache.delete(userId);
    }
  }
}

function decodeJwtHeader(rawToken: string | null | undefined) {
  if (!rawToken) throw new Error('Missing JWT');
  const [headerRaw] = rawToken.split('.');
  if (!headerRaw) throw new Error('Missing JWT header');

  return JSON.parse(Buffer.from(headerRaw, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
}

function jwtFromHttpOnlyCookie(request: Request) {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) return null;

  const tokenCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('access_token='));

  if (!tokenCookie) return null;

  return decodeURIComponent(tokenCookie.slice('access_token='.length));
}
