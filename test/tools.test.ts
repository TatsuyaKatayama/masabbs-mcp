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
