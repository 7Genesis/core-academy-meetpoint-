import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SupportTicketPriority,
  SupportTicketStatus,
} from '../common/prisma-enums';
import { DataMaskingService } from '../common/security/data-masking.service';
import { FieldEncryptionService } from '../common/security/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportSuggestionDto } from './dto/create-support-suggestion.dto';
import { SupportChatDto } from './dto/support-chat.dto';

type OllamaResponse = {
  response?: string;
};

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly dataMasking: DataMaskingService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  async createSuggestion(dto: CreateSupportSuggestionDto) {
    const ticket = await this.prisma.withPlatformAdmin((tx) =>
      tx.supportTicket.create({
        data: {
          subject: `[Sugestao] ${this.dataMasking.sanitizeText(dto.subject)}`,
          requesterEmailHash: this.fieldEncryption.hashForLookup(dto.email, 'email'),
          requesterEmailEncrypted: this.fieldEncryption.encryptString(dto.email),
          description: this.fieldEncryption.encryptString(
            this.formatRequesterContext(dto.message, dto),
          ),
          priority: this.resolveTicketPriority(dto.priority, SupportTicketPriority.LOW),
          status: SupportTicketStatus.OPEN,
        },
      }),
    );

    return {
      ok: true,
      ticketId: ticket.id,
      message: 'Sugestao enviada para a equipe da plataforma.',
    };
  }

  async chat(dto: SupportChatDto) {
    const requestedPriority = this.resolveTicketPriority(dto.priority);
    const needsHuman =
      dto.preferredChannel === 'human'
      || requestedPriority === SupportTicketPriority.HIGH
      || requestedPriority === SupportTicketPriority.CRITICAL
      || this.shouldEscalateToHuman(dto.message);

    if (!needsHuman) {
      const aiAnswer = await this.askOllama(dto.message);
      if (aiAnswer) {
        return {
          mode: 'ai',
          escalated: false,
          answer: aiAnswer,
        };
      }
    }

    const ticket = await this.prisma.withPlatformAdmin((tx) =>
      tx.supportTicket.create({
        data: {
          subject: `[Suporte humano] ${this.dataMasking
            .sanitizeText(dto.message)
            ?.slice(0, 80)}`,
          requesterEmailHash: this.fieldEncryption.hashForLookup(dto.email, 'email'),
          requesterEmailEncrypted: this.fieldEncryption.encryptString(dto.email),
          description: this.fieldEncryption.encryptString(
            this.formatRequesterContext(dto.message, dto),
          ),
          priority: requestedPriority
            ?? (needsHuman
              ? SupportTicketPriority.HIGH
              : SupportTicketPriority.MEDIUM),
          status: SupportTicketStatus.OPEN,
        },
      }),
    );

    return {
      mode: 'human',
      escalated: true,
      ticketId: ticket.id,
      answer:
        'Encaminhei sua solicitação para uma pessoa do suporte. A equipe vai acompanhar pelo ticket aberto.',
    };
  }

  private shouldEscalateToHuman(message: string) {
    const text = message.toLowerCase();
    return [
      'humano',
      'pessoa',
      'atendente',
      'reembolso',
      'cobranca errada',
      'cartao',
      'pix nao caiu',
      'boleto',
      'documento',
      'cpf',
      'rg',
      'cnpj',
      'banir',
      'violencia',
      'assedio',
    ].some((term) => text.includes(term));
  }

  private async askOllama(message: string) {
    const ollamaUrl = this.resolveOllamaUrl();
    const model = this.configService.get<string>('OLLAMA_MODEL') ?? 'llama3.2';
    const safeMessage = this.dataMasking.sanitizeText(message) ?? '';
    if (!ollamaUrl) return this.fallbackAiAnswer(message);

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({
          model,
          stream: false,
          prompt: [
            'Voce e um suporte de uma plataforma SaaS EAD.',
            'Responda em portugues do Brasil, com no maximo 4 frases.',
            'Se envolver pagamento, documento, bloqueio, reembolso ou dados sensiveis, diga que vai encaminhar para suporte humano.',
            `Mensagem: ${safeMessage}`,
          ].join('\n'),
        }),
      });
      if (!response.ok) return this.fallbackAiAnswer(message);
      const data = (await response.json()) as OllamaResponse;
      return data.response?.trim() || this.fallbackAiAnswer(message);
    } catch {
      return this.fallbackAiAnswer(message);
    }
  }

  private resolveOllamaUrl() {
    const rawUrl = this.configService.get<string>('OLLAMA_URL');
    if (!rawUrl) return null;

    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;

      const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
      if (localHosts.has(parsed.hostname)) return parsed.origin;

      const allowedOrigins = (
        this.configService.get<string>('OLLAMA_ALLOWED_ORIGINS') ?? ''
      )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

      return allowedOrigins.includes(parsed.origin) ? parsed.origin : null;
    } catch {
      return null;
    }
  }

  private fallbackAiAnswer(message: string) {
    const text = message.toLowerCase();
    if (text.includes('senha')) {
      return 'Para senha, use a opcao Esqueci a senha na tela de login. Se voce errou 3 vezes, o sistema tambem mostra o atalho de recuperacao.';
    }
    if (text.includes('curso')) {
      return 'Para cursos, acesse a aba Cursos, pesquise pelo tema desejado e escolha Inscrever gratis ou Comprar. Depois da inscricao, o curso aparece no seu perfil.';
    }
    if (text.includes('comunidade')) {
      return 'Para comunidades, abra a aba Comunidades, use filtros ou busca e entre na comunidade desejada. Administradores podem criar comunidades e convidar pessoas.';
    }
    return 'Posso ajudar com acesso, cursos, comunidades, encontros e perfil. Se for pagamento, documento ou bloqueio, vou encaminhar para uma pessoa do suporte.';
  }

  private formatRequesterContext(
    message: string,
    context: {
      email?: string;
      name?: string;
      segment?: string;
      category?: string;
      priority?: string;
      conversationSummary?: string;
    },
  ) {
    return [
      `Mensagem: ${this.dataMasking.sanitizeText(message)}`,
      `Nome: ${this.dataMasking.sanitizeText(context.name ?? 'Nao informado')}`,
      `Email: ${this.dataMasking.redactText(context.email ?? 'Nao informado')}`,
      `Perfil: ${this.dataMasking.sanitizeText(context.segment ?? 'Nao informado')}`,
      `Categoria: ${this.dataMasking.sanitizeText(context.category ?? 'Nao classificado')}`,
      `Prioridade: ${this.dataMasking.sanitizeText(context.priority ?? 'Nao informada')}`,
      `Historico: ${this.dataMasking.sanitizeText(context.conversationSummary ?? 'Nao informado')}`,
    ].join('\n');
  }

  private resolveTicketPriority(
    priority?: string,
    fallback?: SupportTicketPriority,
  ) {
    if (!priority) return fallback;
    if (priority === 'CRITICAL') return SupportTicketPriority.CRITICAL;
    if (priority === 'HIGH') return SupportTicketPriority.HIGH;
    if (priority === 'MEDIUM') return SupportTicketPriority.MEDIUM;
    if (priority === 'LOW') return SupportTicketPriority.LOW;
    return fallback;
  }
}
