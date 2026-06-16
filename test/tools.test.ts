import { describe, expect, it } from "vitest";
import { MasabbsError } from "../src/masabbsClient.js";
import { createToolHandlers, errorResult, okResult } from "../src/tools.js";

describe("tool results", () => {
  it("returns structured content for successful calls", () => {
    const result = okResult({ status: "ok" });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ status: "ok" });
    expect(result.content[0]).toMatchObject({ type: "text" });
  });

  it("returns MCP-visible masabbs errors", () => {
    const result = errorResult(
      new MasabbsError({
        code: "THREAD_NOT_FOUND",
        status: 404,
        source: "masabbs",
        details: { error: "THREAD_NOT_FOUND" }
      })
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: "THREAD_NOT_FOUND",
      status: 404,
      source: "masabbs"
    });
  });
});

describe("organization tool handlers", () => {
  it("maps thread tool input to client calls", async () => {
    const calls: unknown[] = [];
    const handlers = createToolHandlers({
      createThread: async (input: unknown) => {
        calls.push(input);
        return { thread_id: "thread-1" };
      }
    } as never);

    const result = await handlers.createThread({
      command: "hello",
      created_by_agent: "admin-ui",
      to: ["gemini-agent"],
      team_id: "team-1"
    });

    expect(calls).toEqual([
      {
        command: "hello",
        createdByAgent: "admin-ui",
        to: ["gemini-agent"],
        teamId: "team-1"
      }
    ]);
    expect(result.structuredContent).toEqual({ thread_id: "thread-1" });
  });

  it("maps agent tool input to client calls", async () => {
    const calls: unknown[] = [];
    const handlers = createToolHandlers({
      updateAgent: async (input: unknown) => {
        calls.push(input);
        return { message: "ok" };
      }
    } as never);

    const result = await handlers.updateAgent({
      agent_id: "gemini-agent",
      mission: "review",
      ui_pos_x: 100
    });

    expect(calls).toEqual([
      {
        agentId: "gemini-agent",
        mission: "review",
        uiPosX: 100
      }
    ]);
    expect(result.structuredContent).toEqual({ message: "ok" });
  });

  it("maps team tool input to client calls", async () => {
    const calls: unknown[] = [];
    const handlers = createToolHandlers({
      createTeam: async (input: unknown) => {
        calls.push(input);
        return { id: "team-1" };
      }
    } as never);

    const result = await handlers.createTeam({ name: "Team", mission: "Mission" });

    expect(calls).toEqual([{ name: "Team", mission: "Mission" }]);
    expect(result.structuredContent).toEqual({ id: "team-1" });
  });

  it("maps relation tool input to client calls", async () => {
    const calls: unknown[] = [];
    const handlers = createToolHandlers({
      createTeamRelation: async (input: unknown) => {
        calls.push(input);
        return { id: "relation-1" };
      }
    } as never);

    const result = await handlers.createTeamRelation({
      team_id: "team-1",
      source_id: "admin-ui",
      target_id: "gemini-agent",
      relation_type: "boss"
    });

    expect(calls).toEqual([
      {
        teamId: "team-1",
        sourceId: "admin-ui",
        targetId: "gemini-agent",
        relationType: "boss"
      }
    ]);
    expect(result.structuredContent).toEqual({ id: "relation-1" });
  });
});
