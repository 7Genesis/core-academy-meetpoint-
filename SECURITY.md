# Security Policy

## Escopo

Este projeto envolve dados pessoais, pagamentos, comunidades, cursos, documentos
e possiveis informacoes sensiveis. Falhas de seguranca devem ser tratadas fora
de issues publicas.

## Como reportar

Nao publique payloads, tokens, prints com dados pessoais, credenciais, CPF, RG,
CNPJ, emails privados ou informacoes de pagamento em issues publicas.

Use GitHub Security Advisories:

```text
https://github.com/7Genesis/core-academy-meetpoint-/security/advisories/new
```

## Severidade

### Critica

- acesso entre tenants;
- bypass de autenticacao;
- vazamento de JWT, secrets ou PII;
- execucao remota de codigo;
- webhook de pagamento falsificavel.

### Alta

- IDOR em perfil, mensagens, cursos ou pagamentos;
- XSS persistente;
- upload inseguro;
- falha de autorizacao administrativa;
- RLS ausente em tabela sensivel.

### Media

- rate limit ausente;
- configuracao insegura de CORS;
- logs com dados parcialmente sensiveis;
- dependencia vulneravel sem exploit confirmado.

### Baixa

- headers incompletos;
- mensagens de erro excessivamente detalhadas;
- problemas de hardening sem impacto direto confirmado.

## Regras de Producao

- `JWT_ALGORITHM=RS256`;
- `CORS_ORIGIN` sem wildcard;
- `ENABLE_DEMO_LOGIN=false`;
- `PII_ENCRYPTION_KEY` forte e fora do repositorio;
- `STRIPE_WEBHOOK_SECRET` obrigatorio;
- RLS aplicado no PostgreSQL;
- usuario da aplicacao sem `BYPASSRLS`;
- `.env` nunca versionado.
