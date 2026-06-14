export interface MemoryMessage {
  role: string;
  content: string;
}

export interface MemoryRecord {
  id: string;
  memory: string;
  user_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  hash?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  score?: number;
}

export interface MemoryListResponse {
  results: MemoryRecord[];
}

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface AddMemoryInput {
  messages: MemoryMessage[];
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
  infer?: boolean;
  memory_type?: string;
  prompt?: string;
}

export interface SearchMemoryInput {
  query: string;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  filters?: Record<string, unknown>;
  top_k?: number;
  threshold?: number;
  explain?: boolean;
}

export interface GetAllMemoriesInput {
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

export interface UpdateMemoryInput {
  text: string;
  metadata?: Record<string, unknown>;
}

export class APIError extends Error {
  statusCode: number;
  response: unknown;
  constructor(statusCode: number, message: string, response?: unknown);
}

export class MemoryClient {
  constructor(options?: ClientOptions);
  add(input: AddMemoryInput): Promise<MemoryListResponse>;
  search(input: SearchMemoryInput): Promise<MemoryListResponse>;
  getAll(input?: GetAllMemoriesInput): Promise<MemoryListResponse>;
  get(memoryId: string): Promise<MemoryRecord>;
  update(memoryId: string, input: UpdateMemoryInput): Promise<MemoryRecord>;
  delete(memoryId: string): Promise<{ message: string }>;
}

export default MemoryClient;
