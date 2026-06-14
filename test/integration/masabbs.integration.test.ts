import { describe, expect, it } from "vitest";
import { MasabbsClient } from "../../src/masabbsClient.js";

const runIntegration = process.env.RUN_IT === "1";
const describeIntegration = runIntegration ? describe : describe.skip;
const baseUrl = process.env.MASABBS_BASE_URL ?? "http://localhost:8080/api/v1";

describeIntegration("masabbs integration", () => {
  const client = new MasabbsClient({
    baseUrl,
    timeoutMs: 10_000
  });

  it("checks health and reads organization snapshot", async () => {
    await expect(client.healthCheck()).resolves.toMatchObject({ status: "ok" });

    const organization = await client.getOrganization();
    expect(organization).toMatchObject({
      teams: expect.any(Array),
      agents: expect.any(Array),
      team_agents: expect.any(Array)
    });
    expect(organization).toHaveProperty("relations");
  });

  it("creates a thread through masabbs REST and reads messages through the MCP client layer", async () => {
    const thread = await createThread();

    await expect(
      client.postMessage({
        threadId: thread.thread_id,
        fromAgent: "gemini-agent",
        message: "確認しました。 @admin-ui"
      })
    ).resolves.toMatchObject({ id: expect.any(String) });

    const messages = await client.getThreadMessages(thread.thread_id);
    expect(messages.messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.messages.some((message) => message.text.includes("確認しました"))).toBe(true);

    await expect(client.getThreadKpi(thread.thread_id)).resolves.toMatchObject({
      thread_id: thread.thread_id,
      message_stats: expect.any(Object)
    });
  });

  it("configures team organization through the MCP client layer", async () => {
    const team = (await client.createTeam({
      name: `IT Review Team ${Date.now()}`,
      description: "integration test team",
      mission: "initial mission"
    })) as { id: string; name: string; mission: string };

    expect(team.id).toEqual(expect.any(String));

    await expect(
      client.updateTeam({
        teamId: team.id,
        mission: "review masabbs discussions and improve organization design"
      })
    ).resolves.toMatchObject({ message: expect.any(String) });

    await expect(client.addTeamMember({ teamId: team.id, agentId: "admin-ui" })).resolves.toMatchObject({
      message: expect.any(String)
    });
    await expect(client.addTeamMember({ teamId: team.id, agentId: "gemini-agent" })).resolves.toMatchObject({
      message: expect.any(String)
    });

    const relation = (await client.createTeamRelation({
      teamId: team.id,
      sourceId: "admin-ui",
      targetId: "gemini-agent",
      relationType: "boss"
    })) as { id: string };

    expect(relation.id).toEqual(expect.any(String));

    await expect(client.getTeamBlueprint(team.id)).resolves.toMatchObject({
      team_id: team.id,
      members: expect.any(Array),
      structure_mermaid: expect.stringContaining("graph TD")
    });

    await expect(client.deleteTeamRelation(relation.id)).resolves.toEqual({});
    await expect(client.removeTeamMember({ teamId: team.id, agentId: "gemini-agent" })).resolves.toEqual({});
  });
});

async function createThread(): Promise<{ thread_id: string; input_dir: string }> {
  const response = await fetch(`${baseUrl}/threads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      command: "疎通確認をお願いします。 @gemini-agent",
      created_by_agent: "admin-ui",
      team_id: "01H0V6P6V6P6V6P6V6P6V6P6V6"
    })
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(`failed to create integration thread: ${JSON.stringify(payload)}`);
  }

  return payload as { thread_id: string; input_dir: string };
}
