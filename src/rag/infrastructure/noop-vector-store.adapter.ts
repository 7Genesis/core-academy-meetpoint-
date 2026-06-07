import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { VectorStoreAdapter } from '../domain/rag.ports';
import {
  RagChunk,
  RagDocumentMetadata,
  VectorSearchQuery,
  VectorSearchResult,
} from '../domain/rag.types';

@Injectable()
export class NoopVectorStoreAdapter extends VectorStoreAdapter {
  async upsertVectors(_chunks: RagChunk[]): Promise<void> {
    throw new ServiceUnavailableException('Vector store adapter is not configured');
  }

  async searchSimilar(_query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    throw new ServiceUnavailableException('Vector store adapter is not configured');
  }

  async deleteByDocumentId(_input: { tenantId: string; documentId: string }): Promise<void> {
    throw new ServiceUnavailableException('Vector store adapter is not configured');
  }

  async deleteByTenant(_tenantId: string): Promise<void> {
    throw new ServiceUnavailableException('Vector store adapter is not configured');
  }

  async updateMetadata(_metadata: RagDocumentMetadata): Promise<void> {
    throw new ServiceUnavailableException('Vector store adapter is not configured');
  }

  async healthCheck(): Promise<{ ok: boolean; provider: string }> {
    return { ok: false, provider: 'noop' };
  }
}
