# DevOps and Kubernetes

Arquivos adicionados:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `infra/kubernetes/base/*`
- `infra/kubernetes/overlays/*`

## Docker

O Dockerfile usa multi-stage build:

1. `deps`: instala dependencias com `npm ci`;
2. `build`: compila backend e frontend;
3. `runner`: instala dependencias de producao e roda `node dist/main.js`.

## Kubernetes

Base inclui:

- Namespace;
- ConfigMap;
- Secret template, nao aplicado por kustomization;
- Deployment;
- Service;
- Ingress;
- HPA;
- PodDisruptionBudget;
- ServiceAccount/RBAC minimo;
- NetworkPolicy;
- probes `/healthz` e `/readyz`;
- resource requests/limits.

## Secrets

Nao commitar secrets reais. Use uma destas opcoes:

- Secret criado no cluster por pipeline seguro;
- External Secrets Operator;
- Sealed Secrets;
- Secret Manager do provedor cloud.

## Ambientes

Overlays criados:

- `development`;
- `staging`;
- `production`.

Antes de producao, substituir:

- image tag;
- host do Ingress;
- TLS secret;
- Secret real;
- politicas de network e egress conforme cluster.
