# CoreAcademy MeetPoint

O **CoreAcademy MeetPoint** é uma plataforma SaaS White-Label projetada para unificar ecossistemas educacionais e sociais. O sistema centraliza cursos, comunidades, eventos e monetização em um único ambiente, desenvolvido com foco em alta segurança, isolamento de dados (Multi-tenant) e escalabilidade.

**Demonstração ao vivo:** [Acesse o ambiente de validação](https://novalab.me/meetpoint/?page=home)

## O Problema: Silos Educacionais e Perda de Retenção
Atualmente, criadores de conteúdo e empresas dependem de um ecossistema fragmentado: usam uma plataforma para hospedar cursos, um aplicativo de chat de terceiros para a comunidade, outra ferramenta para gerenciar eventos e mais uma para suporte. Essa fragmentação destrói a identidade da marca (White-Label), confunde o usuário final, dificulta o rastreamento de dados de engajamento e aumenta os custos operacionais, resultando em altas taxas de churn (cancelamento).

## A Solução CoreAcademy
Desenvolvemos um motor centralizado que resolve a dispersão operacional. O valor de negócio entregue inclui:
- **Ecossistema Unificado:** Cursos, fóruns, chat privado, mural de vagas e eventos rodam no mesmo banco de dados, criando uma jornada fluida que maximiza o LTV (Lifetime Value) do aluno/cliente.
- **Isolamento White-Label:** Arquitetura multilocatária (Multi-tenant) garantindo que múltiplas empresas utilizem o SaaS sem risco de vazamento ou cruzamento de dados.
- **Monetização Integrada:** Infraestrutura de pagamentos preparada para assinaturas e compras pontuais, eliminando a dependência de gateways externos engessados.

## Engenharia e Desafios Técnicos Resolvidos
Para sustentar uma operação SaaS corporativa, o backend foi projetado para ser defensivo e altamente performático:

1. **Segurança de Nível Empresarial e LGPD:** Implementamos criptografia de campo (AES-256-GCM) para dados sensíveis (PII) e mascaramento dinâmico em registros de auditoria. A autenticação utiliza JWT com chaves assimétricas (RS256), validação estrita de emissor (`issuer`), público (`audience`) e revogação ativa via Redis (Blacklist).
2. **Isolamento de Dados via RLS (Row-Level Security):**
   Para evitar falhas lógicas no código que poderiam expor dados de uma empresa para outra, a segurança multilocatária foi empurrada para a camada de banco de dados. Utilizamos políticas RLS nativas do PostgreSQL integradas ao Prisma ORM para blindar o acesso por `tenantId`.
3. **Resiliência de Infraestrutura:**
   Proteção ativa de rotas com Rate Limiting, Helmet (segurança de cabeçalhos HTTP), validação de assinatura em Webhooks (Stripe) e Guards globais de permissões baseadas em funções (RBAC).

## Stack Tecnológico
* **Backend:** Node.js, NestJS, TypeScript
* **Persistência e Segurança:** PostgreSQL, Prisma ORM (com RLS), Redis (JWT Blacklist)
* **Frontend:** React, Vite, SPA (Single Page Application)
* **Pagamentos:** Stripe (Checkout e Webhooks)

## Como Executar o Projeto Localmente

**Pré-requisitos:** Node.js instalado e instância do PostgreSQL disponível.

1. Clone o repositório:
   `git clone https://github.com/7Genesis/core-academy-meetpoint-.git`
2. Instale as dependências:
   `npm install`
3. Configure o ambiente:
   `cp .env.example .env` (Preencha as variáveis de conexão com o banco e chaves JWT/Stripe)
4. Gere o cliente Prisma:
   `npm run prisma:generate`
5. Inicialize os serviços:
   * Backend: `npm run start:dev` (http://127.0.0.1:3000)
   * Frontend: `npm run frontend:dev` (http://127.0.0.1:5173)

## Scripts de Automação Estratégica
* `npm run db:rls`: Aplica as políticas de segurança de nível de linha no banco de dados.
* `npm run db:seed`: Popula dados iniciais para validação do ambiente.
* Integração Contínua (CI/CD): Fluxos configurados via GitHub Actions para linting, build, auditoria de dependências (Dependabot) e deploy automatizado por ambiente.

## Próximos Passos (Roadmap de Produção)
O repositório reflete uma base madura pronta para o *go-live* definitivo após:
- Conexão e migração no banco de dados de produção.
- Configuração final de Webhooks do Stripe.
- Testes automatizados de carga e autorização cruzada entre inquilinos.
