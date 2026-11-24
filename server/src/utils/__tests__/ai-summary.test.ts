import { afterEach, describe, expect, it, mock } from "bun:test";
import type { AIConfig } from "@rin/api";
import { AI_CONFIG_PREFIX } from "@rin/config";
import { ConfigService } from "../../services/config";
import { cleanupTestDB, createTestUser, setupTestApp } from "../../../tests/fixtures";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createAIConfigReader(config: AIConfig) {
  const values = new Map<string, unknown>(
    Object.entries(config).map(([key, value]) => [`${AI_CONFIG_PREFIX}${key}`, value]),
  );

  return {
    async get(key: string) {
      return values.get(key);
    },
  };
}

describe("generateAISummaryResult", () => {
  it("returns a concrete error when AI responds with empty content", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "worker-ai",
      model: "llama-3-8b",
      api_key: "",
      api_url: "",
    });

    const { generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({
      AI: {
        run: async () => ({ response: "" }),
      },
    } as unknown as Env, serverConfig, "test content");

    expect(result.summary).toBeNull();
    expect(result.skipped).toBe(false);
    expect(result.error).toContain('Empty response from AI provider "worker-ai"');
  });

  it("sends summary system prompt to Workers AI", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "worker-ai",
      model: "llama-3-8b",
      api_key: "",
      api_url: "",
    });

    const calls: Array<any> = [];
    const { AI_SUMMARY_SYSTEM_PROMPT, generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({
      AI: {
        run: async (_model: string, payload: any) => {
          calls.push(payload);
          return { response: "summary" };
        },
      },
    } as unknown as Env, serverConfig, "test content");

    expect(result.summary).toBe("summary");
    expect(calls).toHaveLength(1);
    expect(calls[0].messages[0]).toEqual({
      role: "system",
      content: AI_SUMMARY_SYSTEM_PROMPT,
    });
    expect(calls[0].messages[1]).toEqual({
      role: "user",
      content: "test content",
    });
  });

  it("sends summary system prompt to external AI providers", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      api_key: "secret",
      api_url: "https://api.openai.com/v1",
    });

    const requests: Array<any> = [];
    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(init);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "summary" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { AI_SUMMARY_SYSTEM_PROMPT, generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({} as Env, serverConfig, "external content");

    expect(result.summary).toBe("summary");
    expect(requests).toHaveLength(1);
    const body = JSON.parse(String(requests[0].body));
    expect(body.messages[0]).toEqual({
      role: "system",
      content: AI_SUMMARY_SYSTEM_PROMPT,
    });
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "external content",
    });
  });

  it("uses Anthropic Claude native /v1/messages protocol and headers", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "claude",
      model: "claude-sonnet-4-5",
      api_key: "sk-ant-test-key",
      api_url: "https://api.anthropic.com/v1",
    });

    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        content: [{ type: "text", text: "导读：Anthropic 摘要结果。" }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { AI_SUMMARY_SYSTEM_PROMPT, generateAISummaryResult } = await import("../ai");
    const result = await generateAISummaryResult({} as Env, serverConfig, "claude article");

    expect(result.summary).toBe("导读：Anthropic 摘要结果。");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.anthropic.com/v1/messages");
    const headers = requests[0].init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["Authorization"]).toBeUndefined();
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body.system).toBe(AI_SUMMARY_SYSTEM_PROMPT);
    expect(body.messages).toEqual([{ role: "user", content: "claude article" }]);
  });

  it("supports OpenAI-compatible relay for Claude when URL targets /chat/completions or /openai", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Relay Claude reply" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { executeExternalAI } = await import("../ai");
    const reply = await executeExternalAI(
      {
        provider: "claude",
        model: "claude-sonnet-4-5",
        api_key: "sk-relay",
        api_url: "https://relay.example.com/openai/v1",
      },
      [
        { role: "system", content: "You are concise." },
        { role: "user", content: "Hi" },
      ],
    );

    expect(reply).toBe("Relay Claude reply");
    expect(requests[0].url).toBe("https://relay.example.com/openai/v1/chat/completions");
    const headers = requests[0].init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-relay");
  });
});

