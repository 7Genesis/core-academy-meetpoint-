import { Injectable } from '@nestjs/common';
import { QueryRouter } from '../domain/rag.ports';
import { QueryRouteContext, QueryRouteResult } from '../domain/rag.types';

const RAG_HINTS = [
  'documento',
  'base',
  'contrato',
  'politica',
  'política',
  'manual',
  'arquivo',
  'conteudo privado',
  'conteúdo privado',
];

const AGENT_HINTS = ['executar', 'criar', 'alterar', 'bloquear', 'enviar', 'aprovar'];
const RELATIONAL_HINTS = ['usuario', 'usuário', 'pagamento', 'curso', 'evento', 'comunidade'];

@Injectable()
export class DeterministicQueryRouterService extends QueryRouter {
  async route(context: QueryRouteContext): Promise<QueryRouteResult> {
    const query = context.query.trim().toLowerCase();

    if (!query) {
      return {
        decision: 'REFUSE',
        reason: 'empty_query',
        requiresAudit: true,
      };
    }

    if (context.estimatedRisk === 'HIGH') {
      return {
        decision: 'REFUSE',
        reason: 'high_risk_query_requires_manual_policy',
        requiresAudit: true,
      };
    }

    if (context.cacheHit) {
      return {
        decision: 'DIRECT',
        reason: 'cache_hit',
        requiresAudit: false,
      };
    }

    if (AGENT_HINTS.some((hint) => query.includes(hint))) {
      return {
        decision: 'AGENT',
        reason: 'action_or_tool_intent_detected',
        requiresAudit: true,
      };
    }

    if (RAG_HINTS.some((hint) => query.includes(hint))) {
      return {
        decision: 'RAG',
        reason: 'private_knowledge_intent_detected',
        requiresAudit: true,
      };
    }

    if (RELATIONAL_HINTS.some((hint) => query.includes(hint))) {
      return {
        decision: 'RELATIONAL_DB',
        reason: 'transactional_data_intent_detected',
        requiresAudit: true,
      };
    }

    return {
      decision: 'DIRECT',
      reason: 'low_risk_general_query',
      requiresAudit: false,
    };
  }
}
