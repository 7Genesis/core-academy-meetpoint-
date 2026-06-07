import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AgentToolDefinition,
  ToolRegistry,
} from '../domain/agent.ports';
import { RagPrincipal } from '../domain/rag.types';

const REGISTERED_TOOLS: AgentToolDefinition[] = [
  {
    name: 'rag.search',
    description: 'Search tenant-scoped private knowledge base.',
    requiredPermissions: ['RAG_READ'],
    risk: 'LOW',
  },
  {
    name: 'admin.user.block',
    description: 'Block an active user account.',
    requiredPermissions: ['USERS_WRITE'],
    risk: 'HIGH',
  },
];

@Injectable()
export class ControlledToolRegistryService extends ToolRegistry {
  async listAllowedTools(principal: RagPrincipal): Promise<AgentToolDefinition[]> {
    return REGISTERED_TOOLS.filter((tool) =>
      tool.requiredPermissions.every((permission) =>
        principal.permissions.includes(permission),
      ),
    );
  }

  async assertToolAllowed(input: {
    toolName: string;
    principal: RagPrincipal;
  }): Promise<void> {
    const allowed = await this.listAllowedTools(input.principal);
    if (!allowed.some((tool) => tool.name === input.toolName)) {
      throw new ForbiddenException('Agent tool is not allowed for this principal');
    }
  }
}
