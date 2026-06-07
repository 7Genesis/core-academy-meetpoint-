import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { IngestionDocumentInput, IngestionResult } from './ingestion.types';

@Injectable()
export class IngestionPlannerService {
  plan(input: IngestionDocumentInput): IngestionResult {
    const normalized = input.content.trim().replace(/\s+/g, ' ');
    const contentHash = createHash('sha256').update(normalized).digest('hex');

    return {
      documentId: createDocumentId(input.tenantId, input.source, contentHash),
      contentHash,
      status: normalized ? 'QUEUED' : 'FAILED',
      reason: normalized ? undefined : 'empty_document',
    };
  }
}

function createDocumentId(tenantId: string, source: string, contentHash: string) {
  return createHash('sha256')
    .update(`${tenantId}:${source}:${contentHash}`)
    .digest('hex')
    .slice(0, 32);
}
