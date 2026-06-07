import { RagAccessLevel } from '../domain/rag.types';

export type IngestionDocumentInput = {
  source: string;
  tenantId: string;
  ownerId?: string;
  content: string;
  accessLevel: RagAccessLevel;
  permissions: string[];
  tags: string[];
};

export type IngestionResult = {
  documentId: string;
  contentHash: string;
  status: 'SKIPPED_DUPLICATE' | 'QUEUED' | 'FAILED';
  reason?: string;
};
