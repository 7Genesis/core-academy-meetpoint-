import { Module } from '@nestjs/common';
import {
  QueryRouter,
  RagAuditLogger,
  VectorStoreAdapter,
} from './domain/rag.ports';
import { ControlledToolRegistryService } from './agents/tool-registry.service';
import { RagAuditService } from './application/rag-audit.service';
import { RagOrchestratorService } from './application/rag-orchestrator.service';
import { PromptInjectionGuardrail } from './application/prompt-injection.guardrail';
import { NoopVectorStoreAdapter } from './infrastructure/noop-vector-store.adapter';
import { IngestionPlannerService } from './ingestion/ingestion-planner.service';
import { DeterministicQueryRouterService } from './query-router/deterministic-query-router.service';

@Module({
  providers: [
    RagOrchestratorService,
    PromptInjectionGuardrail,
    IngestionPlannerService,
    ControlledToolRegistryService,
    { provide: QueryRouter, useClass: DeterministicQueryRouterService },
    { provide: RagAuditLogger, useClass: RagAuditService },
    { provide: VectorStoreAdapter, useClass: NoopVectorStoreAdapter },
  ],
  exports: [
    RagOrchestratorService,
    IngestionPlannerService,
    ControlledToolRegistryService,
    QueryRouter,
    RagAuditLogger,
    VectorStoreAdapter,
  ],
})
export class RagModule {}
