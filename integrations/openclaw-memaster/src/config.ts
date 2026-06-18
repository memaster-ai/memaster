// 配置解析：把 OpenClaw 注入的 plugin config 校验为强类型 MemasterConfig，并解析 ${ENV} 引用。

export interface MemasterConfig {
  apiKey: string;
  baseUrl: string;
  userId?: string;
  agentId: string;
  project?: string;
  area?: string;
  scope?: string;
  source: string;
  autoCapture: boolean;
  autoRecall: boolean;
  topK: number;
  infer: boolean;
}

export const ALLOWED_KEYS: ReadonlyArray<string> = [
  "apiKey",
  "baseUrl",
  "userId",
  "agentId",
  "project",
  "area",
  "scope",
  "source",
  "autoCapture",
  "autoRecall",
  "topK",
  "infer",
];

export const DEFAULT_BASE_URL = "https://api.memaster.cn";
export const DEFAULT_AGENT_ID = "openclaw";
export const DEFAULT_SOURCE = "openclaw";
export const DEFAULT_TOP_K = 5;

// resolveEnvVars 解析 ${ENV} 占位符；若未设置则抛错，避免静默拿到错误 key。
export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => {
    const v = process.env[name];
    if (!v) {
      throw new Error(`Environment variable ${name} is not set`);
    }
    return v;
  });
}

function assertAllowedKeys(value: Record<string, unknown>, label: string): void {
  const unknown = Object.keys(value).filter((k) => !ALLOWED_KEYS.includes(k));
  if (unknown.length > 0) {
    throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
  }
}

// parseConfig 接受 OpenClaw 解析过的 plugin config，输出运行时使用的强类型配置。
// apiKey 在 platform 模式必填；缺失时调用方需要走只暴露 CLI 的退化路径。
export function parseConfig(value: unknown): MemasterConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("openclaw-memaster config must be an object");
  }
  const cfg = value as Record<string, unknown>;
  assertAllowedKeys(cfg, "openclaw-memaster config");

  const rawKey = typeof cfg.apiKey === "string" ? cfg.apiKey : "";
  if (!rawKey) {
    throw new Error(
      "openclaw-memaster: apiKey is required. Run `openclaw memaster init --api-key msk_...` or set ${MEMASTER_API_KEY} in openclaw.json.",
    );
  }
  const apiKey = resolveEnvVars(rawKey);

  const rawBaseUrl = typeof cfg.baseUrl === "string" && cfg.baseUrl ? cfg.baseUrl : DEFAULT_BASE_URL;
  const baseUrl = resolveEnvVars(rawBaseUrl).replace(/\/$/, "");

  const userId = typeof cfg.userId === "string" && cfg.userId ? cfg.userId : undefined;
  const agentId = typeof cfg.agentId === "string" && cfg.agentId ? cfg.agentId : DEFAULT_AGENT_ID;
  const project = stringOrUndef(cfg.project);
  const area = stringOrUndef(cfg.area);
  const scope = stringOrUndef(cfg.scope);
  const source = typeof cfg.source === "string" && cfg.source ? cfg.source : DEFAULT_SOURCE;

  const autoCapture = cfg.autoCapture !== false;
  const autoRecall = cfg.autoRecall !== false;
  const topK = typeof cfg.topK === "number" && cfg.topK > 0 ? cfg.topK : DEFAULT_TOP_K;
  const infer = cfg.infer === true;

  return {
    apiKey,
    baseUrl,
    userId,
    agentId,
    project,
    area,
    scope,
    source,
    autoCapture,
    autoRecall,
    topK,
    infer,
  };
}

function stringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

// extractAgentFromSessionKey 解析 OpenClaw 多 agent 场景的 sessionKey 形态 `agent:<id>:<uuid>`，
// 主 agent 走默认 agentId，避免和子 agent 互相串记忆。
export function extractAgentFromSessionKey(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) return undefined;
  const match = sessionKey.match(/^agent:([^:]+):/);
  const id = match?.[1];
  if (!id || id === "main") return undefined;
  return id;
}

// resolveAgentId 按 explicit > session-derived > default 顺序选定要写入的 agent_id。
export function resolveAgentId(
  cfg: MemasterConfig,
  opts: { agentId?: string },
  sessionKey?: string,
): string {
  if (opts.agentId) return opts.agentId;
  const fromSession = extractAgentFromSessionKey(sessionKey);
  return fromSession ?? cfg.agentId;
}

// resolveUserId 决定写入的终端用户标识。
// Memaster 后端的 owner_user_id 已经由 API Key 决定，所以这里 user_id 是 "终端用户" 维度，可缺省。
export function resolveUserId(cfg: MemasterConfig, opts: { userId?: string }): string | undefined {
  if (opts.userId) return opts.userId;
  return cfg.userId;
}

// buildBaseMetadata 把 plugin 配置转成每条记忆都会注入的固定 metadata。
export function buildBaseMetadata(cfg: MemasterConfig): Record<string, string> {
  const meta: Record<string, string> = { source: cfg.source };
  if (cfg.project) meta.project = cfg.project;
  if (cfg.area) meta.area = cfg.area;
  if (cfg.scope) meta.scope = cfg.scope;
  return meta;
}
