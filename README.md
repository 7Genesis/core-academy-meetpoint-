# MeetPoint

Plataforma SaaS white-label para cursos, comunidades, eventos, oportunidades, beneficios, pontos e suporte. O projeto combina um backend em NestJS com Prisma/PostgreSQL e um frontend em React/Vite para validar a experiencia do produto antes da integracao definitiva com banco de dados e servicos externos.

## Objetivo do produto

A plataforma foi desenhada para operar como um ecossistema social e educacional:

- cursos gratuitos e pagos;
- comunidades por tema, cidade, nicho ou curso;
- chat de comunidade e conversas privadas;
- eventos online e presenciais;
- oportunidades profissionais, vagas, freelas, parcerias e locacao de espacos;
- beneficios exclusivos para assinantes;
- sistema de pontos e recompensas;
- perfis separados para Pessoa Fisica, Pessoa Juridica, Empresa e administrador central;
- suporte com fluxo para IA e atendimento humano.

## Stack

Backend:

- Node.js
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT
- Guards de tenant, roles e admin
- Helmet, CORS e throttling
- Stripe preparado para checkout/webhooks

Frontend:

- React
- Vite
- CSS customizado mobile-first
- SPA por query string
- Prototipo visual responsivo para web/mobile

Banco:

- PostgreSQL como alvo principal
- Prisma schema em `prisma/schema.prisma`
- Script de Row-Level Security em `prisma/rls.sql`

## Estrutura principal

```text
frontend/
  index.html
  src/main.jsx
  src/styles.css

src/
  auth/
  certificates/
  common/
  config/
  courses/
  enrollments/
  lesson-progress/
  lessons/
  modules/
  payments/
  platform-admin/
  prisma/
  support/
  tenants/
  webhooks/

prisma/
  schema.prisma
  rls.sql
```

## Como rodar localmente

Instale as dependencias:

```bash
npm install
```

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Gere o Prisma Client:

```bash
npm run prisma:generate
```

Rodar frontend:

```bash
npm run frontend:dev
```

Frontend local:

```text
http://127.0.0.1:5173
```

Rodar backend:

```bash
npm run start:dev
```

Backend local:

```text
http://127.0.0.1:3000
```

## Scripts uteis

```bash
npm run frontend:dev
npm run frontend:build
npm run start:dev
npm run build
npm run lint
npm run prisma:generate
npm run prisma:migrate
npm run db:rls
```

## Variaveis de ambiente

Use `.env.example` como referencia. Nunca suba `.env` para o GitHub.

Principais variaveis:

- `DATABASE_URL`: conexao PostgreSQL;
- `JWT_ALGORITHM`: use `RS256` em producao;
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KID`: assinatura assimetrica de JWT e JWKS;
- `JWT_ISSUER`, `JWT_AUDIENCE`: validacao estrita do emissor e publico do token;
- `JWT_SECRET`: fallback local de desenvolvimento quando nao houver chave RSA;
- `REDIS_URL`: revogacao/blacklist de `jti` de JWT;
- `PII_ENCRYPTION_KEY`: chave AES-256-GCM para criptografia de dados sensiveis;
- `WEBHOOK_SECRET`: segredo de webhook generico;
- `STRIPE_SECRET_KEY`: chave secreta Stripe;
- `STRIPE_WEBHOOK_SECRET`: segredo de webhook Stripe;
- `CORS_ORIGIN`: origem liberada para frontend;
- `CHECKOUT_ALLOWED_ORIGINS`: origens permitidas no checkout;
- `OLLAMA_URL`: endpoint local do Ollama;
- `RAG_ENABLED`: habilita rotas/fluxos RAG quando adapters reais estiverem configurados;
- `VECTOR_STORE_PROVIDER`: provider do banco vetorial (`noop`, `pgvector`, `qdrant`, `pinecone`, etc.);
- `VECTOR_STORE_URL`: endpoint/conexao do vector store quando aplicavel;
- `OPENAI_API_KEY`, `LLM_PROVIDER`, `EMBEDDING_PROVIDER`: providers de IA configurados por ambiente, nunca em codigo.

## Seguranca

O projeto possui camadas iniciais de seguranca:

- autenticacao JWT;
- guard global de tenant;
- roles e permissoes;
- validacao de configuracao de runtime;
- headers com Helmet;
- CORS configuravel;
- throttling;
- webhooks com validacao de assinatura;
- JWT com suporte a RS256, `kid`, JWKS, `issuer`, `audience` e revogacao via Redis;
- criptografia de campo AES-256-GCM para dados sensiveis;
- mascaramento dinamico de PII em retornos administrativos e logs de auditoria;
- RLS preparado para PostgreSQL;
- arquivos sensiveis ignorados no Git.

Ponto importante: bloqueios de inspecionar elemento, copia ou clique direito no frontend sao apenas barreiras visuais. Eles nao substituem seguranca real. Conteudos privados, videos, materiais e dados sensiveis precisam ser protegidos no backend com autorizacao, URLs assinadas, expiracao e validacao por usuario/tenant.

O plano tecnico completo de hardening, vetores OWASP e Terraform AWS fica em [`docs/security-hardening.md`](docs/security-hardening.md).

## Arquitetura, UML e Operacao

Documentacao tecnica atualizada:

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/rag.md`](docs/rag.md)
- [`docs/query-router.md`](docs/query-router.md)
- [`docs/agents.md`](docs/agents.md)
- [`docs/security.md`](docs/security.md)
- [`docs/devops-kubernetes.md`](docs/devops-kubernetes.md)
- [`docs/operations.md`](docs/operations.md)

