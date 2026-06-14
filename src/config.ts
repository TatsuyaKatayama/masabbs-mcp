export type AppConfig = {
  masabbsBaseUrl: string;
  timeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawBaseUrl = env.MASABBS_BASE_URL?.trim();
  if (!rawBaseUrl) {
    throw new Error("MASABBS_BASE_URL is required");
  }

  const timeoutMs = parsePositiveInteger(env.MASABBS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);

  return {
    masabbsBaseUrl: trimTrailingSlash(rawBaseUrl),
    timeoutMs
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("MASABBS_TIMEOUT_MS must be a positive integer");
  }

  return parsed;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
