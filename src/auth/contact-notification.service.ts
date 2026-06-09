import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type RegistrationNotice = {
  email: string;
  name: string;
  phone: string;
};

@Injectable()
export class ContactNotificationService {
  async notifyRegistrationPendingPayment(params: RegistrationNotice) {
    const results = await Promise.allSettled([
      this.sendRegistrationEmail(params),
      this.sendRegistrationWhatsApp(params),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('Contact notification warning:', result.reason);
      }
    }
  }

  private async sendRegistrationEmail(params: RegistrationNotice) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from =
      process.env.SMTP_FROM?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      'MeetPoint <no-reply@meetpoint.com>';

    if (!host || !user || !pass) return false;

    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE?.trim().toLowerCase() === 'true',
      auth: { user, pass },
    });

    await transport.sendMail({
      from,
      to: params.email,
      subject: 'Cadastro MeetPoint recebido',
      text: [
        `Ola, ${params.name}.`,
        '',
        'Seu cadastro foi recebido pela MeetPoint.',
        'Para liberar a conta, conclua o pagamento da assinatura na tela de checkout.',
        '',
        'Se voce nao iniciou este cadastro, ignore este aviso.',
      ].join('\n'),
    });

    return true;
  }

  private async sendRegistrationWhatsApp(params: RegistrationNotice) {
    const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const templateName =
      process.env.WHATSAPP_REGISTRATION_NOTICE_TEMPLATE_NAME?.trim() ||
      process.env.WHATSAPP_TEMPLATE_NAME?.trim();
    const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'pt_BR';

    if (!token || !phoneNumberId || !templateName) return false;

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
                { type: 'text', text: params.name },
                { type: 'text', text: 'cadastro recebido' },
              ],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(`WhatsApp notification failed: ${response.status} ${JSON.stringify(body)}`);
    }

    return true;
  }
}
