// 内联的 Memaster REST 客户端：保持单一职责，避免依赖外部 npm 包。
// 实现与 memaster-clients/typescript/index.js 同型，方便后续合并到独立 SDK。

export interface ChatMessage {
  role: string;
  content: string;
}

export interface AddInput {
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
  infer?: boolean;
  memory_type?: string;
  prompt?: string;
}

export interface SearchInput {
  query: string;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  filters?: Record<string, unknown>;
  top_k?: number;
  threshold?: number;
  explain?: boolean;
}

export interface ListInput {
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  title?: string;
  project?: string;
  area?: string;
  service?: string;
  scope?: string;
  memory_type?: string;
  source?: string;
  tags?: string[];
}

export interface UpdateInput {
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  memory?: string;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  score?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface AddResult {
  results?: Array<{
    id?: string;
    memory?: string;
    event?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface ListResult {
  results?: MemoryRecord[];
  [key: string]: unknown;
}

export interface SearchResult {
  results?: MemoryRecord[];
  [key: string]: unknown;
}

export interface MemoryClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export class APIError extends Error {
  statusCode: number;
  response: unknown;

  constructor(statusCode: number, message: string, response: unknown) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.response = response;
  }
}

const DEFAULT_BASE_URL = "https://api.memaster.cn";

export class MemoryClient {
  apiKey: string;
  baseUrl: string;
  private fetchImpl: typeof globalThis.fetch;

  constructor(options: MemoryClientOptions) {
    if (!options?.apiKey) {
      throw new Error("Memaster API key is required");
    }
    this.apiKey = options.apiKey;
    const base = options.baseUrl || process.env.MEMASTER_BASE_URL || DEFAULT_BASE_URL;
    this.baseUrl = base.replace(/\/$/, "");
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new Error("A fetch implementation is required (Node 18+ provides globalThis.fetch)");
    }
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  add(input: AddInput): Promise<AddResult> {
    return this.request("POST", "/memories", {
      body: compact({
        messages: input.messages,
        user_id: input.user_id,
        agent_id: input.agent_id,
        run_id: input.run_id,
        metadata: input.metadata,
        infer: input.infer,
        memory_type: input.memory_type,
        prompt: input.prompt,
      }),
    }) as Promise<AddResult>;
  }

  search(input: SearchInput): Promise<SearchResult> {
    return this.request("POST", "/search", {
      body: compact({
        query: input.query,
        user_id: input.user_id,
        agent_id: input.agent_id,
        run_id: input.run_id,
        filters: input.filters,
        top_k: input.top_k,
        threshold: input.threshold,
        explain: input.explain,
      }),
    }) as Promise<SearchResult>;
  }

  getAll(input: ListInput = {}): Promise<ListResult | MemoryRecord[]> {
    return this.request("GET", "/memories", {
      params: compact({
        user_id: input.user_id,
        agent_id: input.agent_id,
        run_id: input.run_id,
        title: input.title,
        project: input.project,
        area: input.area,
        service: input.service,
        scope: input.scope,
        memory_type: input.memory_type,
        source: input.source,
        tags: input.tags?.join(","),
      }),
    }) as Promise<ListResult | MemoryRecord[]>;
  }

  get(memoryId: string): Promise<MemoryRecord> {
    return this.request("GET", `/memories/${encodeURIComponent(memoryId)}`) as Promise<MemoryRecord>;
  }

  update(memoryId: string, input: UpdateInput): Promise<MemoryRecord> {
    return this.request("PUT", `/memories/${encodeURIComponent(memoryId)}`, {
      body: compact({ text: input.text, metadata: input.metadata }),
    }) as Promise<MemoryRecord>;
  }

  delete(memoryId: string): Promise<unknown> {
    return this.request("DELETE", `/memories/${encodeURIComponent(memoryId)}`);
  }

  private async request(
    method: string,
    path: string,
    options: { params?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<unknown> {
    const query = options.params ? `?${stringifyParams(options.params)}` : "";
    const headers: Record<string, string> = { "X-API-Key": this.apiKey, Accept: "application/json" };
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    const url = `${this.baseUrl}${path}${query}`;
    const response = await this.fetchImpl(url, init);
    const text = await response.text();
    const data = text ? safeJson(text) : {};
    if (!response.ok) {
      const message =
        data && typeof data === "object" && data !== null
          ? (data as { error?: string; message?: string; detail?: string }).error ??
            (data as { error?: string; message?: string; detail?: string }).message ??
            (data as { detail?: string }).detail ??
            response.statusText
          : (typeof data === "string" ? data : response.statusText);
      throw new APIError(response.status, String(message), data);
    }
    return data;
  }
}

export default MemoryClient;

function compact<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined && item !== null) out[key] = item;
  }
  return out;
}

function stringifyParams(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    usp.set(key, String(value));
  }
  return usp.toString();
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
