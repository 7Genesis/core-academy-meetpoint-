import { Injectable, Logger } from '@nestjs/common';
import { RagAuditLogger } from '../domain/rag.ports';

@Injectable()
export class RagAuditService extends RagAuditLogger {
  private readonly logger = new Logger(RagAuditService.name);

  async record(input: Parameters<RagAuditLogger['record']>[0]): Promise<void> {
    this.logger.log(
      JSON.stringify({
        userId: input.principal.userId,
        tenantId: input.principal.tenantId,
        queryHash: hashForLog(input.query),
        route: input.route,
        documentIds: input.documentIds,
        scores: input.scores,
        model: input.model,
        tokenEstimate: input.tokenEstimate,
        costEstimateUsd: input.costEstimateUsd,
        status: input.status,
        error: input.error ? maskError(input.error) : undefined,
        correlationId: input.correlationId,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

function hashForLog(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function maskError(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
}
