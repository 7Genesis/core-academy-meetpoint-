import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EmbeddingProvider,
  LlmProvider,
  PromptBuilder,
  QueryRouter,
  RagAuditLogger,
  ResponseValidator,
  Retriever,
} from '../domain/rag.ports';
import { RagAnswer, RagAnswerRequest } from '../domain/rag.types';
import { PromptInjectionGuardrail } from './prompt-injection.guardrail';

@Injectable()
export class RagOrchestratorService {
  constructor(
    private readonly queryRouter: QueryRouter,
    private readonly auditLogger: RagAuditLogger,
    private readonly promptInjectionGuardrail: PromptInjectionGuardrail,
  ) {}

  async answer(request: Omit<RagAnswerRequest, 'correlationId'>): Promise<RagAnswer> {
    const correlationId = randomUUID();
    const guardrail = this.promptInjectionGuardrail.classify(request.query);

    if (guardrail.blocked) {
      await this.auditLogger.record({
        principal: request.principal,
        query: request.query,
        route: 'REFUSE',
        documentIds: [],
        scores: [],
        status: 'REFUSED',
        error: 'prompt_injection_pattern_detected',
        correlationId,
      });

      return {
        route: 'REFUSE',
        answer: 'Não posso atender essa solicitação com segurança.',
        citations: [],
        confidence: 0,
        safetyFlags: ['prompt_injection_pattern_detected'],
      };
    }

    const route = await this.queryRouter.route({
      query: request.query,
      principal: request.principal,
      cacheHit: false,
      estimatedRisk: 'LOW',
    });

    await this.auditLogger.record({
      principal: request.principal,
      query: request.query,
      route: route.decision,
      documentIds: [],
      scores: [],
      status: route.decision === 'REFUSE' ? 'REFUSED' : 'SUCCESS',
      correlationId,
    });

    if (route.decision === 'RAG') {
      throw new ServiceUnavailableException(
        'RAG adapters are not configured yet. Configure EmbeddingProvider, Retriever, PromptBuilder, LlmProvider and ResponseValidator before enabling RAG answers.',
      );
    }

    if (route.decision === 'AGENT') {
      throw new ServiceUnavailableException(
        'Agent execution is not enabled yet. Configure tool registry, permissions and audit policy before enabling agents.',
      );
    }

    if (route.decision === 'RELATIONAL_DB') {
      return {
        route: route.decision,
        answer: 'Essa pergunta deve ser respondida por um serviço transacional específico, não por RAG.',
        citations: [],
        confidence: 0.7,
        safetyFlags: [],
      };
    }

    return {
      route: route.decision,
      answer: 'Pergunta classificada como baixa complexidade. Nenhum documento privado foi consultado.',
      citations: [],
      confidence: 0.5,
      safetyFlags: [],
    };
  }
}

export const RAG_VENDOR_PORTS = [
  EmbeddingProvider,
  Retriever,
  PromptBuilder,
  LlmProvider,
  ResponseValidator,
];
