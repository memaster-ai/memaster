const DEFAULT_BASE_URL = "https://api.memaster.cn";

export class APIError extends Error {
  constructor(statusCode, message, response) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class MemoryClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.MEMASTER_API_KEY;
    if (!this.apiKey) {
      throw new Error("Memaster API key not provided. Set MEMASTER_API_KEY or pass apiKey.");
    }
    this.baseUrl = (options.baseUrl || process.env.MEMASTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetch || globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("A fetch implementation is required.");
    }
  }

  async add(input) {
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
    });
  }

  async search(input) {
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
    });
  }

  async getAll(input = {}) {
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
    });
  }

  async get(memoryId) {
    return this.request("GET", `/memories/${encodeURIComponent(memoryId)}`);
  }

  async update(memoryId, input) {
    return this.request("PUT", `/memories/${encodeURIComponent(memoryId)}`, {
      body: compact({ text: input.text, metadata: input.metadata }),
    });
  }

  async delete(memoryId) {
    return this.request("DELETE", `/memories/${encodeURIComponent(memoryId)}`);
  }

  async request(method, path, options = {}) {
    const query = options.params ? `?${new URLSearchParams(options.params).toString()}` : "";
    const headers = { "X-API-Key": this.apiKey, Accept: "application/json" };
    const init = { method, headers };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}${query}`, init);
    const text = await response.text();
    const data = text ? safeJson(text) : {};
    if (!response.ok) {
      const message = typeof data === "object" && data !== null
        ? data.error || data.message || data.detail || response.statusText
        : text || response.statusText;
      throw new APIError(response.status, String(message), data);
    }
    return data;
  }
}

export default MemoryClient;

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
