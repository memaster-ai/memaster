import { describe, expect, it } from "vitest";

import {
  buildBaseMetadata,
  extractAgentFromSessionKey,
  parseConfig,
  resolveAgentId,
  resolveUserId,
} from "../src/config";

describe("parseConfig", () => {
  it("requires apiKey", () => {
    expect(() => parseConfig({})).toThrowError(/apiKey is required/);
  });

  it("applies defaults", () => {
    const cfg = parseConfig({ apiKey: "msk_test" });
    expect(cfg.apiKey).toBe("msk_test");
    expect(cfg.baseUrl).toBe("https://api.memaster.cn");
    expect(cfg.agentId).toBe("openclaw");
    expect(cfg.source).toBe("openclaw");
    expect(cfg.autoCapture).toBe(true);
    expect(cfg.autoRecall).toBe(true);
    expect(cfg.topK).toBe(5);
    expect(cfg.infer).toBe(false);
  });

  it("resolves env placeholders", () => {
    process.env.__MEMASTER_TEST_KEY = "msk_env";
    try {
      const cfg = parseConfig({ apiKey: "${__MEMASTER_TEST_KEY}" });
      expect(cfg.apiKey).toBe("msk_env");
    } finally {
      delete process.env.__MEMASTER_TEST_KEY;
    }
  });

  it("throws on unknown keys", () => {
    expect(() => parseConfig({ apiKey: "msk_test", weird: 1 })).toThrowError(/unknown keys: weird/);
  });

  it("strips trailing slash from baseUrl", () => {
    const cfg = parseConfig({ apiKey: "msk_test", baseUrl: "https://api.memaster.cn/" });
    expect(cfg.baseUrl).toBe("https://api.memaster.cn");
  });
});

describe("agent/user resolution", () => {
  const cfg = parseConfig({ apiKey: "msk_test", agentId: "default-agent", userId: "alice" });

  it("prefers explicit agentId", () => {
    expect(resolveAgentId(cfg, { agentId: "explicit" }, undefined)).toBe("explicit");
  });

  it("falls back to session-derived agentId", () => {
    expect(resolveAgentId(cfg, {}, "agent:research:abc")).toBe("research");
  });

  it("ignores main session sentinel", () => {
    expect(extractAgentFromSessionKey("agent:main:abc")).toBeUndefined();
  });

  it("falls back to default agent", () => {
    expect(resolveAgentId(cfg, {}, undefined)).toBe("default-agent");
  });

  it("resolves userId from explicit then config", () => {
    expect(resolveUserId(cfg, { userId: "bob" })).toBe("bob");
    expect(resolveUserId(cfg, {})).toBe("alice");
  });
});

describe("buildBaseMetadata", () => {
  it("returns source and optional fields", () => {
    const cfg = parseConfig({ apiKey: "k", project: "p", area: "a", scope: "s" });
    expect(buildBaseMetadata(cfg)).toEqual({ source: "openclaw", project: "p", area: "a", scope: "s" });
  });
});
