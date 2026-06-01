## Objetivo

Descreva claramente o que este PR entrega.

## Tipo de mudanca

- [ ] Feature
- [ ] Correcao
- [ ] UI/UX
- [ ] Backend/API
- [ ] Banco/migration
- [ ] Seguranca
- [ ] CI/CD
- [ ] Documentacao

## Checklist tecnico

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run frontend:build`
- [ ] `npx prisma validate` quando houver mudanca no Prisma
- [ ] Fluxo principal testado no navegador quando houver mudanca visual
- [ ] Nenhum `.env`, token, senha, chave ou credencial no diff

## Banco de dados

- [ ] Nao altera banco
- [ ] Altera `prisma/schema.prisma`
- [ ] Inclui migration
- [ ] Exige aplicar `prisma/rls.sql`
- [ ] Tem plano de rollback

## Seguranca e privacidade

- [ ] Mantem isolamento por `tenantId`
- [ ] Nao expõe PII em logs/respostas
- [ ] Rotas sensiveis exigem autenticacao/autorizacao
- [ ] Upload, pagamento, documento ou webhook foram revisados

## Evidencias

Inclua prints, video curto, logs de comandos ou resumo do teste executado.

## Observacoes

Liste riscos, pendencias ou decisoes que precisam de revisao.
