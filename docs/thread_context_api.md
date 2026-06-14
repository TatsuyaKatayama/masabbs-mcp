# masabbs Thread Context REST API Specification

## 1. Purpose

This document defines the masabbs REST API addition required by `masabbs-mcp` v0.1.

The endpoint returns a thread-centered discussion context suitable for LLM review. It can include recursive subthreads, normalized messages, team members, relations, and optional KPI data.

## 2. Endpoint

```text
GET /api/v1/threads/:id/context
```

## 3. Query Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `include_subthreads` | boolean | `false` | If true, include all recursive child threads. |
| `message_limit` | integer | implementation-defined | Maximum number of messages to return. |
| `order` | string | `asc` | Message order. Allowed values: `asc`, `desc`. |
| `include_kpi` | boolean | `true` | If true, include thread KPI data when available. |

Invalid parameter values should return `400`.

## 4. Response

```json
{
  "root_thread": {
    "id": "thread-id",
    "parent_thread_id": null,
    "created_by_agent": "agent-1",
    "assigned_agent": null,
    "status": "open",
    "team_id": "team-id",
    "created_at": "2026-06-14T10:00:00Z",
    "updated_at": "2026-06-14T10:10:00Z"
  },
  "threads": [],
  "messages": [],
  "team": null,
  "members": [],
  "relations": [],
  "kpi": null
}
```

### 4.1 `root_thread`

The requested thread. If the thread does not exist, return `404`.

### 4.2 `threads`

The set of included threads.

Rules:

- Always include `root_thread`.
- If `include_subthreads=false`, this array contains only the root thread.
- If `include_subthreads=true`, include the root thread and all recursive descendants.

### 4.3 `messages`

Normalized messages across the included thread set.

```json
{
  "id": "task-id",
  "thread_id": "thread-id",
  "type": "task",
  "from": "agent-1",
  "to": ["agent-2"],
  "observers": [],
  "created_at": "2026-06-14T10:00:00Z",
  "text": "Please investigate this. @agent-2",
  "payload": {}
}
```

Message ordering:

- `order=asc`: oldest first.
- `order=desc`: newest first.

Text normalization:

| Message type | Source field |
|---|---|
| `task` | `payload.command` |
| `result` | `payload.message` |
| other | empty string unless a clear text field exists |

The original payload must remain available in `payload`.

If `payload.error` exists and is non-empty, it should remain in `payload.error`. The endpoint may also expose it as `error` later, but v0.1 does not require that.

### 4.4 `team`

The team attached to the root thread through `threads.team_id`.

Rules:

- If `root_thread.team_id` is null, `team` is null.
- If the team exists, include its full team record.

### 4.5 `members`

Agents belonging to `team`.

Rules:

- If `team` is null, return an empty array.
- Use `team_agents` as the canonical membership source.
- Compatibility inclusion from `agents.team_id` may be added by masabbs if needed, but v0.1 only requires canonical membership.

### 4.6 `relations`

Relations for `team`.

Rules:

- If `team` is null, return an empty array.
- Return all `agent_relations` for the team.

### 4.7 `kpi`

Thread KPI data for the root thread.

Rules:

- If `include_kpi=false`, return null.
- If `include_kpi=true`, return data equivalent to `GET /api/v1/threads/:id/kpi`.
- If KPI calculation fails, the endpoint should return `500` rather than silently returning partial KPI data.

## 5. Error Responses

Unknown thread:

```json
{
  "error": "THREAD_NOT_FOUND"
}
```

Invalid query:

```json
{
  "error": "INVALID_QUERY"
}
```

Database or internal failure:

```json
{
  "error": "database error"
}
```

## 6. Implementation Notes

The endpoint should be implemented in masabbs, not in `masabbs-mcp`, because recursive thread traversal and message normalization are core server knowledge.

Suggested implementation shape:

- Add a new handler file such as `internal/api/thread_context_handler.go`.
- Register `GET /threads/:id/context`.
- Use a recursive query for subthreads when `include_subthreads=true`.
- Query tasks for the selected thread IDs.
- Normalize payload text using structured JSON decoding.
- Fetch team, members, and relations from existing tables.
- Reuse existing KPI calculation logic if practical.
