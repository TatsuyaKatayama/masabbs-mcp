import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads required base URL and trims trailing slash", () => {
    expect(loadConfig({ MASABBS_BASE_URL: "http://localhost/api/v1/" })).toEqual({
      masabbsBaseUrl: "http://localhost/api/v1",
      timeoutMs: 10_000
    });
  });

  it("loads timeout override", () => {
    expect(loadConfig({ MASABBS_BASE_URL: "http://localhost/api/v1", MASABBS_TIMEOUT_MS: "2500" }).timeoutMs).toBe(2500);
  });

  it("rejects missing base URL", () => {
    expect(() => loadConfig({})).toThrow("MASABBS_BASE_URL is required");
  });

  it("rejects invalid timeout", () => {
    expect(() => loadConfig({ MASABBS_BASE_URL: "http://localhost/api/v1", MASABBS_TIMEOUT_MS: "0" })).toThrow(
      "MASABBS_TIMEOUT_MS must be a positive integer"
    );
  });
});
