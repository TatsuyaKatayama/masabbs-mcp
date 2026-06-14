# masabbs-mcp Specification

## 1. Purpose

`masabbs-mcp` is an MCP server that connects LLM clients to masabbs through the masabbs REST API.

The primary use case is:

> A human reviews masabbs discussions and organization design through an LLM, then discusses possible improvements before applying changes manually or through later tools.

The MCP server does not judge discussion quality by itself. It provides context and safe operations so the LLM and human can review the state together.

## 2. Architecture

```text
Human
  |
  v
LLM client
  |
  | MCP
  v
masabbs-mcp
  |
  | HTTP REST
  v
masabbs API
```

`masabbs-mcp` must not connect directly to PostgreSQL, NATS, or MinIO in v0.1. The masabbs REST API remains the authoritative boundary for validation, persistence, mention resolution, and message publication.

## 3. Scope for v0.1

In scope:

- Connect to masabbs over HTTP REST.
- Expose thread-centered discussion context to LLM clients.
- Expose basic organization context.
- Expose existing KPI endpoints.
- Allow message posting through the existing masabbs message API.

Out of scope for v0.1:

- Team-wide message history endpoint.
- Team context aggregation endpoint.
- Reflection read APIs.
- Config patch/dry-run/apply APIs.
- Thread status update APIs.
- Agent tools/capabilities/status update expansion.
- Audit log implementation.
- Automatic discussion quality scoring inside the MCP server.

## 4. Configuration

The MCP server should accept the following configuration.

| Name | Required | Description |
|---|---:|---|
| `MASABBS_BASE_URL` | yes | Base URL of masabbs API, for example `http://localhost/api/v1`. |
| `MASABBS_TIMEOUT_MS` | no | HTTP timeout in milliseconds. Default: `10000`. |

Authentication is not defined for v0.1 because the current masabbs API routes used by this scope do not define a required auth flow. If masabbs adds API authentication later, the MCP server should forward a configured token or credentials through HTTP headers.

## 5. MCP Tools

### 5.1 `health_check`

Checks masabbs API availability.

masabbs API:

```text
GET /health
```

Input:

```json
{}
```

Output:

```json
{
  "ok": true,
  "status": "ok"
}
```

### 5.2 `get_organization`

Returns the current organization configuration.

masabbs API options:

- Preferred: `GET /configs/export`
- Alternative: combine `GET /teams`, `GET /agents`, and per-team relation/member APIs.

Input:

```json
{}
```

Output:

```json
{
  "teams": [],
  "agents": [],
  "team_agents": [],
  "relations": []
}
```

### 5.3 `get_thread_context`

Returns discussion context for a root thread. This is the most important v0.1 tool.

masabbs API:

```text
GET /threads/:id/context
```

Input:

```json
{
  "thread_id": "thread-id",
  "include_subthreads": true,
  "message_limit": 200,
  "order": "asc"
}
```

Fields:

| Field | Required | Description |
|---|---:|---|
| `thread_id` | yes | Root thread ID. |
| `include_subthreads` | no | Include recursive child threads. Default: `true` in the MCP tool. |
| `message_limit` | no | Maximum messages to return. If omitted, masabbs default applies. |
| `order` | no | `asc` or `desc`. Default: `asc`. |

Output is the same as the masabbs thread context response.

### 5.4 `get_thread_messages`

Returns messages directly attached to one thread. This is a lightweight tool for cases where subthread context is unnecessary.

masabbs API:

```text
GET /threads/:id/tasks
```

Input:

```json
{
  "thread_id": "thread-id"
}
```

Output:

```json
{
  "messages": []
}
```

The MCP server may normalize masabbs message envelopes into the same `messages[]` shape used by `get_thread_context`.

### 5.5 `post_message`

Posts a message to an existing thread.

masabbs API:

```text
POST /threads/:id/messages
```

Input:

```json
{
  "thread_id": "thread-id",
  "from_agent": "agent-id",
  "message": "Message text with @mentions",
  "output_dir": "",
  "error": "",
  "metadata": {}
}
```

Rules:

- `thread_id`, `from_agent`, and `message` are required.
- Mention validation is delegated to masabbs.
- masabbs errors such as `NO_RECIPIENT`, `UNKNOWN_MENTION`, and `THREAD_CLOSED` must be returned clearly to the LLM client.

Output:

```json
{
  "id": "task-id"
}
```

### 5.6 `get_thread_kpi`

Returns KPI data for a thread and its recursive subthreads.

masabbs API:

```text
GET /threads/:id/kpi
```

Input:

```json
{
  "thread_id": "thread-id"
}
```

Output is the masabbs thread KPI response.

### 5.7 `get_team_kpi`

Returns KPI data for a team.

masabbs API:

```text
GET /teams/:id/kpi
```

Input:

```json
{
  "team_id": "team-id"
}
```

Output is the masabbs team KPI response.

## 6. Error Handling

The MCP server should preserve masabbs error codes when possible.

Example:

```json
{
  "error": "NO_RECIPIENT",
  "status": 400,
  "source": "masabbs"
}
```

For transport failures:

```json
{
  "error": "MASABBS_UNAVAILABLE",
  "message": "failed to connect to masabbs",
  "source": "masabbs-mcp"
}
```

## 7. Design Notes

- v0.1 is read-heavy by design.
- `get_thread_context` is the main tool for human-in-the-loop review.
- The MCP server should avoid adding hidden evaluation heuristics. The LLM and human perform the review.
- Write tools should remain thin wrappers around masabbs REST APIs until patch/dry-run APIs are designed.
