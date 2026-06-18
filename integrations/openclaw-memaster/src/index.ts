// Memaster OpenClaw plugin entry：注册工具、auto-recall/capture 钩子和 CLI 子命令。

import { Type } from "@sinclair/typebox";
import type {
  AgentEndEvent,
  BeforeAgentStartEvent,
  CliRegisterContext,
  OpenClawPluginApi,
  PluginEventContext,
  ToolResult,
} from "openclaw/plugin-sdk";

import {
  buildBaseMetadata,
  parseConfig,
  resolveAgentId,
  resolveUserId,
  type MemasterConfig,
} from "./config.js";
import { MemasterProvider, type NormalizedMemory } from "./provider.js";

export { extractAgentFromSessionKey, parseConfig, resolveAgentId, resolveUserId } from "./config.js";
export { MemasterProvider } from "./provider.js";
export type { MemasterConfig } from "./config.js";

const PLUGIN_ID = "openclaw-memaster";
const PLUGIN_LABEL = "Memory (Memaster)";
const PLUGIN_DESCRIPTION =
  "Memaster long-term memory backend — connects OpenClaw agents to memaster.cn for persistent, server-side fact extraction.";

const memorySearchSchema = Type.Object({
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(Type.Number({ description: "Max results (defaults to topK)" })),
  userId: Type.Optional(Type.String({ description: "Override user_id for this call." })),
  agentId: Type.Optional(Type.String({ description: "Override agent_id (defaults to configured agent or session-derived)." })),
  scope: Type.Optional(
    Type.Union(
      [Type.Literal("session"), Type.Literal("long-term"), Type.Literal("all")],
      {
        description: 'Memory scope: "session" (current run only), "long-term" (no run filter), or "all" (default).',
      },
    ),
  ),
});

