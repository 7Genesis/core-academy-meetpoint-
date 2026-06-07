# Security and Governance

## Corrigido ou Preservado

- Login demo removido.
- Cadastro real com bcrypt.
- DTO validation global com whitelist.
- JWT com issuer/audience/kid.
- Cookie HttpOnly.
- Guards globais de auth, tenant, subscription e roles.
- Helmet e CORS configuravel.
- Throttling global.
- Seed bloqueado em producao.
- Auditoria RAG inicial registra hash da query, nao texto cru.
- Prompt injection guardrail inicial bloqueia padroes obvios.

## Pendente

- Testes automatizados para auth/RBAC/RAG.
- OpenTelemetry e metricas.
- Cache distribuido com chave por tenant/permissao.
- Fila e DLQ para ingestao.
- Adapter pgvector/Qdrant/Pinecone real.
- Politica formal de retencao de logs.
- Upload seguro com tamanho, MIME type e antivirus.
- External Secrets ou Sealed Secrets no Kubernetes.

## Regras RAG

- Todo retrieval deve filtrar `tenantId`.
- Todo retrieval deve aplicar permissoes antes e depois da busca.
- Cache key deve incluir tenant, usuario/permissao, query hash e versao dos documentos.
- Documentos recuperados devem ser delimitados como contexto nao confiavel.
- Resposta deve passar por validator antes de retornar ao usuario.

## Prompt Injection

O guardrail inicial bloqueia tentativas de:

- ignorar instrucoes;
- revelar system prompt;
- revelar secrets/tokens/chaves;
- exfiltrar dados;
- acessar documento de outro tenant.

Esse filtro e necessario, mas insuficiente sozinho. A protecao real combina RBAC, filtros de metadata, prompt delimitado, validator e auditoria.
