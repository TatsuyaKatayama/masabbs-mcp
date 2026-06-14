export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type MasabbsClientOptions = {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: FetchLike;
};

export type ToolMessage = {
  id?: string;
  thread_id?: string;
  type?: string;
  from?: string;
  to?: string[];
  observers?: string[];
  timestamp?: number;
  created_at?: string;
  text: string;
  payload?: unknown;
};

export class MasabbsError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly source: "masabbs" | "masabbs-mcp";
  readonly details?: unknown;

  constructor(params: {
    code: string;
    message?: string;
    status?: number;
    source: "masabbs" | "masabbs-mcp";
    details?: unknown;
  }) {
    super(params.message ?? params.code);
    this.name = "MasabbsError";
    this.code = params.code;
    this.status = params.status;
    this.source = params.source;
    this.details = params.details;
  }
}

export class MasabbsClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: MasabbsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async healthCheck(): Promise<unknown> {
    return this.request("GET", "/health");
  }

  async getOrganization(): Promise<unknown> {
    return this.request("GET", "/configs/export");
  }

  async getThreadContext(input: {
    threadId: string;
    includeSubthreads?: boolean;
    messageLimit?: number;
    order?: "asc" | "desc";
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (input.includeSubthreads !== undefined) {
      query.set("include_subthreads", String(input.includeSubthreads));
    }
    if (input.messageLimit !== undefined) {
      query.set("message_limit", String(input.messageLimit));
    }
    if (input.order !== undefined) {
      query.set("order", input.order);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return this.request("GET", `/threads/${encodeURIComponent(input.threadId)}/context${suffix}`);
  }

  async getThreadMessages(threadId: string): Promise<{ messages: ToolMessage[] }> {
    const messages = await this.request<unknown[]>("GET", `/threads/${encodeURIComponent(threadId)}/tasks`);
    return {
      messages: messages.map(normalizeMessage)
    };
  }

  async postMessage(input: {
    threadId: string;
    fromAgent: string;
    message: string;
    outputDir?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request("POST", `/threads/${encodeURIComponent(input.threadId)}/messages`, {
      from_agent: input.fromAgent,
      message: input.message,
      output_dir: input.outputDir,
      error: input.error,
      metadata: input.metadata
    });
  }

  async getThreadKpi(threadId: string): Promise<unknown> {
    return this.request("GET", `/threads/${encodeURIComponent(threadId)}/kpi`);
  }

  async getTeamKpi(teamId: string): Promise<unknown> {
    return this.request("GET", `/teams/${encodeURIComponent(teamId)}/kpi`);
  }

  async createTeam(input: { name: string; description?: string; mission?: string }): Promise<unknown> {
    return this.request("POST", "/teams", {
      name: input.name,
      description: input.description,
      mission: input.mission
    });
  }

  async updateTeam(input: {
    teamId: string;
    name?: string;
    description?: string;
    mission?: string;
  }): Promise<unknown> {
    return this.request("PATCH", `/teams/${encodeURIComponent(input.teamId)}`, {
      name: input.name,
      description: input.description,
      mission: input.mission
    });
  }

  async addTeamMember(input: { teamId: string; agentId: string }): Promise<unknown> {
    return this.request("POST", `/teams/${encodeURIComponent(input.teamId)}/agents/${encodeURIComponent(input.agentId)}`);
  }

  async removeTeamMember(input: { teamId: string; agentId: string }): Promise<unknown> {
    return this.request("DELETE", `/teams/${encodeURIComponent(input.teamId)}/agents/${encodeURIComponent(input.agentId)}`);
  }

  async createTeamRelation(input: {
    teamId: string;
    sourceId: string;
    targetId: string;
    relationType: "boss" | "coworker";
    sourceHandle?: string;
    targetHandle?: string;
  }): Promise<unknown> {
    return this.request("POST", "/relations", {
      team_id: input.teamId,
      source_id: input.sourceId,
      target_id: input.targetId,
      relation_type: input.relationType,
      source_handle: input.sourceHandle,
      target_handle: input.targetHandle
    });
  }

  async deleteTeamRelation(relationId: string): Promise<unknown> {
    return this.request("DELETE", `/relations/${encodeURIComponent(relationId)}`);
  }

  async getTeamBlueprint(teamId: string): Promise<unknown> {
    return this.request("GET", `/teams/${encodeURIComponent(teamId)}/blueprint`);
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(removeUndefined(body)),
        signal: controller.signal
      });

      const payload = await readJson(response);
      if (!response.ok) {
        throw new MasabbsError({
          code: extractErrorCode(payload) ?? `HTTP_${response.status}`,
          message: extractErrorMessage(payload) ?? response.statusText,
          status: response.status,
          source: "masabbs",
          details: payload
        });
      }

      return payload as T;
    } catch (error) {
      if (error instanceof MasabbsError) {
        throw error;
      }
      throw new MasabbsError({
        code: "MASABBS_UNAVAILABLE",
        message: error instanceof Error ? error.message : "failed to connect to masabbs",
        source: "masabbs-mcp"
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function normalizeMessage(raw: unknown): ToolMessage {
  const record = asRecord(raw);
  const payload = parsePayload(record.payload);
  const payloadRecord = asRecord(payload);
  const threadId = typeof record.thread_id === "string" ? record.thread_id : undefined;

  return {
    id: typeof record.id === "string" ? record.id : undefined,
    thread_id: threadId,
    type: typeof record.type === "string" ? record.type : undefined,
    from: typeof record.from === "string" ? record.from : undefined,
    to: stringArray(record.to),
    observers: stringArray(record.observers),
    timestamp: typeof record.timestamp === "number" ? record.timestamp : undefined,
    created_at: typeof record.created_at === "string" ? record.created_at : undefined,
    text: extractText(typeof record.type === "string" ? record.type : "", payloadRecord),
    payload
  };
}

function extractText(type: string, payload: Record<string, unknown>): string {
  if (type === "task" && typeof payload.command === "string") {
    return payload.command;
  }
  if (type === "result" && typeof payload.message === "string") {
    return payload.message;
  }
  if (typeof payload.message === "string") {
    return payload.message;
  }
  if (typeof payload.command === "string") {
    return payload.command;
  }
  return "";
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function parsePayload(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value.filter((item): item is string => typeof item === "string");
  return values.length > 0 ? values : [];
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, removeUndefined(entry)])
    );
  }
  return value;
}

function extractErrorCode(payload: unknown): string | undefined {
  const record = asRecord(payload);
  return typeof record.error === "string" ? record.error : undefined;
}

function extractErrorMessage(payload: unknown): string | undefined {
  const record = asRecord(payload);
  if (typeof record.message === "string") {
    return record.message;
  }
  if (typeof record.error === "string") {
    return record.error;
  }
  return undefined;
}
