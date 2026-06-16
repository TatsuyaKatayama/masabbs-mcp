import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v3";
import { MasabbsClient, MasabbsError } from "./masabbsClient.js";

export const threadIdSchema = z.string().min(1);
export const teamIdSchema = z.string().min(1);

export function createToolHandlers(client: MasabbsClient) {
  return {
    healthCheck: async (): Promise<CallToolResult> => okResult(await client.healthCheck()),

    getOrganization: async (): Promise<CallToolResult> => okResult(await client.getOrganization()),

    getThreadContext: async (input: {
      thread_id: string;
      include_subthreads?: boolean;
      message_limit?: number;
      order?: "asc" | "desc";
    }): Promise<CallToolResult> =>
      okResult(
        await client.getThreadContext({
          threadId: input.thread_id,
          includeSubthreads: input.include_subthreads,
          messageLimit: input.message_limit,
          order: input.order
        })
      ),

    getThreadMessages: async (input: { thread_id: string }): Promise<CallToolResult> =>
      okResult(await client.getThreadMessages(input.thread_id)),

    createThread: async (input: {
      thread_id?: string;
      command: string;
      created_by_agent: string;
      to?: string[];
      observers?: string[];
      parent_thread_id?: string;
      deadline?: string;
      team_id?: string;
    }): Promise<CallToolResult> =>
      okResult(
        await client.createThread({
          threadId: input.thread_id,
          command: input.command,
          createdByAgent: input.created_by_agent,
          to: input.to,
          observers: input.observers,
          parentThreadId: input.parent_thread_id,
          deadline: input.deadline,
          teamId: input.team_id
        })
      ),

    postMessage: async (input: {
      thread_id: string;
      from_agent: string;
      message: string;
      to?: string[];
      observers?: string[];
      output_dir?: string;
      error?: string;
      metadata?: Record<string, unknown>;
    }): Promise<CallToolResult> =>
      okResult(
        await client.postMessage({
          threadId: input.thread_id,
          fromAgent: input.from_agent,
          message: input.message,
          to: input.to,
          observers: input.observers,
          outputDir: input.output_dir,
          error: input.error,
          metadata: input.metadata
        })
      ),

    getThreadKpi: async (input: { thread_id: string }): Promise<CallToolResult> =>
      okResult(await client.getThreadKpi(input.thread_id)),

    getTeamKpi: async (input: { team_id: string }): Promise<CallToolResult> =>
      okResult(await client.getTeamKpi(input.team_id)),

    createAgent: async (input: {
      id: string;
      name: string;
      role: string;
      mission?: string;
    }): Promise<CallToolResult> => okResult(await client.createAgent(input)),

    updateAgent: async (input: {
      agent_id: string;
      name?: string;
      role?: string;
      mission?: string;
      team_id?: string;
      ui_pos_x?: number;
      ui_pos_y?: number;
    }): Promise<CallToolResult> =>
      okResult(
        await client.updateAgent({
          agentId: input.agent_id,
          name: input.name,
          role: input.role,
          mission: input.mission,
          teamId: input.team_id,
          uiPosX: input.ui_pos_x,
          uiPosY: input.ui_pos_y
        })
      ),

    createTeam: async (input: { name: string; description?: string; mission?: string }): Promise<CallToolResult> =>
      okResult(await client.createTeam(input)),

    updateTeam: async (input: {
      team_id: string;
      name?: string;
      description?: string;
      mission?: string;
    }): Promise<CallToolResult> =>
      okResult(
        await client.updateTeam({
          teamId: input.team_id,
          name: input.name,
          description: input.description,
          mission: input.mission
        })
      ),

    addTeamMember: async (input: { team_id: string; agent_id: string }): Promise<CallToolResult> =>
      okResult(await client.addTeamMember({ teamId: input.team_id, agentId: input.agent_id })),

    removeTeamMember: async (input: { team_id: string; agent_id: string }): Promise<CallToolResult> =>
      okResult(await client.removeTeamMember({ teamId: input.team_id, agentId: input.agent_id })),

    createTeamRelation: async (input: {
      team_id: string;
      source_id: string;
      target_id: string;
      relation_type: "boss" | "coworker";
      source_handle?: string;
      target_handle?: string;
    }): Promise<CallToolResult> =>
      okResult(
        await client.createTeamRelation({
          teamId: input.team_id,
          sourceId: input.source_id,
          targetId: input.target_id,
          relationType: input.relation_type,
          sourceHandle: input.source_handle,
          targetHandle: input.target_handle
        })
      ),

    deleteTeamRelation: async (input: { relation_id: string }): Promise<CallToolResult> =>
      okResult(await client.deleteTeamRelation(input.relation_id)),

    getTeamBlueprint: async (input: { team_id: string }): Promise<CallToolResult> =>
      okResult(await client.getTeamBlueprint(input.team_id))
  };
}

export function okResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: asStructuredContent(data)
  };
}

export function errorResult(error: unknown): CallToolResult {
  if (error instanceof MasabbsError) {
    const data = {
      error: error.code,
      status: error.status,
      source: error.source,
      message: error.message,
      details: error.details
    };
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2)
        }
      ],
      structuredContent: data
    };
  }

  const data = {
    error: "MASABBS_MCP_ERROR",
    source: "masabbs-mcp",
    message: error instanceof Error ? error.message : String(error)
  };
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data
  };
}

function asStructuredContent(data: unknown): Record<string, unknown> | undefined {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { data };
}
