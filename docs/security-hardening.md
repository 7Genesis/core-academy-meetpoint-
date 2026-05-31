# Auditoria de Segurança e Hardening

Escopo: API NestJS/Node.js, Prisma/PostgreSQL, autenticação JWT, dados pessoais, webhooks, suporte, uploads/mídia e infraestrutura AWS. Este documento descreve testes controlados para ambiente de staging, correções aplicadas neste repositório e controles que devem ser aplicados na AWS antes de produção.

## Sumário Executivo

- Crítico corrigido: JWT simétrico substituído por suporte a RS256, `kid`, `issuer`, `audience`, JWKS e revogação por `jti`.
- Alto corrigido: dados sensíveis em suporte, auditoria, webhook e solicitação de saque PIX agora são criptografados, sanitizados ou mascarados antes de persistência/retorno.
- Alto mitigado: cabeçalhos HTTP, CORS estrito, CSP em produção, validação global de DTOs, tenant obrigatório e RBAC já estão ativos e foram reforçados por validação de configuração.
- Infraestrutura entregue: Terraform em `infra/aws-hardening/main.tf` com WAF, S3 privado com SSE-KMS, KMS com rotação, IAM mínimo, VPC privada e Security Groups restritos.
- Risco residual: feed social, mensagens privadas, uploads de mídia e perfis ainda são majoritariamente protótipo/frontend. Quando esses módulos virarem API real, precisam usar os mesmos guards, validações e criptografia.

## 1. Autenticação e Sessão

### Vetor de Ataque

- JWT `alg:none`: atacante troca o header para `{"alg":"none"}` e remove a assinatura.
- Confusão HS256/RS256: atacante tenta usar chave pública como segredo HMAC quando o backend aceita múltiplos algoritmos.
- Replay token: token válido capturado por XSS, log indevido ou proxy é reutilizado até expirar.
- Side-channel por cookie/localStorage: exposição de token em JavaScript ou em logs.

Payload controlado em staging:

```text
Header malicioso: {"alg":"none","typ":"JWT"}
Replay: reutilizar o mesmo access_token após logout
Confusão de algoritmo: header RS256 -> HS256 com mesmo payload
```

### Código/Configuração de Correção

- `src/auth/jwt-key.service.ts`: centraliza algoritmo permitido, `kid`, `issuer`, `audience`, chave privada/pública e JWKS.
- `src/auth/jwt.strategy.ts`: rejeita `alg:none`, valida algoritmo único, valida `kid`, `issuer`, `audience`, expiração e revogação por `jti`.
- `src/auth/token-revocation.service.ts`: revoga `jti` com TTL em Redis, com fallback local para desenvolvimento.
- `src/auth/auth.controller.ts`: adiciona `POST /auth/logout` e `GET /auth/jwks.json`.
- `.env.example` e `src/config/validate-runtime-config.ts`: produção exige RS256, chaves PEM, Redis e chave FLE.

### Mecanismo de Proteção de Dados

- Token só deve trafegar em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Tokens revogados não devem passar na estratégia JWT mesmo antes do `exp`.
- Nenhum token deve ser persistido em logs ou auditoria.

## 2. BOLA/IDOR e BFLA

### Vetor de Ataque

- Usuário troca `userId`, `courseId`, `lessonId`, `conversationId` ou `tenantId` para acessar recurso de outro usuário.
- Usuário com papel comum tenta executar ação administrativa, por exemplo criar curso, banir usuário ou ver ticket.
- Tenant A envia `X-Tenant-ID` de Tenant B.

Payload controlado em staging:

```http
GET /courses/{courseId-de-outro-tenant}
PATCH /lessons/{lessonId-de-outro-tenant}/progress/complete
X-Tenant-ID: 11111111-1111-4111-8111-111111111111
```

### Código/Configuração de Correção

- `TenantGuard` já obriga `tenantId` por linha e bloqueia divergência entre JWT e `X-Tenant-ID`.
- `RolesGuard` mantém BFLA por papel.
- `PrismaService.withTenant()` define `app.current_tenant_id`, base para RLS no PostgreSQL.
- `src/common/security/access-control.ts` adiciona helpers ABAC para novos módulos de perfil/mensagens.

### Mecanismo de Proteção de Dados

- O `tenantId` deve ser parte de todas as constraints compostas sensíveis.
- Mensagens privadas futuras devem ter tabela de participantes e validação `participant.userId = currentUser.sub`.
- Administrador de plataforma deve acessar via rotas `@PlatformWide`, com auditoria redatada.

## 3. Injection e XSS Persistente

### Vetor de Ataque

- SQLi em uso de `$queryRawUnsafe` ou concatenação em filtros.
- XSS persistente em posts, comentários, suporte, perfil e comunidades.
- Mass assignment por campos extras no JSON.

Payload controlado em staging:

