# RAG Architecture

## Estrategia

RAG deve ser usado para conhecimento privado, atualizado e auditavel. Fine-tuning nao deve ser usado para dados privados mutaveis; ele serve para estilo, formato e classificacao estavel.

Fluxo de pergunta:

1. Auth valida JWT.
2. TenantGuard valida `tenantId`.
3. Query Router classifica a intencao.
4. Cache tenant-aware e permission-aware e consultado.
5. Retriever aplica filtros de tenant, access level e permissoes.
6. Vector store retorna chunks.
7. Reranker reorganiza se houver ganho de qualidade.
8. PromptBuilder monta contexto delimitado.
9. LLM gera resposta.
10. ResponseValidator bloqueia vazamento, instrucao maliciosa e baixa confianca.
11. Auditoria registra ids, scores, modelo, tokens e status sem logar PII crua.

## Interfaces Criadas

Arquivo: `src/rag/domain/rag.ports.ts`

- `EmbeddingProvider`
- `LlmProvider`
- `VectorStoreAdapter`
- `Retriever`
- `Reranker`
- `PromptBuilder`
- `ResponseValidator`
- `QueryRouter`
- `RagAuditLogger`

## Banco Vetorial

Opcao inicial recomendada: pgvector, se o PostgreSQL do hosting suportar extensao. Vantagens: menor custo operacional, backup junto ao Postgres e tenant filtering no mesmo banco.

Opcao para escala maior: Qdrant, Pinecone, Weaviate ou Milvus via adapter.

Requisitos do adapter:

- `upsertVectors`
- `searchSimilar`
- `deleteByDocumentId`
- `deleteByTenant`
- `updateMetadata`
- `healthCheck`

## Pipeline de Ingestao

Cada documento deve ter:

- `documentId`
- `source`
- `tenantId`
- `ownerId`
- `version`
- `contentHash`
- `createdAt`
- `updatedAt`
- `indexedAt`
- `accessLevel`
- `permissions`
- `tags`
- `status`

O `IngestionPlannerService` atual calcula hash deterministico e document id. Ele nao indexa vetores ainda; isso evita falso positivo operacional enquanto o vector store nao esta configurado.
