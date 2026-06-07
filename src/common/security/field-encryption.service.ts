import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

const ENCRYPTION_PREFIX = 'fle:v1';
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const KEY_BYTES = 32;

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.key = this.resolveKey();
  }

  encryptString(value: string | null | undefined) {
    if (value === null || value === undefined || value === '') return value ?? null;
    if (this.isEncrypted(value)) return value;

    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv, {
      authTagLength: GCM_TAG_BYTES,
    });
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      ENCRYPTION_PREFIX,
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  decryptString(value: string | null | undefined) {
    if (value === null || value === undefined || value === '') return value ?? null;
    if (!this.isEncrypted(value)) return value;

    const [, , ivRaw, tagRaw, encryptedRaw] = value.split(':');
    const iv = Buffer.from(ivRaw, 'base64url');
    const tag = Buffer.from(tagRaw, 'base64url');
    const encrypted = Buffer.from(encryptedRaw, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv, {
      authTagLength: GCM_TAG_BYTES,
    });
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  isEncrypted(value: string | null | undefined) {
    return typeof value === 'string' && value.startsWith(`${ENCRYPTION_PREFIX}:`);
  }

  hashForLookup(value: string | null | undefined, scope = 'pii') {
    if (!value) return null;
    return createHmac('sha256', this.key)
      .update(`${scope}:${this.normalizeForLookup(value)}`)
      .digest('hex');
  }

  private normalizeForLookup(value: string) {
    return value.trim().toLowerCase();
  }

  private resolveKey() {
    const configuredKey = this.configService.get<string>('PII_ENCRYPTION_KEY');
    const production = process.env.NODE_ENV === 'production';
    const strictRuntimeValidation =
      process.env.STRICT_RUNTIME_VALIDATION?.trim().toLowerCase() === 'true';

    if (!configuredKey) {
      if (production && strictRuntimeValidation) {
        throw new InternalServerErrorException(
          'PII_ENCRYPTION_KEY is required in production',
        );
      }
      if (production) {
        console.warn(
          'Runtime configuration warning: PII_ENCRYPTION_KEY is missing; using deterministic compatibility key. Configure a stable 32-byte key before handling real PII.',
        );
      }
      return createHash('sha256')
        .update('meetpoint-shared-hosting-compatibility-field-encryption-key')
        .digest();
    }

    const candidates = [
      Buffer.from(configuredKey, 'base64'),
      Buffer.from(configuredKey, 'hex'),
      Buffer.from(configuredKey, 'utf8'),
    ].filter((candidate) => candidate.length === KEY_BYTES);

    if (candidates[0]) return candidates[0];

    if (!production || !strictRuntimeValidation) {
      if (production) {
        console.warn(
          'Runtime configuration warning: PII_ENCRYPTION_KEY has invalid length; deriving compatibility key. Configure a stable 32-byte key before handling real PII.',
        );
      }
      return createHash('sha256').update(configuredKey).digest();
    }

    throw new InternalServerErrorException(
      'PII_ENCRYPTION_KEY must be a 32-byte base64 or hex key in production',
    );
  }
}
