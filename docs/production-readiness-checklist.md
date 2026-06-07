# Checklist para Publicacao

Use este checklist quando o dono da hospedagem liberar acesso.

## Acessos Necessarios

Solicite ao dono da conta:

- acesso ao painel da hospedagem;
- acesso SSH ou terminal;
- permissao para criar banco PostgreSQL;
- usuario/senha do banco ou permissao para gerar;
- dominio/subdominio;
- acesso DNS;
- permissao para variaveis de ambiente;
- acesso a logs;
- politica de backup do banco.

## Banco de Dados

- [ ] Criar banco PostgreSQL.
- [ ] Criar usuario da aplicacao.
- [ ] Garantir que o usuario nao tenha `BYPASSRLS`.
- [ ] Configurar `DATABASE_URL`.
- [ ] Rodar `npx prisma migrate deploy`.
- [ ] Rodar `npx prisma db execute --schema prisma/schema.prisma --file prisma/rls.sql`.
- [ ] Validar login e consulta tenant.

## Backend

- [ ] Configurar Node.js 22.
- [ ] Instalar dependencias com `npm ci --omit=dev` se o build ja for feito fora.
- [ ] Definir `NODE_ENV=production`.
- [ ] Configurar `PORT`.
- [ ] Configurar `CORS_ORIGIN`.
- [ ] Configurar JWT RS256.
- [ ] Configurar `PII_ENCRYPTION_KEY`.
- [ ] Configurar Stripe/webhooks.
- [ ] Confirmar que nao existe rota de login demonstrativo publicada.

## Frontend

- [ ] Rodar `npm run frontend:build`.
- [ ] Publicar `frontend/dist`.
- [ ] Configurar `VITE_API_URL` para URL real da API.
- [ ] Testar navegacao mobile.
- [ ] Testar login/cadastro.
- [ ] Testar cursos.
- [ ] Testar suporte.

## Pagamentos

- [ ] Criar conta Stripe/gateway.
- [ ] Configurar webhook para backend.
- [ ] Configurar segredo do webhook.
- [ ] Testar pagamento aprovado.
- [ ] Testar pagamento recusado.
- [ ] Testar idempotencia de webhook.
- [ ] Confirmar matricula apenas pelo webhook.

## Storage e Midia

- [ ] Definir provedor para PDF/documentos.
- [ ] Usar URL assinada.
- [ ] Definir expiracao.
- [ ] Definir provedor para videos protegidos.
- [ ] Nao hospedar video grande no servidor Node.

## Seguranca

- [ ] `npm audit` sem vulnerabilidade critica.
- [ ] Gitleaks limpo.
- [ ] Semgrep limpo para achados criticos.
- [ ] `.env` fora do Git.
- [ ] RLS ativo.
- [ ] Headers Helmet ativos.
- [ ] CORS sem wildcard.
- [ ] Logs sem PII.
- [ ] Backups ativos.

## Smoke Test

Depois de publicar:

```text
GET /
POST /auth/register com dados validos
POST /auth/login com usuario real
GET /tenants/current com JWT
GET /courses com tenant valido
POST /support/chat
POST /payments/course-checkout
POST /webhooks/stripe com assinatura valida
```

## Decisao Go/No-Go

Pode publicar quando:

- CI verde;
- Security verde;
- banco migrado;
- RLS aplicado;
- login funcionando;
- CORS correto;
- checkout testado;
- suporte testado;
- rollback definido.

Nao publique se:

- houver secret no repositorio;
- login demo estiver ativo em producao;
- webhook aceitar payload sem assinatura;
- banco estiver sem RLS;
- documentos/videos privados estiverem publicos.
