import { describe, expect, it, vi } from "vitest";
import { MasabbsClient, MasabbsError, normalizeMessage, type FetchLike } from "../src/masabbsClient.js";

describe("MasabbsClient", () => {
  it("calls health endpoint", async () => {
    const fetchImpl = jsonFetch({ status: 200, body: { status: "ok" } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await expect(client.healthCheck()).resolves.toEqual({ status: "ok" });
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost/api/v1/health", expect.objectContaining({ method: "GET" }));
  });

  it("sends get_thread_context query parameters", async () => {
    const fetchImpl = jsonFetch({ status: 200, body: { root_thread: { id: "thread-1" } } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1/", timeoutMs: 1000, fetchImpl });

    await client.getThreadContext({
      threadId: "thread-1",
      includeSubthreads: true,
      messageLimit: 50,
      order: "desc"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/v1/threads/thread-1/context?include_subthreads=true&message_limit=50&order=desc",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("posts messages with required masabbs field names", async () => {
    const fetchImpl = jsonFetch({ status: 201, body: { id: "task-1" } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await client.postMessage({
      threadId: "thread-1",
      fromAgent: "agent-1",
      message: "hello",
      to: ["agent-2"],
      observers: ["observer-1"]
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/v1/threads/thread-1/messages",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from_agent: "agent-1",
          message: "hello",
          to: ["agent-2"],
          observers: ["observer-1"]
        })
      })
    );
  });

  it("creates and updates teams", async () => {
    const fetchImpl = jsonFetch({ status: 200, body: { message: "ok" } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await client.createTeam({ name: "Review Team", description: "desc", mission: "mission" });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://localhost/api/v1/teams",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Review Team", description: "desc", mission: "mission" })
      })
    );

    await client.updateTeam({ teamId: "team-1", mission: "new mission" });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://localhost/api/v1/teams/team-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ mission: "new mission" })
      })
    );
  });

  it("adds and removes team members", async () => {
    const fetchImpl = jsonFetch({ status: 200, body: { message: "ok" } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await client.addTeamMember({ teamId: "team-1", agentId: "agent-1" });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://localhost/api/v1/teams/team-1/agents/agent-1",
      expect.objectContaining({ method: "POST" })
    );

    await client.removeTeamMember({ teamId: "team-1", agentId: "agent-1" });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://localhost/api/v1/teams/team-1/agents/agent-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("creates and deletes team relations", async () => {
    const fetchImpl = jsonFetch({ status: 200, body: { id: "relation-1" } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await client.createTeamRelation({
      teamId: "team-1",
      sourceId: "manager",
      targetId: "worker",
      relationType: "boss",
      sourceHandle: "b",
      targetHandle: "t"
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://localhost/api/v1/relations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          team_id: "team-1",
          source_id: "manager",
          target_id: "worker",
          relation_type: "boss",
          source_handle: "b",
          target_handle: "t"
        })
      })
    );

    await client.deleteTeamRelation("relation-1");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://localhost/api/v1/relations/relation-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("gets team blueprint", async () => {
    const fetchImpl = jsonFetch({ status: 200, body: { team_id: "team-1", members: [], structure_mermaid: "graph TD\n" } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await client.getTeamBlueprint("team-1");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/v1/teams/team-1/blueprint",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("preserves masabbs error codes", async () => {
    const fetchImpl = jsonFetch({ status: 400, body: { error: "NO_RECIPIENT" } });
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await expect(client.postMessage({ threadId: "thread-1", fromAgent: "agent-1", message: "hello" })).rejects.toMatchObject({
      code: "NO_RECIPIENT",
      status: 400,
      source: "masabbs"
    });
  });

  it("maps transport failures to MASABBS_UNAVAILABLE", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockRejectedValue(new Error("connect ECONNREFUSED"));
    const client = new MasabbsClient({ baseUrl: "http://localhost/api/v1", timeoutMs: 1000, fetchImpl });

    await expect(client.healthCheck()).rejects.toBeInstanceOf(MasabbsError);
    await expect(client.healthCheck()).rejects.toMatchObject({
      code: "MASABBS_UNAVAILABLE",
      source: "masabbs-mcp"
    });
  });

  it("normalizes task and result message text", async () => {
    expect(
      normalizeMessage({
        id: "m1",
        type: "task",
        from: "agent-1",
        payload: { command: "do this @agent-2" }
      })
    ).toMatchObject({ text: "do this @agent-2" });

    expect(
      normalizeMessage({
        id: "m2",
        type: "result",
        from: "agent-2",
        payload: JSON.stringify({ message: "done", exit_code: 0 })
      })
    ).toMatchObject({ text: "done", payload: { message: "done", exit_code: 0 } });
  });
});

function jsonFetch(params: { status: number; body: unknown }): ReturnType<typeof vi.fn<FetchLike>> {
  return vi.fn<FetchLike>().mockImplementation(async () =>
    new Response(JSON.stringify(params.body), {
      status: params.status,
      headers: { "content-type": "application/json" }
    })
  );
}
