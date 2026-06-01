# Configuracao do GitHub

Este arquivo lista o que deve ser configurado quando o dono da conta liberar
acesso administrativo ao repositorio.

## Branches

Crie a branch `develop` a partir da `main` depois que o estado atual estiver
commitado e enviado.

```bash
git checkout main
git pull
git checkout -b develop
git push -u origin develop
```

## Branch Protection

Configure em:

```text
Settings -> Branches -> Branch protection rules
```

### `main`

Ativar:

- Require a pull request before merging;
- Require approvals: 1 ou mais;
- Dismiss stale pull request approvals;
- Require status checks to pass;
- Require branches to be up to date;
- Restrict who can push;
- Do not allow bypassing the above settings;
- Require conversation resolution before merging.

Status checks obrigatorios:

```text
CI / Lint, Build and Prisma Validate
Security / Dependency Audit
Security / Secret Scan
Security / Semgrep SAST
```

### `develop`

Ativar:

- Require a pull request before merging;
- Require status checks to pass;
- Require branches to be up to date;
- Require conversation resolution before merging.

## Environments

Configure em:

```text
Settings -> Environments
```

### `staging`

- Sem aprovacao obrigatoria inicialmente;
- Secrets separados de producao;
- Deploy automatico a partir de `develop`.

### `production`

- Exigir aprovacao manual;
- Restringir deploy a `main` ou releases;
- Secrets de producao separados.

## Secrets

Configure em:

```text
Settings -> Secrets and variables -> Actions
```

### Staging

```text
STAGING_DATABASE_URL
STAGING_DEPLOY_WEBHOOK_URL
STAGING_DEPLOY_WEBHOOK_TOKEN
```

### Production

```text
PRODUCTION_DATABASE_URL
PRODUCTION_DEPLOY_WEBHOOK_URL
PRODUCTION_DEPLOY_WEBHOOK_TOKEN
JWT_ALGORITHM
JWT_PRIVATE_KEY
JWT_PUBLIC_KEY
JWT_KID
JWT_ISSUER
JWT_AUDIENCE
PII_ENCRYPTION_KEY
REDIS_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CORS_ORIGIN
CHECKOUT_ALLOWED_ORIGINS
OLLAMA_URL
OLLAMA_ALLOWED_ORIGINS
```

## Dependabot

O arquivo `.github/dependabot.yml` ja esta configurado para npm semanal.
Quando o projeto estiver em producao, mantenha:

- limite de PRs baixo;
- updates agrupados;
- review obrigatorio;
- CI obrigatorio.

## PR e Issues

Arquivos ja preparados:

```text
.github/PULL_REQUEST_TEMPLATE.md
.github/ISSUE_TEMPLATE/bug_report.yml
.github/ISSUE_TEMPLATE/feature_request.yml
.github/ISSUE_TEMPLATE/config.yml
SECURITY.md
```

## Ordem Recomendada

1. Commitar estado atual.
2. Enviar `main`.
3. Criar `develop`.
4. Ativar branch protection.
5. Criar environments.
6. Cadastrar secrets de staging.
7. Testar deploy staging.
8. Cadastrar secrets de production.
9. Publicar primeira release.
