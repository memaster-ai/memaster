#!/usr/bin/env node
// init-cli.ts: 提供 `npx @memaster-ai/openclaw-memaster init --api-key msk_...` 的命令体验。
// 它会修改用户的 openclaw.json，把 memaster 插件接入 memory slot；幂等，不会覆盖已有未 memaster 配置。

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ID = "openclaw-memaster";
const PACKAGE_NAME = "@memaster-ai/openclaw-memaster";
const DEFAULT_BASE_URL = "https://api.memaster.cn";
const DEFAULT_AGENT_ID = "openclaw";

interface InitOptions {
  apiKey?: string;
  baseUrl?: string;
  userId?: string;
  agentId?: string;
  configPath?: string;
  print?: boolean;
}

interface OpenClawConfig {
  plugins?: {
    allow?: string[];
    slots?: Record<string, string>;
    entries?: Record<string, PluginEntry>;
  } & Record<string, unknown>;
  [key: string]: unknown;
}

interface PluginEntry {
  enabled?: boolean;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

function printHelp(): void {
  const lines = [
    `Usage: openclaw-memaster init [options]`,
    ``,
    `Configure the Memaster memory plugin in your openclaw.json.`,
    ``,
    `Options:`,
    `  --api-key <key>      Memaster API key (msk_...). Defaults to $MEMASTER_API_KEY.`,
    `  --base-url <url>     Memaster API endpoint. Defaults to ${DEFAULT_BASE_URL}.`,
    `  --user-id <id>       Stable end-user identifier (optional).`,
    `  --agent-id <id>      Agent id metadata. Defaults to ${DEFAULT_AGENT_ID}.`,
    `  --config <path>      Path to openclaw.json. Defaults to ./openclaw.json or ~/.openclaw/openclaw.json.`,
    `  --print              Print the resulting config to stdout instead of writing the file.`,
    `  -h, --help           Show this help.`,
    ``,
    `Examples:`,
    `  npx @memaster-ai/openclaw-memaster init --api-key msk_xxx`,
    `  openclaw memaster init --api-key msk_xxx --user-id alice --agent-id research`,
  ];
  console.log(lines.join("\n"));
}

function parseArgs(argv: string[]): { command: string; opts: InitOptions; help: boolean } {
  const opts: InitOptions = {};
  let help = false;
  const args = argv.slice(2);
  let command = "init";
  if (args.length > 0 && !args[0].startsWith("-")) {
    command = String(args.shift());
  }
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "-h" || token === "--help") {
      help = true;
      continue;
    }
    const next = args[i + 1];
    switch (token) {
      case "--api-key":
        opts.apiKey = next;
        i++;
        break;
      case "--base-url":
        opts.baseUrl = next;
        i++;
        break;
      case "--user-id":
        opts.userId = next;
        i++;
        break;
      case "--agent-id":
        opts.agentId = next;
        i++;
        break;
      case "--config":
        opts.configPath = next;
        i++;
        break;
      case "--print":
        opts.print = true;
        break;
      default:
        if (token.startsWith("--")) {
          console.error(`Unknown option: ${token}`);
          help = true;
        }
        break;
    }
  }
  return { command, opts, help };
}

function resolveConfigPath(custom?: string): string {
  if (custom) return resolve(custom);
  const projectPath = resolve("openclaw.json");
  if (existsSync(projectPath)) return projectPath;
  return join(homedir(), ".openclaw", "openclaw.json");
}

