# Arquitetura e UML

Este documento descreve a arquitetura alvo da plataforma MeetPoint/CoreAcademy.
Ele separa o que ja esta estruturado no codigo do que ainda depende de banco,
infraestrutura e integracoes reais.

## Visao Executiva

A arquitetura correta para o produto e:

- frontend React/Vite separado do backend;
- backend NestJS modular;
- PostgreSQL como banco principal;
- Prisma como camada de acesso;
- isolamento multi-tenant por `tenantId` e RLS;
- JWT para autenticacao;
- Redis para revogacao de token, cache, filas e rate limit futuro;
- Stripe ou gateway equivalente para pagamentos;
- storage/CDN externo para videos, PDFs e documentos;
- IA de suporte via Ollama ou provedor substituivel.

## Status de Conexao

| Area | Status atual | Risco | Proximo passo |
| --- | --- | --- | --- |
| Frontend | Funcional, com muitos fluxos mockados | Medio | Trocar mocks por chamadas API por modulo |
| Backend NestJS | Modular e compilando | Baixo/medio | Ampliar endpoints para feed, comunidades, eventos e oportunidades |
| PostgreSQL/Prisma | Schema, migrations e RLS preparados | Medio | Conectar banco definitivo e rodar `migrate deploy` |
| Auth/JWT | Estrutura criada | Medio | Remover login demo em producao e testar revogacao |
| Stripe | Estrutura preparada | Medio/alto | Configurar chaves, webhooks e testes E2E |
| Suporte IA/Humano | Fluxo frontend + endpoint backend | Medio | Persistir tickets no banco real e painel operacional |
| CI/CD | Base criada | Medio | Configurar secrets e ambientes GitHub |

## UML de Contexto

```mermaid
flowchart LR
  User["Usuario Web/Mobile"] --> Frontend["React/Vite Frontend"]
  Admin["Admin Central"] --> Frontend
  Company["Empresa/PJ/PF"] --> Frontend

  Frontend --> API["NestJS API"]
  API --> Prisma["Prisma ORM"]
  Prisma --> Postgres["PostgreSQL + RLS"]

  API --> Redis["Redis<br/>JWT blacklist, cache, filas"]
  API --> Stripe["Stripe / Gateway"]
  Stripe --> API
  API --> Ollama["Ollama IA"]
  Frontend --> Media["YouTube/Bunny/S3/CDN"]
  API --> Email["Email/WhatsApp Provider"]
```

## UML de Componentes

```mermaid
flowchart TB
  subgraph Frontend["frontend/src"]
    SPA["SPA React"]
    UI["Componentes UI"]
    State["Estado local/mock"]
    APIClient["Camada futura services/api"]
  end

  subgraph Backend["src"]
    Auth["auth"]
    Tenants["tenants"]
    Courses["courses/modules/lessons"]
    Enrollments["enrollments/lesson-progress/certificates"]
    Payments["payments/webhooks"]
    Support["support"]
    Admin["platform-admin"]
    Common["common guards/security"]
    PrismaModule["prisma"]
  end

  SPA --> UI
  SPA --> State
  SPA --> APIClient
  APIClient --> Auth
  APIClient --> Courses
  APIClient --> Payments
  APIClient --> Support
  APIClient --> Admin

  Auth --> Common
  Tenants --> Common
  Courses --> Common
  Enrollments --> Common
  Payments --> Common
  Support --> Common
  Admin --> Common

  Common --> PrismaModule
  PrismaModule --> DB["PostgreSQL"]
```

## UML de Dominio

