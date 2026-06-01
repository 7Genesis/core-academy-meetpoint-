# Otimizacao de Recursos

Este documento define ajustes para reduzir custo, melhorar performance e evitar
problemas quando a plataforma crescer.

## Principios

- video e arquivo pesado nao devem ficar no servidor da API;
- tudo que lista muitos dados precisa paginacao;
- tarefas demoradas devem ir para fila;
- dados de tenant devem ter indices;
- cache deve ser usado onde nao compromete seguranca;
- logs nao podem expor PII.

## Frontend

Prioridades:

1. Separar `frontend/src/main.jsx` em componentes por dominio.
2. Usar lazy loading por pagina.
3. Carregar modais grandes sob demanda.
4. Otimizar imagens antes do upload.
5. Usar CDN para assets estaticos.
6. Evitar renderizar listas grandes sem paginacao.

Indicadores alvo:

| Metrica | Alvo inicial |
| --- | --- |
| JS inicial gzip | menor que 250 KB |
| CSS gzip | menor que 80 KB |
| LCP mobile | menor que 2.5s |
| TBT | menor que 200ms |

## Backend

Prioridades:

1. Validacao DTO em todas as entradas.
2. Rate limit por IP, usuario e tenant.
3. Paginar feed, mensagens, cursos, eventos e oportunidades.
4. Evitar joins grandes sem indice.
5. Usar filas para email, WhatsApp, notificacao e processamento de arquivos.
6. Usar Redis para cache de dados pouco volateis.

Cache recomendado:

| Dado | TTL inicial |
| --- | --- |
| catalogo publico de cursos | 60s |
| dados publicos de perfil | 60s |
| configuracao de tenant | 300s |
| permissoes de admin | 60s |

Nao cachear:

- documentos;
- tokens;
- dados financeiros sensiveis;
- mensagens privadas sem criptografia e controle forte.

## PostgreSQL

Indices minimos:

```text
tenantId
tenantId + createdAt
tenantId + userId
tenantId + courseId
tenantId + status
userId + lessonId
courseId + userId
verificationCode unique
requesterEmailHash
```

Regras:

- todo endpoint multi-tenant deve filtrar por `tenantId`;
- RLS deve estar ativa em tabelas principais;
- usuario da aplicacao nao deve ter `BYPASSRLS`;
- usar pool de conexao em producao;
- separar leitura pesada de escrita quando escalar.

## Midia

Videos:

- YouTube para conteudo publico ou prototipo;
- Bunny/Vimeo para aulas protegidas;
- nunca servir video grande pelo NestJS.

Materiais:

- S3 ou equivalente;
- URL assinada;
- expiracao curta;
- autorizacao por usuario, curso e tenant antes de gerar link.

## Pagamentos

- webhook precisa ser idempotente;
- salvar `eventId` do gateway;
- nao confiar no frontend para liberar curso;
- liberar matricula somente apos confirmacao do webhook;
- registrar taxa da plataforma e repasse do produtor.

## Suporte e IA

- IA responde somente duvidas simples;
- pagamento, documento, bloqueio, denuncia e seguranca sempre escalam para humano;
- mensagens devem ser mascaradas em logs;
- tickets devem guardar email criptografado e hash para busca.

## Custo

Ordem para controlar custo:

1. CDN para frontend.
2. Storage externo para midias.
3. Banco com backups e pool.
4. Redis somente quando houver necessidade real.
5. Filas antes de aumentar servidor.
6. Monitoramento antes de escalar maquina.

## Sinais de que precisa escalar

- p95 da API maior que 500ms;
- CPU acima de 70% por varios minutos;
- pool de banco saturado;
- fila de webhook atrasando;
- erros 429/5xx frequentes;
- uploads ou videos consumindo rede do backend.

## Decisao

O maior ganho agora nao e trocar servidor. E separar responsabilidades:

```text
Frontend estatico -> CDN
API -> Node/NestJS
Banco -> PostgreSQL
Midia -> CDN/Storage
Tarefas -> fila
Cache -> Redis quando necessario
```
