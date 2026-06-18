# @memaster-ai/openclaw-memaster

Long-term memory for [OpenClaw](https://github.com/openclaw/openclaw) agents, powered by [Memaster](https://memaster.cn).

The plugin connects OpenClaw's `memory` slot to the Memaster cloud API. Conversations are stored across sessions, recalled on the next turn, and surfaced to your agent without bespoke glue code.

## Quick start

```bash
# 1. Install the plugin in your OpenClaw harness.
openclaw plugins install @memaster-ai/openclaw-memaster

# 2. Configure it with your Memaster API key.
openclaw memaster init --api-key msk_xxxxxxxxxxxx
```

If the OpenClaw CLI is not installed yet, you can run the same `init` directly from npm:

```bash
npx @memaster-ai/openclaw-memaster init --api-key msk_xxxxxxxxxxxx
```

`init` is idempotent. It updates your `openclaw.json` (or `~/.openclaw/openclaw.json` if no project file exists) by:

1. Adding `@memaster-ai/openclaw-memaster` and `openclaw-memaster` to `plugins.allow`.
2. Wiring `plugins.slots.memory` to `openclaw-memaster`.
3. Writing the API key, base URL and agent metadata to `plugins.entries.openclaw-memaster.config`.

Use `--print` to preview the resulting config without writing the file:

```bash
openclaw-memaster init --api-key msk_xxxxxxxxxxxx --user-id alice --print
```

The API key is masked in the printed output (e.g. `msk_***1234`).

## What you get

### Tools

| Tool | Description |
| --- | --- |
| `memory_search` | Semantic search across stored memories. Supports `scope: session|long-term|all`. |
| `memory_store` | Persist a fact. The plugin enforces a structured topic-sentence + numbered-list format. |
| `memory_get` | Fetch a memory by id. |
| `memory_list` | List memories scoped to the current user/agent. |
| `memory_forget` | Delete by id, or by query (auto-deletes the top match when score > 0.9). |

### Auto-recall and auto-capture

- `autoRecall` (default `true`) — before each agent turn, the plugin runs a search against Memaster and injects the top results into the system context as `<relevant-memories>...</relevant-memories>`.
- `autoCapture` (default `true`) — after a successful turn, recent user/assistant messages are sent to Memaster's `POST /memories` endpoint. Set `infer: true` in the config to ask Memaster to extract durable facts server-side; the default keeps capture verbatim.

### CLI subcommands

Once installed inside OpenClaw, the plugin registers `openclaw memaster ...`:

```bash
openclaw memaster search "用户偏好的语言"
openclaw memaster search "preferences" --scope long-term
openclaw memaster list --user-id alice
openclaw memaster stats
```

All subcommands return JSON, suitable for piping into other agents.

## Configuration

The plugin entry in `openclaw.json` looks like this:

```json5
{
  "plugins": {
    "allow": ["@memaster-ai/openclaw-memaster", "openclaw-memaster"],
    "slots": { "memory": "openclaw-memaster" },
    "entries": {
      "openclaw-memaster": {
        "enabled": true,
        "config": {
          "apiKey": "${MEMASTER_API_KEY}",
          "baseUrl": "https://api.memaster.cn",
          "userId": "alice",
          "agentId": "openclaw",
          "project": "my-project",
          "area": "agent",
          "scope": "openclaw-session",
          "autoRecall": true,
          "autoCapture": true,
          "infer": false,
          "topK": 5
        }
      }
    }
  }
}
```

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | — | **Required.** Memaster API key, e.g. `msk_...`. Supports `${ENV}` interpolation. |
| `baseUrl` | `string` | `https://api.memaster.cn` | Override for self-hosted Memaster deployments. |
| `userId` | `string` | — | Stable end-user id. Memaster scopes memory listings by this value. |
| `agentId` | `string` | `openclaw` | Default agent id. Per-agent sessions (`agent:<id>:<uuid>`) override automatically. |
| `project` / `area` / `scope` | `string` | — | Optional metadata copied onto every memory written by the plugin. |
| `source` | `string` | `openclaw` | Memory metadata `source` field. |
| `autoRecall` | `boolean` | `true` | Inject relevant memories into the agent's context before each turn. |
| `autoCapture` | `boolean` | `true` | Persist conversation turns to Memaster after each successful agent turn. |
| `infer` | `boolean` | `false` | When `true`, auto-capture asks the server to run extraction. Requires the Growth plan. |
| `topK` | `number` | `5` | Maximum memories returned per recall/search call. |

## How memory is written

When the agent calls `memory_store`, or when auto-capture submits a turn, the plugin sends:

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "user_id": "alice",
  "agent_id": "openclaw",
  "metadata": { "source": "openclaw", "project": "my-project" },
  "infer": false
}
```

The Memaster server enforces ownership using your API key and stores memories under `owner_user_id:user_id:agent_id`.

The tool description nudges the agent to write content as a topic sentence plus numbered list. This matches the Memaster style guide and keeps recall results readable.

## Privacy

- The plugin only contacts the configured `baseUrl`. Default is `https://api.memaster.cn`.
- API keys live in `openclaw.json`. Use `${MEMASTER_API_KEY}` to keep them out of source control.
- Auto-capture redacts `<relevant-memories>` blocks from outgoing messages so injected context is not stored as a new memory.

## Troubleshooting

- **`apiKey is required`** — run `openclaw-memaster init --api-key msk_xxx` or set `MEMASTER_API_KEY` in your shell.
- **`plugins.allow excludes openclaw-memaster`** — the `init` command writes both the package name and plugin id into `plugins.allow`. If you edit the file by hand, keep both entries.
- **Auto-capture fails with 403** — make sure your account has write quota and that `infer: true` is only enabled on the Growth plan.

## License

Apache 2.0