```mermaid
classDiagram
  class Tenant {
    uuid id
    string name
    string subdomain
    datetime createdAt
  }

  class User {
    uuid id
    string email
    string password
    UserRole role
    uuid tenantId
  }

  class Course {
    uuid id
    string title
    string description
    string coverUrl
    uuid tenantId
  }

  class Module {
    uuid id
    string title
    int order
    uuid courseId
  }

  class Lesson {
    uuid id
    string title
    int order
    string videoUrl
    string attachmentUrl
    uuid moduleId
  }

  class Enrollment {
    uuid id
    uuid userId
    uuid courseId
    int progressPercentage
    boolean isCompleted
  }

  class LessonProgress {
    uuid id
    uuid userId
    uuid lessonId
    boolean isWatched
  }

  class Certificate {
    uuid id
    uuid userId
    uuid courseId
    uuid verificationCode
  }

  class SupportTicket {
    uuid id
    uuid tenantId
    string requesterEmailHash
    string requesterEmailEncrypted
    string subject
    string status
  }

  Tenant "1" --> "*" User
  Tenant "1" --> "*" Course
  Tenant "1" --> "*" SupportTicket
  Course "1" --> "*" Module
  Module "1" --> "*" Lesson
  User "1" --> "*" Enrollment
  Course "1" --> "*" Enrollment
  User "1" --> "*" LessonProgress
  Lesson "1" --> "*" LessonProgress
  User "1" --> "*" Certificate
  Course "1" --> "*" Certificate
```

## Fluxo de Requisicao Tenant

```mermaid
sequenceDiagram
  participant F as Frontend
  participant G as JwtAuthGuard
  participant T as TenantGuard
  participant S as Service
  participant P as PrismaService
  participant DB as PostgreSQL/RLS

  F->>G: Request com Authorization
  G->>G: Valida JWT, issuer, audience, kid
  G->>T: Usuario autenticado
  T->>T: Compara tenantId do JWT e X-Tenant-ID
  T->>S: request.tenantId
  S->>P: prisma.withTenant(tenantId)
  P->>DB: SET app.current_tenant_id
  DB-->>P: Dados filtrados por RLS
  P-->>S: Resultado
  S-->>F: Resposta
```

## Fluxo de Compra

```mermaid
sequenceDiagram
  participant U as Usuario
  participant F as Frontend
  participant API as NestJS API
  participant Pay as Stripe/Gateway
  participant DB as PostgreSQL

  U->>F: Clica em comprar curso
  F->>API: POST /payments/course-checkout
  API->>DB: Valida tenant, curso e usuario
  API->>Pay: Cria checkout
  Pay-->>F: URL de pagamento
  U->>Pay: Conclui pagamento
  Pay->>API: Webhook assinado
  API->>DB: Cria/atualiza Enrollment
  API->>DB: Registra status financeiro
  F->>API: Consulta perfil/cursos
  API-->>F: Curso liberado
```

## Fluxo de Suporte IA/Humano

```mermaid
sequenceDiagram
  participant U as Usuario
  participant F as Frontend
  participant API as Support API
  participant IA as Ollama
  participant DB as PostgreSQL
  participant Staff as Suporte Humano

  U->>F: Abre suporte
  F->>API: POST /support/chat
  API->>IA: Pergunta simples
  IA-->>API: Resposta curta
  API-->>F: mode=ai
  U->>F: Nao resolveu
  F->>API: POST /support/chat preferredChannel=human
  API->>DB: Cria SupportTicket
  Staff->>DB: Assume ticket
  API-->>F: Ticket aberto
```

## Fronteiras de Seguranca

| Fronteira | Controle esperado |
| --- | --- |
| Browser -> API | JWT, CORS restrito, rate limit, validacao DTO |
| API -> Banco | Prisma, `withTenant`, RLS, usuario sem bypass |
| API -> Stripe | webhook assinado, idempotencia |
| API -> Ollama | allowlist de origem, timeout, sem PII |
| API -> Storage | URLs assinadas e expiracao |
| Admin -> Dados sensiveis | RBAC/ABAC, mascaramento, auditoria |

## Pontos que Ainda Precisam Virar API Real

- feed, posts, comentarios, reacoes e algoritmo;
- comunidades, membros, mensagens e moderacao;
- conversas privadas;
- oportunidades e candidaturas;
- eventos e inscricoes;
- beneficios e resgates;
- pontos e ranking;
- perfil social completo;
- notificacoes.

Essas areas hoje estao funcionais no prototipo visual, mas devem ser migradas
para endpoints versionados antes de producao.
