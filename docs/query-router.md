# Query Router

O Query Router nao deve deixar o LLM decidir sozinho. A aplicacao decide o caminho antes de consultar modelo ou ferramenta.

Implementacao inicial:

- `src/rag/query-router/deterministic-query-router.service.ts`

Decisoes:

- `DIRECT`
- `RAG`
- `RELATIONAL_DB`
- `AGENT`
- `REFUSE`

Criterios atuais:

- query vazia: recusa;
- risco alto: recusa;
- cache hit: resposta direta;
- termos de acao: agente;
- termos de base privada/documento: RAG;
- termos transacionais: banco relacional;
- caso geral: direto.

Proximas melhorias:

- classificador treinado ou prompt estruturado com schema;
- scoring de sensibilidade;
- custo estimado por modelo;
- circuit breaker por provider;
- cache hit por tenant/permissao/versao;
- roteamento por confianca de retrieval.