const memoryStoreSchema = Type.Object({
  text: Type.String({ description: "Memory content to store. Use a stand-alone topic sentence ending with ：, then 1) 2) numbered facts." }),
  userId: Type.Optional(Type.String({ description: "Override user_id." })),
  agentId: Type.Optional(Type.String({ description: "Override agent_id." })),
  longTerm: Type.Optional(Type.Boolean({ description: "Default: true. When false, store the memory under the current session run_id." })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Extra metadata merged with plugin defaults." })),
});

const memoryGetSchema = Type.Object({
  memoryId: Type.String({ description: "Memory id (UUID)." }),
});

const memoryListSchema = Type.Object({
  userId: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  scope: Type.Optional(
    Type.Union(
      [Type.Literal("session"), Type.Literal("long-term"), Type.Literal("all")],
    ),
  ),
});

const memoryForgetSchema = Type.Object({
  memoryId: Type.Optional(Type.String({ description: "Specific memory id to delete." })),
  query: Type.Optional(Type.String({ description: "If provided, deletes the top match when its score > 0.9; otherwise returns candidates." })),
  userId: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
});

type MemorySearchParams = {
  query: string;
  limit?: number;
  userId?: string;
  agentId?: string;
  scope?: "session" | "long-term" | "all";
};

type MemoryStoreParams = {
  text: string;
  userId?: string;
  agentId?: string;
  longTerm?: boolean;
  metadata?: Record<string, unknown>;
};

type MemoryGetParams = { memoryId: string };

type MemoryListParams = {
  userId?: string;
  agentId?: string;
  scope?: "session" | "long-term" | "all";
};

type MemoryForgetParams = {
  memoryId?: string;
  query?: string;
  userId?: string;
  agentId?: string;
};

// configSchemaAdapter 仍然走 parseConfig，OpenClaw 加载插件时会调用它。
const configSchema = {
  parse(value: unknown): MemasterConfig {
    return parseConfig(value);
  },
};

const memoryPlugin = {
  id: PLUGIN_ID,
  name: PLUGIN_LABEL,
  description: PLUGIN_DESCRIPTION,
  kind: "memory" as const,
  configSchema,
  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig);
    const provider = new MemasterProvider(cfg);
    let currentSessionId: string | undefined;

    api.logger.info(
      `openclaw-memaster: registered (baseUrl=${cfg.baseUrl}, agent=${cfg.agentId}, autoRecall=${cfg.autoRecall}, autoCapture=${cfg.autoCapture}, infer=${cfg.infer})`,
    );

    function metaForSearch(): Record<string, unknown> {
      return buildBaseMetadata(cfg);
    }

    function buildAddMetadata(extra?: Record<string, unknown>): Record<string, unknown> {
      return { ...buildBaseMetadata(cfg), ...(extra ?? {}) };
    }

    api.registerTool(
      {
        name: "memory_search",
        label: "Memory Search",
        description:
          "Search Memaster long-term memory. Returns the most relevant memories for the user/agent. Use whenever you need user preferences, facts, or prior decisions.",
        parameters: memorySearchSchema,
        async execute(_id: string, params: MemorySearchParams): Promise<ToolResult> {
          try {
            const scope = params.scope ?? "all";
            const userId = resolveUserId(cfg, { userId: params.userId });
            const agentId = resolveAgentId(cfg, { agentId: params.agentId }, currentSessionId);
            const topK = params.limit && params.limit > 0 ? params.limit : cfg.topK;
            const longTerm =
              scope !== "session"
                ? await provider.search({ query: params.query, user_id: userId, agent_id: agentId, top_k: topK })
                : [];
            const session =
              scope !== "long-term" && currentSessionId
                ? await provider.search({
                    query: params.query,
                    user_id: userId,
                    agent_id: agentId,
                    run_id: currentSessionId,
                    top_k: topK,
                  })
                : [];
            const seen = new Set(longTerm.map((m) => m.id));
            const results = [...longTerm, ...session.filter((m) => !seen.has(m.id))];
            return formatMemoryListResult(results, "memory");
          } catch (err) {
            return failToolResult("memory_search", err);
          }
        },
      },
      { name: "memory_search" },
    );

    api.registerTool(
      {
        name: "memory_store",
        label: "Memory Store",
        description:
          "Persist a memory. Wrap the content as a self-contained note: a topic sentence ending with `：`, then 1) 2) numbered facts. Avoid raw transcripts and secrets.",
        parameters: memoryStoreSchema,
        async execute(_id: string, params: MemoryStoreParams): Promise<ToolResult> {
          try {
            const userId = resolveUserId(cfg, { userId: params.userId });
            const agentId = resolveAgentId(cfg, { agentId: params.agentId }, currentSessionId);
            const longTerm = params.longTerm !== false;
            const runId = !longTerm && currentSessionId ? currentSessionId : undefined;
            const result = await provider.add(
              [{ role: "user", content: params.text }],
              {
                user_id: userId,
                agent_id: agentId,
                run_id: runId,
                metadata: buildAddMetadata(params.metadata),
                infer: false, // 显式 store 不走服务端抽取，避免覆盖用户的整理结果
              },
            );
            const summary = summarizeAddEvents(result.results);
            return {
              content: [
                {
                  type: "text",
                  text: `Stored: ${summary}.`,
                },
              ],
              details: { action: "stored", results: result.results, longTerm },
            };
          } catch (err) {
            return failToolResult("memory_store", err);
          }
        },
      },
      { name: "memory_store" },
    );

    api.registerTool(
      {
        name: "memory_get",
        label: "Memory Get",
        description: "Fetch a single memory by id.",
        parameters: memoryGetSchema,
        async execute(_id: string, params: MemoryGetParams): Promise<ToolResult> {
          try {
            const memory = await provider.get(params.memoryId);
            return {
              content: [
                {
                  type: "text",
                  text: `Memory ${memory.id}:\n${memory.memory}\n\nCreated: ${memory.created_at ?? "unknown"}\nUpdated: ${memory.updated_at ?? "unknown"}`,
                },
              ],
              details: { memory },
            };
          } catch (err) {
            return failToolResult("memory_get", err);
          }
        },
      },
      { name: "memory_get" },
    );

    api.registerTool(
      {
        name: "memory_list",
        label: "Memory List",
        description: "List stored memories for the current user/agent. Use when you want to inspect rather than search.",
        parameters: memoryListSchema,
        async execute(_id: string, params: MemoryListParams): Promise<ToolResult> {
          try {
            const scope = params.scope ?? "all";
            const userId = resolveUserId(cfg, { userId: params.userId });
            const agentId = resolveAgentId(cfg, { agentId: params.agentId }, currentSessionId);
            const longTerm =
              scope !== "session"
                ? await provider.list({ user_id: userId, agent_id: agentId })
                : [];
            const session =
              scope !== "long-term" && currentSessionId
                ? await provider.list({ user_id: userId, agent_id: agentId, run_id: currentSessionId })
                : [];
            const seen = new Set(longTerm.map((m) => m.id));
            const results = [...longTerm, ...session.filter((m) => !seen.has(m.id))];
            return formatMemoryListResult(results, "memory");
          } catch (err) {
            return failToolResult("memory_list", err);
          }
        },
      },
      { name: "memory_list" },
    );

    api.registerTool(
      {
        name: "memory_forget",
        label: "Memory Forget",
        description: "Delete a memory by id, or by query (auto-deletes when one strong match is found).",
        parameters: memoryForgetSchema,
        async execute(_id: string, params: MemoryForgetParams): Promise<ToolResult> {
          try {
            if (params.memoryId) {
              await provider.delete(params.memoryId);
              return {
                content: [{ type: "text", text: `Memory ${params.memoryId} deleted.` }],
                details: { action: "deleted", id: params.memoryId },
              };
            }
            if (!params.query) {
              return {
                content: [{ type: "text", text: "Provide either memoryId or query." }],
                details: { error: "missing_param" },
              };
            }
            const userId = resolveUserId(cfg, { userId: params.userId });
            const agentId = resolveAgentId(cfg, { agentId: params.agentId }, currentSessionId);
            const candidates = await provider.search({
              query: params.query,
              user_id: userId,
              agent_id: agentId,
              top_k: 5,
            });
            if (candidates.length === 0) {
              return {
                content: [{ type: "text", text: "No matching memories found." }],
                details: { found: 0 },
              };
            }
            const best = candidates[0];
            if (candidates.length === 1 || (best.score ?? 0) > 0.9) {
              await provider.delete(best.id);
              return {
                content: [{ type: "text", text: `Forgotten: "${best.memory}"` }],
                details: { action: "deleted", id: best.id },
              };
            }
            const list = candidates
              .map((c) => `- [${c.id}] ${truncate(c.memory, 80)} (score: ${formatScore(c.score)}%)`)
              .join("\n");
            return {
              content: [
                {
                  type: "text",
                  text: `Found ${candidates.length} candidates. Specify memoryId to delete:\n${list}`,
                },
              ],
              details: { action: "candidates", candidates },
            };
          } catch (err) {
            return failToolResult("memory_forget", err);
          }
        },
      },
      { name: "memory_forget" },
    );

    if (cfg.autoRecall) {
      api.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx?: PluginEventContext) => {
        if (!event.prompt || event.prompt.length < 5) return;
        if (ctx?.sessionKey) currentSessionId = ctx.sessionKey;
        try {
          const userId = resolveUserId(cfg, {});
          const agentId = resolveAgentId(cfg, {}, ctx?.sessionKey);
          const longTerm = await provider.search({
            query: event.prompt,
            user_id: userId,
            agent_id: agentId,
            top_k: cfg.topK,
          });
          const session = currentSessionId
            ? await provider.search({
                query: event.prompt,
                user_id: userId,
                agent_id: agentId,
                run_id: currentSessionId,
                top_k: cfg.topK,
              })
            : [];
          const seen = new Set(longTerm.map((m) => m.id));
          const sessionUnique = session.filter((m) => !seen.has(m.id));
          if (longTerm.length === 0 && sessionUnique.length === 0) return;
          const block = formatRecallBlock(longTerm, sessionUnique);
          api.logger.info(
            `openclaw-memaster: recall injected ${longTerm.length + sessionUnique.length} memories (${longTerm.length} long-term, ${sessionUnique.length} session)`,
          );
          return { prependContext: block };
        } catch (err) {
          api.logger.warn(`openclaw-memaster: recall failed: ${stringifyError(err)}`);
        }
      });
    }

    if (cfg.autoCapture) {
      api.on("agent_end", async (event: AgentEndEvent, ctx?: PluginEventContext) => {
        if (!event.success || !Array.isArray(event.messages) || event.messages.length === 0) return;
        if (ctx?.sessionKey) currentSessionId = ctx.sessionKey;
        try {
          const userId = resolveUserId(cfg, {});
          const agentId = resolveAgentId(cfg, {}, ctx?.sessionKey);
          const recent = event.messages.slice(-10);
          const messages = recent
            .map((m) => extractMessage(m))
            .filter((m): m is { role: string; content: string } => !!m && !!m.content);
          if (messages.length === 0) return;
          const result = await provider.add(messages, {
            user_id: userId,
            agent_id: agentId,
            run_id: currentSessionId,
            metadata: buildAddMetadata({ capture: "auto" }),
            infer: cfg.infer,
          });
          if (result.results.length > 0) {
            api.logger.info(`openclaw-memaster: auto-captured ${result.results.length} memories`);
          }
        } catch (err) {
          api.logger.warn(`openclaw-memaster: capture failed: ${stringifyError(err)}`);
        }
      });
    }

    api.registerCli(
      ({ program }: CliRegisterContext) => {
        const root = program.command("memaster").description("Memaster memory plugin commands");

        root
          .command("search")
          .description("Search Memaster memories")
          .argument("<query>", "Search query")
          .option("--limit <n>", "Max results", String(cfg.topK))
          .option("--scope <scope>", 'Memory scope: "session", "long-term", or "all"', "all")
          .option("--user-id <id>", "Override user_id")
          .option("--agent-id <id>", "Override agent_id")
          .action(async (queryArg: unknown, optsArg: unknown) => {
            try {
              const query = String(queryArg ?? "");
              const opts = (optsArg as { limit?: string; scope?: string; userId?: string; agentId?: string }) ?? {};
              const limit = opts.limit ? Number(opts.limit) : cfg.topK;
              const scope = (opts.scope as "session" | "long-term" | "all") || "all";
              const userId = opts.userId || cfg.userId;
              const agentId = opts.agentId || cfg.agentId;
              const longTerm =
                scope !== "session"
                  ? await provider.search({ query, user_id: userId, agent_id: agentId, top_k: limit })
                  : [];
              const session =
                scope !== "long-term" && currentSessionId
                  ? await provider.search({
                      query,
                      user_id: userId,
                      agent_id: agentId,
                      run_id: currentSessionId,
                      top_k: limit,
                    })
                  : [];
              const seen = new Set(longTerm.map((m) => m.id));
              const out = [
                ...longTerm.map((m) => ({ ...m, scope: "long-term" })),
                ...session.filter((m) => !seen.has(m.id)).map((m) => ({ ...m, scope: "session" })),
              ];
              console.log(JSON.stringify(out, null, 2));
            } catch (err) {
              console.error(`memaster search failed: ${stringifyError(err)}`);
              process.exitCode = 1;
            }
          });

        root
          .command("list")
          .description("List Memaster memories for the configured user/agent")
          .option("--user-id <id>", "Override user_id")
          .option("--agent-id <id>", "Override agent_id")
          .action(async (optsArg: unknown) => {
            try {
              const opts = (optsArg as { userId?: string; agentId?: string }) ?? {};
              const memories = await provider.list({
                user_id: opts.userId || cfg.userId,
                agent_id: opts.agentId || cfg.agentId,
              });
              console.log(JSON.stringify(memories, null, 2));
            } catch (err) {
              console.error(`memaster list failed: ${stringifyError(err)}`);
              process.exitCode = 1;
            }
          });

        root
          .command("stats")
          .description("Print plugin status and memory counts")
          .action(async () => {
            try {
              const memories = await provider.list({ user_id: cfg.userId, agent_id: cfg.agentId });
              const status = {
                baseUrl: cfg.baseUrl,
                agentId: cfg.agentId,
                userId: cfg.userId ?? null,
                autoRecall: cfg.autoRecall,
                autoCapture: cfg.autoCapture,
                infer: cfg.infer,
                topK: cfg.topK,
                memoryCount: memories.length,
                metadata: metaForSearch(),
              };
              console.log(JSON.stringify(status, null, 2));
            } catch (err) {
              console.error(`memaster stats failed: ${stringifyError(err)}`);
              process.exitCode = 1;
            }
          });
      },
      { commands: ["memaster"] },
    );

    api.registerService({
      id: PLUGIN_ID,
      start: () => {
        api.logger.info(`openclaw-memaster: started`);
      },
      stop: () => {
        api.logger.info(`openclaw-memaster: stopped`);
      },
    });
  },
};

