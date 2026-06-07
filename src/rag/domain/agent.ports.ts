import { RagPrincipal } from './rag.types';

export type AgentToolRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export type AgentToolDefinition = {
  name: string;
  description: string;
  requiredPermissions: string[];
  risk: AgentToolRisk;
};

export type AgentPlanStep = {
  toolName: string;
  input: Record<string, unknown>;
  reason: string;
};

export abstract class AgentPlanner {
  abstract plan(input: {
    objective: string;
    principal: RagPrincipal;
  }): Promise<AgentPlanStep[]>;
}

export abstract class AgentExecutor {
  abstract execute(input: {
    plan: AgentPlanStep[];
    principal: RagPrincipal;
    correlationId: string;
  }): Promise<{ output: string; toolCalls: Array<{ toolName: string; status: string }> }>;
}

export abstract class ToolRegistry {
  abstract listAllowedTools(principal: RagPrincipal): Promise<AgentToolDefinition[]>;
  abstract assertToolAllowed(input: {
    toolName: string;
    principal: RagPrincipal;
  }): Promise<void>;
}
