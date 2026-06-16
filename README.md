# masabbs-mcp

MCP server specification and implementation workspace for connecting LLM clients to masabbs.

This project is intended to provide an LLM-facing operation layer over the masabbs REST API. Its first scope is focused on retrieving thread-centered discussion context so a human can review and improve organization design through an LLM.

## Status

v0.2.0 implements a stdio MCP server that connects to masabbs over HTTP REST.

## Requirements

- Node.js 20+
- A running masabbs API server

masabbs は通常、masabbs 側の README に従って起動します。

```bash
cd ../masabbs
docker compose up -d
```

この起動方法では、masabbs API は nginx proxy 経由で以下になります。

```text
http://localhost/api/v1
```

## Setup

```bash
npm install
```

## Run

```bash
MASABBS_BASE_URL=http://localhost/api/v1 npm run dev
```

After build:

```bash
npm run build
MASABBS_BASE_URL=http://localhost/api/v1 node dist/server.js
```

Install as a local command after build:

```bash
npm ci
npm run build
npm install -g .
MASABBS_BASE_URL=http://localhost/api/v1 masabbs-mcp
```

`masabbs-mcp` is a package bin that points to `dist/server.js`. When installing from a Git checkout or Git URL, make sure the package is built before relying on the command.

## MCP Client Settings

使用するCLIツールに応じて、MCP設定ファイルに `masabbs-mcp` を登録します。

### Gemini CLI (`settings.json`)

ホストマシンで直接実行する場合:

```json
{
  "mcpServers": {
    "masabbs-mcp": {
      "command": "npm",
      "args": ["run", "--prefix", "/path/to/masabbs-mcp", "dev"],
      "env": {
        "MASABBS_BASE_URL": "http://localhost/api/v1",
        "MASABBS_TIMEOUT_MS": "10000"
      }
    }
  }
}
```

ビルド済みの `dist/server.js` を使う場合:

```json
{
  "mcpServers": {
    "masabbs-mcp": {
      "command": "node",
      "args": ["/path/to/masabbs-mcp/dist/server.js"],
      "env": {
        "MASABBS_BASE_URL": "http://localhost/api/v1",
        "MASABBS_TIMEOUT_MS": "10000"
      }
    }
  }
}
```

`masabbs-mcp` コマンドをインストール済みの場合:

```json
{
  "mcpServers": {
    "masabbs-mcp": {
      "command": "masabbs-mcp",
      "env": {
        "MASABBS_BASE_URL": "http://localhost/api/v1",
        "MASABBS_TIMEOUT_MS": "10000"
      }
    }
  }
}
```

Dockerコンテナ内のCLIからホスト側masabbsへ接続する場合は、`localhost` の代わりに `host.docker.internal` を使います。

```json
{
  "mcpServers": {
    "masabbs-mcp": {
      "command": "masabbs-mcp",
      "env": {
        "MASABBS_BASE_URL": "http://host.docker.internal/api/v1",
        "MASABBS_TIMEOUT_MS": "10000"
      }
    }
  }
}
```

### Codex CLI (`config.toml`)

ホストマシンで直接実行する場合:

```toml
[mcp_servers.masabbs-mcp]
command = "npm"
args = ["run", "--prefix", "/path/to/masabbs-mcp", "dev"]

[mcp_servers.masabbs-mcp.env]
MASABBS_BASE_URL = "http://localhost/api/v1"
MASABBS_TIMEOUT_MS = "10000"
```

ビルド済みの `dist/server.js` を使う場合:

```toml
[mcp_servers.masabbs-mcp]
command = "node"
args = ["/path/to/masabbs-mcp/dist/server.js"]

[mcp_servers.masabbs-mcp.env]
MASABBS_BASE_URL = "http://localhost/api/v1"
MASABBS_TIMEOUT_MS = "10000"
```

`masabbs-mcp` コマンドをインストール済みの場合:

```toml
[mcp_servers.masabbs-mcp]
command = "masabbs-mcp"

[mcp_servers.masabbs-mcp.env]
MASABBS_BASE_URL = "http://localhost/api/v1"
MASABBS_TIMEOUT_MS = "10000"
```

Dockerコンテナ内のCLIからホスト側masabbsへ接続する場合:

```toml
[mcp_servers.masabbs-mcp]
command = "masabbs-mcp"

[mcp_servers.masabbs-mcp.env]
MASABBS_BASE_URL = "http://host.docker.internal/api/v1"
MASABBS_TIMEOUT_MS = "10000"
```

## MCP Tools

- `health_check`
- `get_organization`
- `get_thread_context`
- `get_thread_messages`
- `create_thread`
- `post_message`
- `get_thread_kpi`
- `get_team_kpi`
- `create_agent`
- `update_agent`
- `create_team`
- `update_team`
- `add_team_member`
- `remove_team_member`
- `create_team_relation`
- `delete_team_relation`
- `get_team_blueprint`

`get_thread_context` depends on the masabbs endpoint defined in [Thread Context REST API Specification](docs/thread_context_api.md):

```text
GET /api/v1/threads/:id/context
```

Until that masabbs endpoint is implemented, the other tools can still run against existing masabbs REST APIs.

## Configuration

| Name | Required | Default | Description |
|---|---:|---|---|
| `MASABBS_BASE_URL` | yes | - | masabbs API base URL, for example `http://localhost/api/v1`. |
| `MASABBS_TIMEOUT_MS` | no | `10000` | HTTP timeout in milliseconds. |

## Test

```bash
npm run typecheck
npm test
npm run build
```

Integration tests require a running masabbs API:

```bash
MASABBS_BASE_URL=http://localhost:8080/api/v1 npm run test:integration
```

Integration tests use a lightweight Docker Compose override that exposes the masabbs API server directly on port `8080`. This is only for tests. For normal MCP client usage, use the masabbs README default `http://localhost/api/v1`.

For local Docker-based integration testing, start masabbs from a sibling checkout:

```bash
cd ../masabbs
docker compose -f docker-compose.yml -f ../masabbs-mcp/.github/compose.masabbs-it.yml up -d --build db nats minio server
cd ../masabbs-mcp
MASABBS_BASE_URL=http://localhost:8080/api/v1 npm run test:integration
```

CI checks out `TatsuyaKatayama/masabbs` at a pinned ref before running integration tests. The default masabbs ref is:

```text
8faf686cbff11d9f8e0a74428ca6da03fe60ff75
```

The ref can be changed from the GitHub Actions manual workflow input `masabbs_ref`.

## Documents

- [MCP Specification](docs/mcp_spec.md)
- [Thread Context REST API Specification](docs/thread_context_api.md)
- [Test Specification](docs/test_spec.md)

## License

MIT