function readJSON(path: string): OpenClawConfig {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OpenClawConfig;
    }
    throw new Error(`expected an object at ${path}`);
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`);
  }
}

function writeJSON(path: string, value: OpenClawConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function mergeConfig(existing: OpenClawConfig, opts: InitOptions): OpenClawConfig {
  const next: OpenClawConfig = JSON.parse(JSON.stringify(existing));
  next.plugins = next.plugins || {};
  const plugins = next.plugins;
  plugins.allow = ensureUnique([...(plugins.allow ?? []), PACKAGE_NAME, PLUGIN_ID]);
  plugins.slots = { ...(plugins.slots ?? {}), memory: PLUGIN_ID };
  const entries = (plugins.entries = plugins.entries || {});
  const previous = entries[PLUGIN_ID] ?? {};
  const previousConfig = (previous.config as Record<string, unknown> | undefined) ?? {};
  const apiKey = opts.apiKey ?? process.env.MEMASTER_API_KEY ?? (typeof previousConfig.apiKey === "string" ? (previousConfig.apiKey as string) : undefined);
  if (!apiKey) {
    throw new Error(
      "Missing API key. Pass --api-key msk_xxx or set MEMASTER_API_KEY in the environment.",
    );
  }
  const merged: Record<string, unknown> = {
    ...previousConfig,
    apiKey,
    baseUrl: opts.baseUrl ?? previousConfig.baseUrl ?? DEFAULT_BASE_URL,
    agentId: opts.agentId ?? previousConfig.agentId ?? DEFAULT_AGENT_ID,
  };
  if (opts.userId !== undefined) merged.userId = opts.userId;
  entries[PLUGIN_ID] = {
    ...previous,
    enabled: previous.enabled ?? true,
    config: merged,
  };
  return next;
}

function ensureUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function redact(config: OpenClawConfig): OpenClawConfig {
  const clone: OpenClawConfig = JSON.parse(JSON.stringify(config));
  const entry = clone.plugins?.entries?.[PLUGIN_ID];
  if (entry?.config && typeof entry.config === "object") {
    const cfg = entry.config as Record<string, unknown>;
    if (typeof cfg.apiKey === "string" && (cfg.apiKey as string).length > 0) {
      const raw = cfg.apiKey as string;
      const tail = raw.slice(-4);
      // 保留实际前缀（msk_ 或历史 m0sk_），方便用户识别 key 类型。
      const sep = raw.indexOf("_");
      const prefix = sep > 0 && sep < 8 ? raw.slice(0, sep + 1) : "msk_";
      cfg.apiKey = `${prefix}***${tail}`;
    }
  }
  return clone;
}

function main(argv: string[]): void {
  const { command, opts, help } = parseArgs(argv);
  if (help) {
    printHelp();
    return;
  }
  if (command !== "init") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }
  const configPath = resolveConfigPath(opts.configPath);
  const existing = readJSON(configPath);
  const merged = mergeConfig(existing, opts);
  if (opts.print) {
    console.log(JSON.stringify(redact(merged), null, 2));
    return;
  }
  writeJSON(configPath, merged);
  console.log(`✓ Memaster plugin configured at ${configPath}`);
  console.log("  plugin id    :", PLUGIN_ID);
  console.log("  package      :", PACKAGE_NAME);
  console.log("  agentId      :", merged.plugins?.entries?.[PLUGIN_ID]?.config?.["agentId"] ?? DEFAULT_AGENT_ID);
  console.log("  baseUrl      :", merged.plugins?.entries?.[PLUGIN_ID]?.config?.["baseUrl"] ?? DEFAULT_BASE_URL);
  console.log("");
  console.log("Next: run `openclaw plugins install @memaster-ai/openclaw-memaster` if you have not yet, then start your agent.");
}

export { main, mergeConfig, parseArgs, redact, resolveConfigPath };
export type { InitOptions, OpenClawConfig };

// 仅当作为 bin/CLI 直接执行时才跑 main，避免被 vitest 之类的工具 import 时产生副作用。
function isDirectExecution(): boolean {
  try {
    if (!process.argv[1]) return false;
    // 通过 realpath 解析 symlink，npm/pnpm 的 .bin/<name> 是指向真实文件的符号链接，
    // 直接比较字符串会失败，导致 CLI 静默退出。
    const entry = realpathSync(fileURLToPath(import.meta.url));
    const invoked = realpathSync(resolve(process.argv[1]));
    return entry === invoked;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  try {
    main(process.argv);
  } catch (err) {
    console.error(`memaster init failed: ${(err as Error).message ?? err}`);
    process.exitCode = 1;
  }
}
