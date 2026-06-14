import assert from "node:assert/strict";
import test from "node:test";
import { APIError, MemoryClient } from "../index.js";

test("add sends X-API-Key and expected payload", async () => {
  const calls = [];
  const client = new MemoryClient({
    apiKey: "m0sk_test",
    baseUrl: "https://example.test/",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ results: [] });
    },
  });

  await client.add({
    user_id: "user_123",
    messages: [{ role: "user", content: "hello" }],
    metadata: { project: "demo" },
  });

  assert.equal(calls[0].url, "https://example.test/memories");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["X-API-Key"], "m0sk_test");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    user_id: "user_123",
    messages: [{ role: "user", content: "hello" }],
    metadata: { project: "demo" },
  });
});

test("search uses POST /search", async () => {
  const calls = [];
  const client = new MemoryClient({
    apiKey: "m0sk_test",
    baseUrl: "https://example.test",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ results: [{ id: "1", memory: "hello" }] });
    },
  });

  const result = await client.search({ query: "hello", user_id: "user_123", top_k: 5 });

  assert.equal(calls[0].url, "https://example.test/search");
  assert.equal(JSON.parse(calls[0].init.body).top_k, 5);
  assert.equal(result.results[0].memory, "hello");
});

test("throws APIError for non-2xx response", async () => {
  const client = new MemoryClient({
    apiKey: "m0sk_test",
    fetch: async () => jsonResponse({ error: "bad" }, 400),
  });

  await assert.rejects(() => client.get("missing"), APIError);
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Bad Request",
    text: async () => JSON.stringify(body),
  };
}
