export type RagAccessLevel = 'PRIVATE' | 'TENANT' | 'PUBLIC';
export type RagDocumentStatus = 'PENDING' | 'INDEXED' | 'FAILED' | 'DELETED';
export type QueryRouteDecision = 'DIRECT' | 'RAG' | 'RELATIONAL_DB' | 'AGENT' | 'REFUSE';

export type RagPrincipal = {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
};

export type RagDocumentMetadata = {
  documentId: string;
  source: string;
  tenantId: string;
  ownerId?: string;
  version: string;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
  indexedAt?: Date;
  accessLevel: RagAccessLevel;
  permissions: string[];
  tags: string[];
  status: RagDocumentStatus;
};

export type RagChunk = {
  id: string;
  documentId: string;
  tenantId: string;
  content: string;
  embedding?: number[];
  metadata: RagDocumentMetadata & {
    chunkIndex: number;
    tokenEstimate: number;
  };
};

export type VectorSearchQuery = {
  tenantId: string;
  embedding: number[];
  limit: number;
  minScore?: number;
  filters: {
    documentIds?: string[];
    accessLevels?: RagAccessLevel[];
    permissions?: string[];
    tags?: string[];
  };
};

export type VectorSearchResult = {
  chunk: RagChunk;
  score: number;
};

export type RagAnswerRequest = {
  query: string;
  principal: RagPrincipal;
  correlationId: string;
};

export type RagAnswer = {
  route: QueryRouteDecision;
  answer: string;
  citations: Array<{
    documentId: string;
    chunkId: string;
    score: number;
  }>;
  confidence: number;
  safetyFlags: string[];
};

export type QueryRouteContext = {
  query: string;
  principal: RagPrincipal;
  cacheHit: boolean;
  estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type QueryRouteResult = {
  decision: QueryRouteDecision;
  reason: string;
  requiresAudit: boolean;
};
