import { describe, expect, it } from "vitest";
import { MasabbsError } from "../src/masabbsClient.js";
import { errorResult, okResult } from "../src/tools.js";

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
