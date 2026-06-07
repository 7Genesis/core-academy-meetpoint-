# Agents

Agentes devem ser controlados por permissoes deterministicas.

Estrutura criada:

- `src/rag/domain/agent.ports.ts`
- `src/rag/agents/tool-registry.service.ts`

Componentes alvo:

- Planner
- Executor
- Tool Registry
- Tool Permissions
- Context Manager
- Memory
- Response Validator
- Audit Logger

Regras:

- ferramenta precisa existir em whitelist;
- permissao explicita por usuario/tenant;
- acoes de alto risco exigem confirmacao e auditoria;
- agente nao recebe secrets;
- agente nao acessa documentos fora do tenant/permissao;
- cada tool call registra status, input sanitizado e correlation id.

Ferramentas iniciais documentadas:

- `rag.search`: baixo risco, permissao `RAG_READ`;
- `admin.user.block`: alto risco, permissao `USERS_WRITE`.

Nenhum executor foi habilitado ainda. Isso e intencional: sem policy completa, executar tools reais seria risco.
