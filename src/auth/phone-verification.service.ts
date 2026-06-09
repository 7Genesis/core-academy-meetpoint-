import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const REGISTRATION_PURPOSE = 'registration';
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PhoneVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async requestRegistrationCode(phone: string, name = '') {
    const normalizedPhone = normalizePhone(phone);
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.phoneVerificationCode.create({
      data: {
        phone: normalizedPhone,
        codeHash: hashVerificationCode(normalizedPhone, code),
        purpose: REGISTRATION_PURPOSE,
        expiresAt,
      },
    });

    const sent = await this.sendVerificationMessage({
      code,
      name: name.trim(),
      phone: normalizedPhone,
    });

    return {
      phone: maskPhone(normalizedPhone),
      expiresInMinutes: CODE_TTL_MINUTES,
      sent,
      ...(sent ? {} : { developmentCode: code }),
    };
  }

  async consumeRegistrationCode(phone: string, code: string) {
    const normalizedPhone = normalizePhone(phone);
    const normalizedCode = code.trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException('Invalid phone verification code');
    }

    const record = await this.prisma.phoneVerificationCode.findFirst({
      where: {
        phone: normalizedPhone,
        purpose: REGISTRATION_PURPOSE,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Phone verification code expired or not found');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Phone verification code blocked');
    }

    const codeHash = hashVerificationCode(normalizedPhone, normalizedCode);
    if (record.codeHash !== codeHash) {
      await this.prisma.phoneVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid phone verification code');
    }

    await this.prisma.phoneVerificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return normalizedPhone;
  }

  private async sendVerificationMessage(params: {
    code: string;
    name: string;
    phone: string;
  }) {
    const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || 'meetpoint_verification';
    const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'pt_BR';

    if (!token || !phoneNumberId) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('WhatsApp verification service is not configured');
      }
      console.warn('Phone verification warning: WhatsApp Cloud API is not configured. Returning development code.');
      return false;
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.phone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: params.name || 'novo usuario' },
                { type: 'text', text: params.code },
              ],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('WhatsApp verification error:', {
        status: response.status,
        phone: maskPhone(params.phone),
        body,
      });
      throw new ServiceUnavailableException('WhatsApp verification failed');
    }

    return true;
  }
}

export function normalizePhone(phone: string) {
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

function hashVerificationCode(phone: string, code: string) {
  const pepper = process.env.PHONE_VERIFICATION_PEPPER ?? process.env.JWT_SECRET ?? 'meetpoint-local-phone-pepper';
  return createHash('sha256')
    .update(`${phone}:${code}:${pepper}`)
    .digest('hex');
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return 'telefone protegido';
  return `+${digits.slice(0, 2)} ******${digits.slice(-4)}`;
}
