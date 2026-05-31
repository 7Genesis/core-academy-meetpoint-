import { Injectable } from '@nestjs/common';

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|token|secret|password|passwd|email|cpf|cnpj|document|pix|ip|geo|location|address|phone|whatsapp)/i;

@Injectable()
export class DataMaskingService {
  maskEmail(email: string | null | undefined) {
    if (!email) return email ?? null;
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***';
    return `${name.slice(0, 2)}***@${domain}`;
  }

  maskDocument(value: string | null | undefined) {
    if (!value) return value ?? null;
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 4) return '***';
    return `${'*'.repeat(Math.max(digits.length - 4, 3))}${digits.slice(-4)}`;
  }

  maskPhone(value: string | null | undefined) {
    if (!value) return value ?? null;
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 4) return '***';
    return `***${digits.slice(-4)}`;
  }

  redactText(value: string | null | undefined) {
    if (!value) return value ?? null;
    return value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email-redacted]')
      .replace(/\b(?:Bearer\s+)?eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[jwt-redacted]')
      .replace(/\b(?:sk|pk|rk|whsec)_[a-zA-Z0-9_]{12,}\b/g, '[secret-redacted]')
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf-redacted]')
      .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[cnpj-redacted]');
  }

  sanitizeText(value: string | null | undefined) {
    const redacted = this.redactText(value);
    if (!redacted) return redacted;

    return redacted
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '[script-redacted]')
      .replace(/javascript:/gi, 'blocked:')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  }

  redactObject<T>(value: T, depth = 0): T {
    if (value === null || value === undefined) return value;
    if (depth > 8) return '[truncated]' as T;

    if (typeof value === 'string') {
      return this.redactText(value) as T;
    }

    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.map((item) => this.redactObject(item, depth + 1)) as T;
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, entry]) => {
        if (entry === undefined) {
          acc[key] = entry;
          return acc;
        }

        if (SENSITIVE_KEY_PATTERN.test(key)) {
          acc[key] = typeof entry === 'string' ? this.redactText(entry) : '[redacted]';
          return acc;
        }

        acc[key] = this.redactObject(entry, depth + 1);
        return acc;
      },
      {},
    ) as T;
  }
}