```text
SQLi benigno: ' OR '1'='1
XSS benigno: <img src=x onerror=alert(1)>
Mass assignment: {"role":"ADMIN","platformRole":"OWNER"}
```

### Código/Configuração de Correção

- `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues` e `transform`.
- Prisma usa query builder e template tagged raw no `set_config`, sem interpolação insegura.
- `src/common/security/data-masking.service.ts`: sanitiza textos, remove scripts/event handlers e redige segredos.
- `src/support/support.service.ts` e `src/platform-admin/platform-admin.service.ts`: sanitização antes de persistir/retornar entradas humanas.
- `helmet` com CSP restritivo em produção.

### Mecanismo de Proteção de Dados

- Retornos administrativos passam por mascaramento dinâmico.
- Logs/auditorias redigem CPF, CNPJ, email, JWT, chaves Stripe, `whsec_*` e campos sensíveis.

## 4. SSRF em Uploads, Webhooks e Integrações

### Vetor de Ataque

- URL externa aponta para metadata service: `http://169.254.169.254/latest/meta-data/`.
- Webhook falso tenta acionar matrícula sem assinatura.
- Integração de IA aponta para host interno não autorizado.

Payload controlado em staging:

```text
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://localhost:5432/
http://10.0.0.5/admin
```

### Código/Configuração de Correção

- `SupportService.resolveOllamaUrl()` só permite `localhost` ou `OLLAMA_ALLOWED_ORIGINS`.
- `WebhooksService.assertStripeSignature()` valida HMAC, timestamp tolerance e idempotência por `gatewayEventId`.
- Webhook payload agora é redigido antes de persistir.

### Mecanismo de Proteção de Dados

- Uploads futuros devem aceitar somente arquivos enviados pelo cliente, não fetch de URL arbitrária.
- Caso seja necessário importar por URL, aplicar allowlist de domínio, bloqueio de IP privado/link-local, DNS pinning e limite de tamanho/content-type.

## 5. AWS Misconfiguration

### Vetor de Ataque

- S3 bucket público expondo PDFs, vídeos, anexos e documentos.
- IAM Role da aplicação com `s3:*` ou `kms:*`.
- RDS público ou Security Group liberado para `0.0.0.0/0`.
- Ausência de WAF/rate limit em endpoints de login, busca, feed e webhooks.

### Código/Configuração de Correção

- `infra/aws-hardening/main.tf` cria:
  - AWS WAF com rule groups gerenciados, SQLi, known bad inputs e rate limiting.
  - S3 privado com Block Public Access, versioning e SSE-KMS.
  - KMS com rotação.
  - IAM runtime de menor privilégio.
  - VPC com subnets privadas e SG de RDS aceitando PostgreSQL apenas do SG da aplicação.

### Mecanismo de Proteção de Dados

- Conteúdo privado deve ser entregue por URL assinada curta, nunca por bucket público.
- RDS deve usar encryption at rest com KMS, backups criptografados, SSL obrigatório e RLS habilitado.
- CloudWatch deve receber logs anonimizados.

## 6. Field-Level Encryption, Masking e LGPD

### Vetor de Ataque

- DBA ou operador com leitura direta no banco visualiza PIX, CPF, email, tickets ou payloads de pagamento.
- Logs de auditoria armazenam PII ou tokens.
- Suporte/operador visualiza dados que não precisa para resolver o chamado.

### Código/Configuração de Correção

- `src/common/security/field-encryption.service.ts`: AES-256-GCM com IV de 96 bits e tag de autenticação.
- `PlatformFeePayout.pixKey` e `accountDocument`: criptografados antes de persistir.
- `SupportTicket.description`: criptografado antes de persistir e mascarado quando listado.
- `PaymentWebhookEvent.payload`: redigido antes de persistir.
- `PlatformAuditLog.metadata`: redigido antes de persistir.

### Mecanismo de Proteção de Dados

- Chave `PII_ENCRYPTION_KEY` deve ser gerada fora do repositório, armazenada no AWS Secrets Manager ou SSM Parameter Store criptografado por KMS.
- Para produção, recomenda-se envelope encryption com AWS KMS por tenant ou por classe de dado.
- Acesso administrativo deve registrar ator, alvo, ação e metadados minimizados.

## 7. Checklist de Produção

- Gerar par RSA 2048/3072 ou P-256 equivalente conforme política interna e preencher `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KID`.
- Configurar `REDIS_URL` com TLS para revogação de tokens.
- Gerar `PII_ENCRYPTION_KEY` com 32 bytes aleatórios.
- Aplicar Terraform em conta AWS segregada.
- Associar `aws_wafv2_web_acl.api` ao ALB/API Gateway/CloudFront usado pela API.
- Habilitar RLS no PostgreSQL para tabelas com `tenantId`.
- Criar pipeline SAST/secret scanning/dependency scanning antes de merge.
- Desativar demo login e Swagger em produção.