## Docker e Kubernetes

Arquivos adicionados:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `infra/kubernetes/base`
- `infra/kubernetes/overlays`

O secret de Kubernetes e apenas template (`secret.template.yaml`) e nao deve ser aplicado com valores placeholder em producao.

Documentos tecnicos adicionados:

- [`docs/architecture.md`](docs/architecture.md): arquitetura, UML, conectividade e fluxos principais;
- [`docs/gitflow.md`](docs/gitflow.md): estrategia de branches, PRs, releases e hotfix;
- [`docs/deployment.md`](docs/deployment.md): CI/CD, staging, producao, migrations, RLS e rollback;
- [`docs/resource-optimization.md`](docs/resource-optimization.md): otimizacao de frontend, backend, banco, midia e custo.
- [`docs/github-setup.md`](docs/github-setup.md): branch protection, environments, secrets e templates do GitHub;
- [`docs/production-readiness-checklist.md`](docs/production-readiness-checklist.md): checklist para hospedagem, banco e go-live.

## Multi-tenant e RLS

A arquitetura foi preparada para isolamento por linha usando `tenantId`.

Pontos principais:

- tabelas principais com discriminador de tenant;
- `TenantGuard` para resolver o tenant da requisicao;
- servicos devem filtrar operacoes por `tenantId`;
- `prisma/rls.sql` prepara politicas de Row-Level Security no PostgreSQL.

Antes de producao, valide:

- todas as queries criticas com `tenantId`;
- politicas RLS no banco real;
- usuario de banco sem permissao de bypass;
- testes de acesso cruzado entre tenants.

## Funcionalidades do frontend

O frontend atual cobre:

- home institucional;
- feed social com posts, reacoes, comentarios e compartilhamento;
- comunidades com lista, filtros, chat, comunidade privada por convite/senha e administracao;
- cursos com criacao, rascunho, modulos, aulas, materiais e progresso;
- oportunidades com vagas, candidaturas e canais de contato configuraveis;
- eventos com inscricao, participacao e pagamento mockado;
- beneficios para assinantes;
- pontos e recompensas;
- parceiros e assinaturas;
- perfil social com seguidores, amigos, notificacoes e personalizacao;
- admin central com funcionarios, permissoes, suporte e beneficios.

## Pagamentos

Existe estrutura para Stripe em:

```text
src/payments/
src/webhooks/
```

O fluxo visual ja simula compra/inscricao, mas em producao e necessario configurar:

- `STRIPE_SECRET_KEY`;
- `STRIPE_WEBHOOK_SECRET`;
- URLs de sucesso/cancelamento;
- validacao real dos webhooks;
- persistencia das compras no banco;
- repasse/taxa da plataforma.

## Banco de dados

O projeto esta preparado para PostgreSQL com Prisma. Para mudar de banco no futuro, o impacto depende do banco escolhido:

- PostgreSQL: caminho natural, menor risco;
- MySQL: possivel, mas RLS nativo nao existe da mesma forma;
- Firebase/Firestore: exige redesenho relevante da camada de dados, permissoes e queries;
- hibrido: possivel, usando PostgreSQL para dominio financeiro/relacional e Firebase para app, notificacoes ou realtime.

## CI e seguranca automatizada

O repositorio inclui:

```text
.github/workflows/ci.yml
.github/workflows/security.yml
.github/workflows/deploy-staging.yml
.github/workflows/deploy-production.yml
.github/dependabot.yml
```

Esses arquivos preparam uma base para:

- build e lint em pull requests;
- auditoria de dependencias;
- validacoes de seguranca;
- atualizacoes automatizadas.
- deploy por ambiente quando os secrets forem configurados.

## Status atual

Este repositorio e uma base inicial robusta, mas ainda nao deve ser tratado como producao final sem:

- conectar banco definitivo;
- executar migracoes e RLS no ambiente real;
- configurar secrets reais fora do GitHub;
- ativar checkout real;
- testar autorizacao por tenant;
- testar carga e concorrencia;
- revisar fluxos de LGPD;
- configurar storage seguro para videos, PDFs e documentos;
- criar testes automatizados para regras criticas.

## Comandos para publicar novas alteracoes

```bash
git status
git add -A
git commit -m "Descricao da alteracao"
git push
```

Repositorio remoto:

```text
https://github.com/7Genesis/core-academy-meetpoint-.git
```