describe("fetchExternalAIModels", () => {
  it("builds model endpoints accurately for Gemini, Zhipu, OpenAI, and Anthropic", async () => {
    const captured: Array<{ url: string; headers: Record<string, string> }> = [];
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      captured.push({
        url: urlStr,
        headers: (init?.headers || {}) as Record<string, string>,
      });

      if (urlStr.includes("generativelanguage.googleapis.com/v1beta/models")) {
        return new Response(JSON.stringify({
          models: [{ name: "models/gemini-2.5-flash" }],
        }), { status: 200 });
      }

      return new Response(JSON.stringify({
        data: [{ id: "model-a" }],
      }), { status: 200 });
    }) as typeof fetch;

    const { fetchExternalAIModels } = await import("../ai");

    await fetchExternalAIModels("gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "gm-key");
    await fetchExternalAIModels("zhipu", "https://open.bigmodel.cn/api/paas/v4", "zp-key");
    await fetchExternalAIModels("openai", "https://api.openai.com/v1", "oa-key");
    await fetchExternalAIModels("claude", "https://api.anthropic.com/v1", "ant-key");
    const nativeGeminiModels = await fetchExternalAIModels(
      "gemini",
      "https://generativelanguage.googleapis.com/v1beta",
      "gm-native-key",
    );

    expect(captured[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/models");
    expect(captured[0].headers["Authorization"]).toBe("Bearer gm-key");

    expect(captured[1].url).toBe("https://open.bigmodel.cn/api/paas/v4/models");
    expect(captured[1].headers["Authorization"]).toBe("Bearer zp-key");

    expect(captured[2].url).toBe("https://api.openai.com/v1/models");
    expect(captured[2].headers["Authorization"]).toBe("Bearer oa-key");

    expect(captured[3].url).toBe("https://api.anthropic.com/v1/models");
    expect(captured[3].headers["x-api-key"]).toBe("ant-key");
    expect(captured[3].headers["anthropic-version"]).toBe("2023-06-01");

    expect(captured[4].url).toBe("https://generativelanguage.googleapis.com/v1beta/models");
    expect(captured[4].headers["x-goog-api-key"]).toBe("gm-native-key");
    expect(nativeGeminiModels).toEqual(["gemini-2.5-flash"]);
  });
});

describe("ConfigService AI stored key fallback & prompt_presets persistence", () => {
  it("reuses stored dbConfig api_key when /test-ai or /ai/models receives omitted, empty, or masked key", async () => {
    const { app, sqlite, serverConfig } = await setupTestApp(ConfigService);
    createTestUser(sqlite);
    try {
      await serverConfig.set("ai_summary.enabled", "true", false);
      await serverConfig.set("ai_summary.provider", "gemini", false);
      await serverConfig.set("ai_summary.model", "gemini-2.5-flash", false);
      await serverConfig.set("ai_summary.api_url", "https://generativelanguage.googleapis.com/v1beta/openai", false);
      await serverConfig.set("ai_summary.api_key", "stored-secret-key", false);
      await serverConfig.save();

      const requests: Array<{ url: string; auth?: string }> = [];
      globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
        const headers = (init?.headers || {}) as Record<string, string>;
        requests.push({ url: String(url), auth: headers["Authorization"] });
        if (String(url).endsWith("/models")) {
          return new Response(JSON.stringify({ data: [{ id: "gemini-2.5-flash" }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      }) as typeof fetch;

      // 1. /ai/models with masked key and empty api_url
      const modelsRes = await app.request("/ai/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock_token_1",
        },
        body: JSON.stringify({
          provider: "gemini",
          api_url: "",
          api_key: "••••••••",
        }),
      });
      expect(modelsRes.status).toBe(200);
      const modelsData = await modelsRes.json() as { success: boolean; models: string[] };
      expect(modelsData.success).toBe(true);
      expect(modelsData.models).toEqual(["gemini-2.5-flash"]);
      expect(requests[0].auth).toBe("Bearer stored-secret-key");
      expect(requests[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/models");

      // 2. /test-ai with empty string api_key
      const testRes = await app.request("/test-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock_token_1",
        },
        body: JSON.stringify({
          provider: "gemini",
          model: "gemini-2.5-flash",
          api_key: "",
        }),
      });
      expect(testRes.status).toBe(200);
      const testData = await testRes.json() as { success: boolean; response?: string };
      expect(testData.success).toBe(true);
      expect(requests[1].auth).toBe("Bearer stored-secret-key");
    } finally {
      cleanupTestDB(sqlite);
    }
  });

  it("persists and returns ai_summary.prompt_presets across server config endpoints", async () => {
    const { app, sqlite } = await setupTestApp(ConfigService);
    createTestUser(sqlite);
    try {
      const presetsJson = JSON.stringify([
        { id: "p1", name: "Preset 1", stage: "custom", stageLabel: "Custom", enabled: true, prompt: "Be concise" },
      ]);

      const postRes = await app.request("/server", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock_token_1",
        },
        body: JSON.stringify({
          "ai_summary.prompt_presets": presetsJson,
        }),
      });
      expect(postRes.status).toBe(200);

      const getRes = await app.request("/server", {
        method: "GET",
        headers: {
          Authorization: "Bearer mock_token_1",
        },
      });
      expect(getRes.status).toBe(200);
      const data = await getRes.json() as Record<string, unknown>;
      expect(data["ai_summary.prompt_presets"]).toBe(presetsJson);
    } finally {
      cleanupTestDB(sqlite);
    }
  });
});
