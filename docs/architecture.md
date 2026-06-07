# MeetPoint Architecture

## Diagnostico Atual

O projeto e um modular monolith em NestJS com Prisma/PostgreSQL no backend e React/Vite no frontend. A separacao backend/frontend existe fisicamente, mas o frontend ainda concentra fluxos extensos em `frontend/src/main.jsx`, incluindo regra visual, workflow de cadastro, perfil, eventos, comunidades e simulacoes de produto.

Backend preservavel:

- `AuthModule` com JWT, cookies HttpOnly e revogacao por `jti`.
- `TenantGuard`, `RolesGuard` e `PlatformAdminGuard`.
- Prisma com RLS preparado por tenant.
- `PlatformAdminModule`, pagamentos, webhooks, cursos, aulas, inscricoes e assinaturas.
- Helmet, CORS configuravel, throttling e `ValidationPipe` global.

Problemas encontrados:

- Nenhuma arquitetura RAG/agentes/vector store existia.
- Nao havia Dockerfile, Compose ou manifests Kubernetes.
- Observabilidade ainda e basica: request id existe, mas sem OpenTelemetry/tracing/metrica.
- Frontend segue grande demais e mistura regras de negocio com UI.
- Cache distribuido, filas e workers ainda nao existem.
- O banco vetorial nao esta configurado; foi adicionado adapter `noop` para falhar com seguranca.

Riscos tecnicos:

- Crescimento do frontend em arquivo unico aumenta custo de mudanca.
- RAG sem interfaces causaria acoplamento a vendor; por isso a primeira fase criou ports/adapters.
- Agentes sem tool registry/permissions poderiam executar acoes criticas sem validacao.
- Kubernetes sem probes e resource limits poderia causar deploy instavel.

Riscos de seguranca:

- RAG pode vazar documentos se nao filtrar por `tenantId`, permissoes e access level.
- Cache pode vazar dados entre tenants se a chave nao incluir tenant, usuario, permissoes e versao.
- Prompt injection pode tentar sobrescrever politicas ou extrair secrets.
- Logs de RAG podem capturar PII; a auditoria inicial registra hash da query, nao texto puro.

Plano incremental recomendado:

1. Manter modular monolith e endurecer auth/RBAC/cadastro.
2. Adicionar ports/adapters para RAG, vector store, agentes e auditoria.
3. Implementar pgvector como adapter inicial se o Postgres do ambiente suportar extensao.
4. Adicionar fila para ingestao; BullMQ/Redis ou provider externo, conforme infraestrutura.
5. Adicionar OpenTelemetry, Prometheus/Grafana/Loki/Tempo.
6. Migrar frontend para modulos/componentes menores por dominio.
7. Separar workers de ingestao quando volume justificar.

## Arquitetura Alvo

```text
frontend/
src/
  auth/
  platform-admin/
  subscriptions/
  rag/
    domain/
    application/
    infrastructure/
    ingestion/
    query-router/
    agents/
  common/
  config/
  prisma/
infra/
  kubernetes/
docs/
```

Decisao: modular monolith primeiro. Microsservicos so devem ser criados quando houver pressao real de escala, ownership separado ou requisitos de isolamento operacional.

Componentes alvo:

- API principal NestJS.
- Auth/RBAC/tenant isolation.
- RAG application service.
- Query router deterministico.
- Ingestion workers.
- Vector store adapter.
- LLM/embedding providers.
- Agent planner/executor/tool registry.
- Audit logging.
- Cache adapter tenant-aware.
- Observability.
- Kubernetes deployment layer.
