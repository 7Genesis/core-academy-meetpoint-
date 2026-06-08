import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtSignOptions } from '@nestjs/jwt';
import { createPublicKey } from 'node:crypto';

export type SupportedJwtAlgorithm = 'RS256' | 'HS256';

@Injectable()
export class JwtKeyService {
  private readonly algorithm: SupportedJwtAlgorithm;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly kid: string;
  private readonly privateKeyOrSecret: string;
  private readonly publicKeyOrSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.algorithm = this.resolveAlgorithm();
    this.issuer = this.configService.get<string>('JWT_ISSUER') ?? 'meetpoint-api';
    this.audience =
      this.configService.get<string>('JWT_AUDIENCE') ?? 'meetpoint-clients';
    this.kid = this.configService.get<string>('JWT_KID') ?? 'local-dev-key';

    if (this.algorithm === 'RS256') {
      this.privateKeyOrSecret = this.normalizePem(
        this.configService.get<string>('JWT_PRIVATE_KEY'),
      );
      this.publicKeyOrSecret = this.normalizePem(
        this.configService.get<string>('JWT_PUBLIC_KEY'),
      );
      return;
    }

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException('JWT_SECRET is required in production');
    }
    if (!secret) {
      console.warn('Runtime configuration warning: JWT_SECRET is missing.');
    }
    this.privateKeyOrSecret = secret ?? this.getCompatibilitySecret();
    this.publicKeyOrSecret = this.privateKeyOrSecret;
  }

  getCurrentKid() {
    return this.kid;
  }

  getAlgorithm() {
    return this.algorithm;
  }

  getIssuer() {
    return this.issuer;
  }

  getAudience() {
    return this.audience;
  }

  getSigningKey() {
    return this.privateKeyOrSecret;
  }

  getVerificationKey(kid?: string) {
    if (this.algorithm === 'RS256' && kid && kid !== this.kid) {
      throw new Error('JWT kid is not trusted');
    }
    return this.publicKeyOrSecret;
  }

  getSignOptions(): JwtSignOptions {
    return {
      algorithm: this.algorithm,
      issuer: this.issuer,
      audience: this.audience,
      expiresIn: '8h',
      keyid: this.kid,
    };
  }

  getJwks() {
    if (this.algorithm !== 'RS256') {
      return { keys: [] };
    }

    const jwk = createPublicKey(this.publicKeyOrSecret).export({
      format: 'jwk',
    }) as Record<string, unknown>;

    return {
      keys: [
        {
          ...jwk,
          kid: this.kid,
          alg: this.algorithm,
          use: 'sig',
          key_ops: ['verify'],
        },
      ],
    };
  }

  private resolveAlgorithm(): SupportedJwtAlgorithm {
    const configuredAlgorithm =
      this.configService.get<SupportedJwtAlgorithm>('JWT_ALGORITHM');
    const hasAsymmetricKeys =
      !!this.configService.get<string>('JWT_PRIVATE_KEY') &&
      !!this.configService.get<string>('JWT_PUBLIC_KEY');

    if (configuredAlgorithm) {
      if (!['RS256', 'HS256'].includes(configuredAlgorithm)) {
        throw new InternalServerErrorException('Unsupported JWT_ALGORITHM');
      }
      return configuredAlgorithm;
    }

    if (hasAsymmetricKeys) return 'RS256';
    if (this.configService.get<string>('JWT_SECRET')) return 'HS256';
    if (process.env.NODE_ENV !== 'production') return 'HS256';
    throw new InternalServerErrorException('JWT_SECRET is required in production');
  }

  private getCompatibilitySecret() {
    return 'meetpoint-local-development-jwt-secret';
  }

  private normalizePem(value: string | undefined) {
    if (!value) {
      throw new InternalServerErrorException('JWT PEM key is required');
    }
    return value.replace(/\\n/g, '\n');
  }
}
