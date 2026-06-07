# Operations

## Deploy cPanel/Zip

Para o fluxo atual de hospedagem, usar os zips em `deploy-packages`.

Backend:

1. subir zip backend;
2. configurar `.env` no servidor;
3. rodar `npm install --omit=dev`;
4. rodar `npm run prisma:migrate:deploy`;
5. iniciar `node dist/main.js`.

Frontend:

1. subir zip frontend;
2. extrair o conteudo estatico no diretorio publico configurado para `/meetpoint/`.

## Deploy Kubernetes

1. Build/push da imagem.
2. Criar Secret real.
3. Aplicar manifests:

```bash
kubectl apply -k infra/kubernetes/overlays/production
```

## Validacoes

Comandos esperados:

```bash
npm run lint
npm run build
npm run frontend:build
npx prisma validate --schema=prisma/schema.prisma
```

Nao ha script `npm test` configurado no `package.json` atual.

## Observabilidade

Estado atual:

- `X-Request-ID`;
- logs Nest;
- auditoria RAG sanitizada inicial.

Proximo passo:

- OpenTelemetry SDK;
- Prometheus metrics endpoint;
- Grafana dashboards;
- Loki logs;
- Tempo/Jaeger traces;
- alertas para latencia, erro, custo LLM, cache hit e falha de ingestao.
