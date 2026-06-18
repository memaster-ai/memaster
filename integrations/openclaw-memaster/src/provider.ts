// Provider：把 Memaster REST 调用包装成 OpenClaw 插件需要的最小接口集。

import type {
  AddInput,
  AddResult,
  ListInput,
  MemoryRecord,
  SearchInput,
} from "./memaster-client.js";
import { MemoryClient } from "./memaster-client.js";
import type { MemasterConfig } from "./config.js";

export interface NormalizedMemory {
  id: string;
  memory: string;
  score?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface NormalizedAddResult {
  results: Array<{ id: string; memory: string; event: string }>;
}

export interface SearchOptions {
  query: string;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  top_k?: number;
  threshold?: number;
}

export interface ListOptions {
  user_id?: string;
  agent_id?: string;
  run_id?: string;
}

export interface AddOptions {
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
  infer?: boolean;
}

export class MemasterProvider {
  private client: MemoryClient;

  constructor(cfg: MemasterConfig) {
    this.client = new MemoryClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl });
  }

  async add(messages: Array<{ role: string; content: string }>, opts: AddOptions): Promise<NormalizedAddResult> {
    const payload: AddInput = {
      messages,
      user_id: opts.user_id,
      agent_id: opts.agent_id,
      run_id: opts.run_id,
      metadata: opts.metadata,
      infer: opts.infer ?? false,
    };
    const raw = (await this.client.add(payload)) as AddResult;
    return normalizeAddResult(raw);
  }

  async search(opts: SearchOptions): Promise<NormalizedMemory[]> {
    const payload: SearchInput = {
      query: opts.query,
      user_id: opts.user_id,
      agent_id: opts.agent_id,
      run_id: opts.run_id,
      top_k: opts.top_k,
      threshold: opts.threshold,
    };
    const raw = await this.client.search(payload);
    return normalizeList(raw);
  }

  async list(opts: ListOptions): Promise<NormalizedMemory[]> {
    const payload: ListInput = {
      user_id: opts.user_id,
      agent_id: opts.agent_id,
      run_id: opts.run_id,
    };
    const raw = await this.client.getAll(payload);
    return normalizeList(raw);
  }

  async get(memoryId: string): Promise<NormalizedMemory> {
    const raw = await this.client.get(memoryId);
    return normalizeMemory(raw);
  }

  async update(memoryId: string, text: string, metadata?: Record<string, unknown>): Promise<NormalizedMemory> {
    const raw = await this.client.update(memoryId, { text, metadata });
    return normalizeMemory(raw);
  }

  async delete(memoryId: string): Promise<void> {
    await this.client.delete(memoryId);
  }
}

function normalizeAddResult(raw: AddResult | undefined): NormalizedAddResult {
  const list = Array.isArray(raw) ? raw : raw?.results;
  if (!Array.isArray(list)) return { results: [] };
  return {
    results: list.map((item) => ({
      id: typeof item.id === "string" ? item.id : String(item.id ?? ""),
      memory: typeof item.memory === "string" ? item.memory : "",
      event: typeof item.event === "string" ? item.event : "ADD",
    })),
  };
}

function normalizeMemory(raw: unknown): NormalizedMemory {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : String(r.id ?? ""),
    memory: typeof r.memory === "string" ? (r.memory as string) : "",
    score: typeof r.score === "number" ? (r.score as number) : undefined,
    metadata: isRecord(r.metadata) ? (r.metadata as Record<string, unknown>) : undefined,
    created_at: typeof r.created_at === "string" ? (r.created_at as string) : undefined,
    updated_at: typeof r.updated_at === "string" ? (r.updated_at as string) : undefined,
  };
}

function normalizeList(raw: unknown): NormalizedMemory[] {
  if (Array.isArray(raw)) return raw.map((m) => normalizeMemory(m));
  if (isRecord(raw) && Array.isArray((raw as { results?: unknown }).results)) {
    return ((raw as { results: MemoryRecord[] }).results || []).map((m) => normalizeMemory(m));
  }
  return [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
