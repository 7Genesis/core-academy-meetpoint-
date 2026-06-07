import {
  QueryRouteContext,
  QueryRouteResult,
  RagAnswer,
  RagAnswerRequest,
  RagChunk,
  RagDocumentMetadata,
  VectorSearchQuery,
  VectorSearchResult,
} from './rag.types';

export abstract class EmbeddingProvider {
  abstract embedText(input: { text: string; tenantId: string }): Promise<number[]>;
}

export abstract class LlmProvider {
  abstract generateAnswer(input: {
    systemInstruction: string;
    userQuestion: string;
    context: string;
    tenantId: string;
  }): Promise<{ text: string; model: string; promptTokens?: number; completionTokens?: number }>;
}

export abstract class VectorStoreAdapter {
  abstract upsertVectors(chunks: RagChunk[]): Promise<void>;
  abstract searchSimilar(query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  abstract deleteByDocumentId(input: { tenantId: string; documentId: string }): Promise<void>;
  abstract deleteByTenant(tenantId: string): Promise<void>;
  abstract updateMetadata(metadata: RagDocumentMetadata): Promise<void>;
  abstract healthCheck(): Promise<{ ok: boolean; provider: string }>;
}

export abstract class Retriever {
  abstract retrieve(request: RagAnswerRequest): Promise<VectorSearchResult[]>;
}

export abstract class Reranker {
  abstract rerank(input: {
    query: string;
    results: VectorSearchResult[];
  }): Promise<VectorSearchResult[]>;
}

export abstract class PromptBuilder {
  abstract build(input: {
    query: string;
    results: VectorSearchResult[];
  }): Promise<{ systemInstruction: string; context: string }>;
}

export abstract class ResponseValidator {
  abstract validate(answer: RagAnswer): Promise<RagAnswer>;
}

export abstract class QueryRouter {
  abstract route(context: QueryRouteContext): Promise<QueryRouteResult>;
}

export abstract class RagAuditLogger {
  abstract record(input: {
    principal: RagAnswerRequest['principal'];
    query: string;
    route: string;
    documentIds: string[];
    scores: number[];
    model?: string;
    tokenEstimate?: number;
    costEstimateUsd?: number;
    status: 'SUCCESS' | 'REFUSED' | 'ERROR';
    error?: string;
    correlationId: string;
  }): Promise<void>;
}