export default memoryPlugin;

// ----------------- helpers -----------------

function summarizeAddEvents(results: Array<{ event: string }>): string {
  if (!results.length) return "no new memories extracted";
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.event] = (counts[r.event] ?? 0) + 1;
  return Object.entries(counts)
    .map(([event, n]) => `${n} ${event.toLowerCase()}${n === 1 ? "" : "s"}`)
    .join(", ");
}

function formatMemoryListResult(memories: NormalizedMemory[], label: string): ToolResult {
  if (memories.length === 0) {
    return {
      content: [{ type: "text", text: "No memories found." }],
      details: { count: 0 },
    };
  }
  const text = memories
    .map((m, i) => `${i + 1}. ${m.memory} (score: ${formatScore(m.score)}%, id: ${m.id})`)
    .join("\n");
  return {
    content: [{ type: "text", text: `Found ${memories.length} ${label} entries:\n\n${text}` }],
    details: {
      count: memories.length,
      memories: memories.map((m) => ({ id: m.id, memory: m.memory, score: m.score, created_at: m.created_at })),
    },
  };
}

function formatRecallBlock(longTerm: NormalizedMemory[], session: NormalizedMemory[]): string {
  const parts: string[] = [];
  if (longTerm.length > 0) {
    parts.push(longTerm.map((m) => `- ${m.memory}`).join("\n"));
  }
  if (session.length > 0) {
    parts.push("\nSession memories:\n" + session.map((m) => `- ${m.memory}`).join("\n"));
  }
  const body = parts.join("\n");
  return `<relevant-memories>\nThe following memories may be relevant to this conversation:\n${body}\n</relevant-memories>`;
}

function extractMessage(raw: unknown): { role: string; content: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as { role?: unknown; content?: unknown };
  const role = typeof msg.role === "string" ? msg.role : "";
  if (role !== "user" && role !== "assistant") return null;
  let content = "";
  if (typeof msg.content === "string") {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block && typeof block === "object" && "text" in block && typeof (block as { text: unknown }).text === "string") {
        content += (content ? "\n" : "") + (block as { text: string }).text;
      }
    }
  }
  if (!content) return null;
  if (content.includes("<relevant-memories>")) {
    content = content.replace(/<relevant-memories>[\s\S]*?<\/relevant-memories>\s*/g, "").trim();
    if (!content) return null;
  }
  return { role, content };
}

function failToolResult(tool: string, err: unknown): ToolResult {
  return {
    content: [{ type: "text", text: `${tool} failed: ${stringifyError(err)}` }],
    details: { error: stringifyError(err) },
  };
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max) + "...";
}

function formatScore(score: number | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "--";
  return ((score ?? 0) * 100).toFixed(0);
}
