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
      message: "hello @agent-2"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/v1/threads/thread-1/messages",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from_agent: "agent-1", message: "hello @agent-2" })
      })
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
  return vi.fn<FetchLike>().mockResolvedValue(
    new Response(JSON.stringify(params.body), {
      status: params.status,
      headers: { "content-type": "application/json" }
    })
  );
}
