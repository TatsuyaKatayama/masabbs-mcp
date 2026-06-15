#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import { loadConfig } from "./config.js";
import { MasabbsClient } from "./masabbsClient.js";
import { createToolHandlers, errorResult } from "./tools.js";

export function createServer(client: MasabbsClient): McpServer {
  const server = new McpServer({
    name: "masabbs-mcp",
    version: "0.2.0"
  });
  const tools = createToolHandlers(client);

  server.registerTool(
    "health_check",
    {
      title: "Health Check",
      description: "Check masabbs API availability."
    },
    async () => withErrorHandling(() => tools.healthCheck())
  );

  server.registerTool(
    "get_organization",
    {
      title: "Get Organization",
      description: "Return the current masabbs organization configuration."
    },
    async () => withErrorHandling(() => tools.getOrganization())
  );

  server.registerTool(
    "get_thread_context",
    {
      title: "Get Thread Context",
      description: "Return thread-centered discussion context, optionally including recursive subthreads.",
      inputSchema: {
        thread_id: z.string().min(1).describe("Root thread ID."),
        include_subthreads: z.boolean().optional().default(true),
        message_limit: z.number().int().positive().optional(),
        order: z.enum(["asc", "desc"]).optional().default("asc")
      }
    },
    async (input) => withErrorHandling(() => tools.getThreadContext(input))
  );

  server.registerTool(
    "get_thread_messages",
    {
      title: "Get Thread Messages",
      description: "Return messages directly attached to one thread.",
      inputSchema: {
        thread_id: z.string().min(1).describe("Thread ID.")
      }
    },
    async (input) => withErrorHandling(() => tools.getThreadMessages(input))
  );

  server.registerTool(
    "post_message",
    {
      title: "Post Message",
      description: "Post a message to an existing masabbs thread through the REST API.",
      inputSchema: {
        thread_id: z.string().min(1),
        from_agent: z.string().min(1),
        message: z.string().min(1),
        to: z.array(z.string().min(1)).optional(),
        observers: z.array(z.string().min(1)).optional(),
        output_dir: z.string().optional(),
        error: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => withErrorHandling(() => tools.postMessage(input))
  );

  server.registerTool(
    "get_thread_kpi",
    {
      title: "Get Thread KPI",
      description: "Return KPI data for a thread and its recursive subthreads.",
      inputSchema: {
        thread_id: z.string().min(1)
      }
    },
    async (input) => withErrorHandling(() => tools.getThreadKpi(input))
  );

  server.registerTool(
    "get_team_kpi",
    {
      title: "Get Team KPI",
      description: "Return KPI data for a masabbs team.",
      inputSchema: {
        team_id: z.string().min(1)
      }
    },
    async (input) => withErrorHandling(() => tools.getTeamKpi(input))
  );

  server.registerTool(
    "create_team",
    {
      title: "Create Team",
      description: "Create a masabbs team with optional description and mission.",
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        mission: z.string().optional()
      }
    },
    async (input) => withErrorHandling(() => tools.createTeam(input))
  );

  server.registerTool(
    "update_team",
    {
      title: "Update Team",
      description: "Update a masabbs team name, description, or mission.",
      inputSchema: {
        team_id: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        mission: z.string().optional()
      }
    },
    async (input) => withErrorHandling(() => tools.updateTeam(input))
  );

  server.registerTool(
    "add_team_member",
    {
      title: "Add Team Member",
      description: "Add an existing agent to a team.",
      inputSchema: {
        team_id: z.string().min(1),
        agent_id: z.string().min(1)
      }
    },
    async (input) => withErrorHandling(() => tools.addTeamMember(input))
  );

  server.registerTool(
    "remove_team_member",
    {
      title: "Remove Team Member",
      description: "Remove an agent from a team. masabbs also removes team relations involving that agent.",
      inputSchema: {
        team_id: z.string().min(1),
        agent_id: z.string().min(1)
      }
    },
    async (input) => withErrorHandling(() => tools.removeTeamMember(input))
  );

  server.registerTool(
    "create_team_relation",
    {
      title: "Create Team Relation",
      description: "Create or update a team relation between two agents. relation_type must be boss or coworker.",
      inputSchema: {
        team_id: z.string().min(1),
        source_id: z.string().min(1),
        target_id: z.string().min(1),
        relation_type: z.enum(["boss", "coworker"]),
        source_handle: z.string().optional(),
        target_handle: z.string().optional()
      }
    },
    async (input) => withErrorHandling(() => tools.createTeamRelation(input))
  );

  server.registerTool(
    "delete_team_relation",
    {
      title: "Delete Team Relation",
      description: "Delete a team relation by relation ID.",
      inputSchema: {
        relation_id: z.string().min(1)
      }
    },
    async (input) => withErrorHandling(() => tools.deleteTeamRelation(input))
  );

  server.registerTool(
    "get_team_blueprint",
    {
      title: "Get Team Blueprint",
      description: "Return the Mermaid structure and members for a team.",
      inputSchema: {
        team_id: z.string().min(1)
      }
    },
    async (input) => withErrorHandling(() => tools.getTeamBlueprint(input))
  );

  return server;
}

async function withErrorHandling(fn: () => Promise<ReturnType<typeof errorResult>>) {
  try {
    return await fn();
  } catch (error) {
    return errorResult(error);
  }
}

async function main() {
  const config = loadConfig();
  const client = new MasabbsClient({
    baseUrl: config.masabbsBaseUrl,
    timeoutMs: config.timeoutMs
  });
  const server = createServer(client);
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
