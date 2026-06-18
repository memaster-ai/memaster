import { describe, expect, it } from "vitest";

import { mergeConfig, parseArgs, redact } from "../src/init-cli";
import type { OpenClawConfig } from "../src/init-cli";

describe("parseArgs", () => {
  it("defaults command to init when only flags are passed", () => {
    const result = parseArgs(["node", "openclaw-memaster", "--api-key", "msk_xxx"]);
    expect(result.command).toBe("init");
    expect(result.opts.apiKey).toBe("msk_xxx");
    expect(result.help).toBe(false);
  });

  it("recognises explicit subcommand", () => {
    const result = parseArgs(["node", "bin", "init", "--user-id", "alice", "--print"]);
    expect(result.command).toBe("init");
    expect(result.opts.userId).toBe("alice");
    expect(result.opts.print).toBe(true);
  });

  it("flags help on -h", () => {
    const result = parseArgs(["node", "bin", "-h"]);
    expect(result.help).toBe(true);
  });
});

describe("mergeConfig", () => {
  it("writes plugin slot, allow list, and entry", () => {
    const merged = mergeConfig({} as OpenClawConfig, { apiKey: "msk_test", userId: "alice" });
    expect(merged.plugins?.slots?.memory).toBe("openclaw-memaster");
    expect(merged.plugins?.allow).toEqual(
      expect.arrayContaining(["@memaster-ai/openclaw-memaster", "openclaw-memaster"]),
    );
    const entry = merged.plugins?.entries?.["openclaw-memaster"];
    expect(entry?.enabled).toBe(true);
    expect(entry?.config?.apiKey).toBe("msk_test");
    expect(entry?.config?.userId).toBe("alice");
    expect(entry?.config?.baseUrl).toBe("https://api.memaster.cn");
    expect(entry?.config?.agentId).toBe("openclaw");
  });

  it("is idempotent when run twice", () => {
    const first = mergeConfig({} as OpenClawConfig, { apiKey: "msk_test" });
    const second = mergeConfig(first, { apiKey: "msk_test" });
    expect(second.plugins?.allow?.filter((v) => v === "openclaw-memaster")).toHaveLength(1);
    expect(second.plugins?.entries?.["openclaw-memaster"]?.config?.apiKey).toBe("msk_test");
  });

  it("preserves existing fields and merges overrides", () => {
    const base: OpenClawConfig = {
      plugins: {
        allow: ["openclaw-memaster"],
        slots: { memory: "other" },
        entries: {
          "openclaw-memaster": { enabled: false, config: { agentId: "prev", topK: 9 } },
        },
      },
    };
    const merged = mergeConfig(base, { apiKey: "msk_new", userId: "alice" });
    expect(merged.plugins?.slots?.memory).toBe("openclaw-memaster");
    const entry = merged.plugins?.entries?.["openclaw-memaster"];
    // mergeConfig 不会强行启用之前显式禁用的 entry，保持用户决定
    expect(entry?.enabled).toBe(false);
    expect(entry?.config?.apiKey).toBe("msk_new");
    expect(entry?.config?.agentId).toBe("prev");
    expect(entry?.config?.topK).toBe(9);
  });

  it("throws when no apiKey provided and env empty", () => {
    const original = process.env.MEMASTER_API_KEY;
    delete process.env.MEMASTER_API_KEY;
    try {
      expect(() => mergeConfig({} as OpenClawConfig, {})).toThrowError(/Missing API key/);
    } finally {
      if (original) process.env.MEMASTER_API_KEY = original;
    }
  });
});

describe("redact", () => {
  it("masks api key in printed config", () => {
    const merged = mergeConfig({} as OpenClawConfig, { apiKey: "msk_abcd1234" });
    const redacted = redact(merged);
    const apiKey = redacted.plugins?.entries?.["openclaw-memaster"]?.config?.apiKey;
    expect(typeof apiKey).toBe("string");
    expect(apiKey as string).toMatch(/^msk_\*\*\*1234$/);
  });

  it("preserves legacy m0sk_ prefix when masking", () => {
    const merged = mergeConfig({} as OpenClawConfig, { apiKey: "m0sk_legacyabcd" });
    const redacted = redact(merged);
    const apiKey = redacted.plugins?.entries?.["openclaw-memaster"]?.config?.apiKey;
    expect(apiKey as string).toMatch(/^m0sk_\*\*\*abcd$/);
  });
});
