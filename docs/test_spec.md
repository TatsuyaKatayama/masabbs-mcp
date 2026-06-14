# masabbs-mcp Test Specification

## 1. Scope

This document defines tests for:

- The new masabbs REST API: `GET /api/v1/threads/:id/context`
- The future `masabbs-mcp` MCP server tools

## 2. masabbs REST API Tests

These tests should be added to the masabbs repository when implementing the thread context API.

Suggested file:

```text
internal/api/thread_context_handler_test.go
```

### 2.1 Root Thread Context

Case:

```text
GET /api/v1/threads/:id/context
```

Expected:

- Returns `200`.
- `root_thread.id` matches the requested ID.
- `threads` contains only the root thread by default.
- `messages` contains messages attached to the root thread.

### 2.2 Include Subthreads

Case:

```text
GET /api/v1/threads/:id/context?include_subthreads=true
```

Expected:

- Returns `200`.
- `threads` contains root and recursive child threads.
- `messages` contains messages from root and child threads.

### 2.3 Exclude Subthreads

Case:

```text
GET /api/v1/threads/:id/context?include_subthreads=false
```

Expected:

- Returns `200`.
- Child threads are not included.
- Child thread messages are not included.

### 2.4 Team Members and Relations

Setup:

- Create a team.
- Add multiple agents through `team_agents`.
- Add at least one relation.
- Attach the root thread to the team.

Expected:

- `team.id` matches the thread team.
- `members` contains team members.
- `relations` contains team relations.

### 2.5 Unknown Thread

Case:

```text
GET /api/v1/threads/unknown/context
```

Expected:

- Returns `404`.
- Response contains `THREAD_NOT_FOUND`.

### 2.6 Message Ordering

Setup:

- Insert at least two messages with distinct `created_at` values.

Expected:

- `order=asc` returns oldest first.
- `order=desc` returns newest first.

### 2.7 Text Normalization

Setup:

- Insert a `task` message with `payload.command`.
- Insert a `result` message with `payload.message`.

Expected:

- `task` message `text` equals `payload.command`.
- `result` message `text` equals `payload.message`.
- Original payload remains available.

### 2.8 Invalid Query

Cases:

- `order=invalid`
- `message_limit=-1`

Expected:

- Returns `400`.
- Response contains `INVALID_QUERY`.

## 3. masabbs-mcp Unit Tests

These tests should be added when the MCP implementation is created.

### 3.1 `health_check`

Expected:

- Calls `GET /health`.
- Returns `{ "ok": true }` for HTTP 200.
- Maps connection failure to `MASABBS_UNAVAILABLE`.

### 3.2 `get_thread_context`

Expected:

- Requires `thread_id`.
- Sends `include_subthreads`, `message_limit`, and `order` as query parameters.
- Returns masabbs response without dropping `messages[].text`.
- Preserves `THREAD_NOT_FOUND` as an MCP-visible error.

### 3.3 `get_thread_messages`

Expected:

- Calls `GET /threads/:id/tasks`.
- Normalizes messages into the common message shape if the implementation chooses to normalize.

### 3.4 `post_message`

Expected:

- Requires `thread_id`, `from_agent`, and `message`.
- Calls `POST /threads/:id/messages`.
- Preserves masabbs validation errors such as `NO_RECIPIENT`, `UNKNOWN_MENTION`, and `THREAD_CLOSED`.

### 3.5 `get_organization`

Expected:

- Calls `GET /configs/export` by default.
- Returns `teams`, `agents`, `team_agents`, and `relations`.

## 4. masabbs-mcp Contract Tests

Use an HTTP mock server to verify that each MCP tool sends the expected masabbs request.

Minimum cases:

- Correct base URL joining.
- Correct URL encoding for thread IDs and team IDs.
- Correct JSON body for `post_message`.
- Correct error mapping for HTTP 400, 404, 409, and 500.

## 5. Integration Tests

Integration tests can run after both masabbs and masabbs-mcp exist.

Suggested flow:

1. Start masabbs with Docker Compose.
2. Seed a team, agents, relations, a root thread, a child thread, and messages.
3. Start masabbs-mcp with `MASABBS_BASE_URL`.
4. Invoke `get_thread_context` through MCP.
5. Assert that root and child messages are visible when `include_subthreads=true`.
6. Invoke `post_message` with a valid mention.
7. Assert that the posted message appears in subsequent context retrieval.
