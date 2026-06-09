import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

const REGISTRATION_PURPOSE = 'registration';
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async requestRegistrationCode(email: string, name = '') {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException('Valid email is required');
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.emailVerificationCode.create({
      data: {
        email: normalizedEmail,
        codeHash: hashVerificationCode(normalizedEmail, code),
        purpose: REGISTRATION_PURPOSE,
        expiresAt,
      },
    });

    const sent = await this.sendVerificationEmail({
      code,
      email: normalizedEmail,
      name: name.trim(),
    });

    return {
      email: maskEmail(normalizedEmail),
      expiresInMinutes: CODE_TTL_MINUTES,
      sent,
      ...(sent ? {} : { developmentCode: code }),
    };
  }

  async consumeRegistrationCode(email: string, code: string) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = code.trim();
    if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException('Invalid email verification code');
    }

    const record = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email: normalizedEmail,
        purpose: REGISTRATION_PURPOSE,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Email verification code expired or not found');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Email verification code blocked');
    }

    const codeHash = hashVerificationCode(normalizedEmail, normalizedCode);
    if (record.codeHash !== codeHash) {
      await this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid email verification code');
    }

    await this.prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  private async sendVerificationEmail(params: {
    code: string;
    email: string;
    name: string;
  }) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from =
      process.env.SMTP_FROM?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      'MeetPoint <no-reply@meetpoint.com>';

    if (!host || !user || !pass) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Email service is not configured');
      }
      console.warn('Email verification warning: SMTP is not configured. Returning development code.');
      return false;
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === 'true';
    const displayName = params.name || 'novo usuario';

    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transport.sendMail({
      from,
      to: params.email,
      subject: 'Codigo de verificacao MeetPoint',
      text: [
        `Ola, ${displayName}.`,
        '',
        `Seu codigo de verificacao MeetPoint e: ${params.code}`,
        '',
        `Ele expira em ${CODE_TTL_MINUTES} minutos.`,
        'Se voce nao iniciou este cadastro, ignore este email.',
      ].join('\n'),
      html: buildVerificationEmailHtml(displayName, params.code),
    });

    return true;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashVerificationCode(email: string, code: string) {
  const pepper = process.env.EMAIL_VERIFICATION_PEPPER ?? process.env.JWT_SECRET ?? 'meetpoint-local-email-pepper';
  return createHash('sha256')
    .update(`${email}:${code}:${pepper}`)
    .digest('hex');
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local.slice(0, 1)}******@${domain}`;
}

function buildVerificationEmailHtml(name: string, code: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#fffaf0;padding:28px;color:#111318">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6dcc5;border-radius:18px;padding:28px">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px">
          <span style="display:inline-grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#f4ce55;font-weight:900">MP</span>
          <strong style="font-size:22px">MeetPoint</strong>
        </div>
        <h1 style="font-size:26px;line-height:1.1;margin:0 0 12px">Confirme seu email</h1>
        <p style="font-size:16px;line-height:1.5;margin:0 0 18px">Ola, ${escapeHtml(name)}. Use o codigo abaixo para concluir seu cadastro na plataforma.</p>
        <div style="font-size:34px;font-weight:900;letter-spacing:8px;background:#fff3c7;border:2px solid #111318;border-radius:14px;padding:18px;text-align:center">${code}</div>
        <p style="font-size:14px;line-height:1.5;margin:18px 0 0;color:#4b5563">Este codigo expira em 10 minutos. Se voce nao iniciou este cadastro, ignore este email.</p>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
