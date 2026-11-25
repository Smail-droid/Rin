import "../../test/setup";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Router } from "wouter";

if (typeof globalThis.location === "undefined" && typeof window !== "undefined") {
  (globalThis as any).location = window.location;
}
if (typeof (globalThis as any).HTMLCollection === "undefined" && typeof window !== "undefined") {
  (globalThis as any).HTMLCollection = (window as any).HTMLCollection;
}
if (typeof (globalThis as any).NodeList === "undefined" && typeof window !== "undefined") {
  (globalThis as any).NodeList = (window as any).NodeList;
}
if (typeof globalThis.requestAnimationFrame === "undefined") {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}

const { client } = await import("../../app/runtime");
const { ADMIN_NAV_ITEMS } = await import("../../components/admin-layout");
const { WritingAICopilotDrawer } = await import("../../components/writing-ai-copilot-drawer");
const { ClientConfigContext, ConfigWrapper, defaultClientConfig } = await import("../../state/config");
const { AdminAIPage } = await import("../admin-ai");
const { AISummarySettings } = await import("../settings-ai");
const ReactModal = (await import("react-modal")).default as any;
if (typeof ReactModal?.setAppElement === "function") {
  ReactModal.setAppElement(document.body);
}

const memStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => memStorage[k] ?? null,
  setItem: (k: string, v: string) => {
    memStorage[k] = String(v);
  },
  removeItem: (k: string) => {
    delete memStorage[k];
  },
  clear: () => {
    Object.keys(memStorage).forEach((k) => delete memStorage[k]);
  },
};

const origConfigMethods = {
  getAll: client.config.getAll.bind(client.config),
  updateAll: client.config.updateAll.bind(client.config),
  get: client.config.get.bind(client.config),
  update: client.config.update.bind(client.config),
  fetchAIModels: client.config.fetchAIModels.bind(client.config),
  testAI: client.config.testAI.bind(client.config),
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  client.config.getAll = origConfigMethods.getAll;
  client.config.updateAll = origConfigMethods.updateAll;
  client.config.get = origConfigMethods.get;
  client.config.update = origConfigMethods.update;
  client.config.fetchAIModels = origConfigMethods.fetchAIModels;
  client.config.testAI = origConfigMethods.testAI;
});

describe("Admin AI hub & sidebar restoration", () => {
  it("includes cohesive admin nav items including /admin/ai (AI 助手) and in-admin content routes", () => {
    const aiItem = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/ai");
    expect(aiItem).toBeDefined();
    expect(aiItem?.label).toBe("AI 助手");
    expect(ADMIN_NAV_ITEMS.some((item) => item.href === "/admin/files")).toBe(true);
    expect(ADMIN_NAV_ITEMS.some((item) => item.href === "/admin/music")).toBe(true);
    expect(ADMIN_NAV_ITEMS.some((item) => item.href === "/admin/tags")).toBe(true);
  });

  it("AdminAIPage saves non-blockingly with inline 已保存 ✓ and triggers modal only on error", async () => {
    let savedDraft: any = null;
    client.config.getAll = async () => ({
      data: {
        clientConfig: {},
        serverConfig: {
          "ai_summary.enabled": "true",
          "ai_summary.provider": "openai",
          "ai_summary.model": "gpt-4o-mini",
          "ai_summary.api_key": "••••••••",
          "ai_summary.api_url": "https://api.openai.com/v1",
          "ai_summary.prompt_presets": "",
        },
      },
    });
    client.config.updateAll = async (draft: any) => {
      savedDraft = draft;
      return {
        data: {
          clientConfig: draft.clientConfig,
          serverConfig: {
            ...draft.serverConfig,
            "ai_summary.api_key": "••••••••",
          },
        },
      };
    };

    const config = new ConfigWrapper({}, defaultClientConfig);
    const { getByRole, queryByRole, findByText } = render(
      <Router ssrPath="/admin/ai">
        <ClientConfigContext.Provider value={config}>
          <AdminAIPage />
        </ClientConfigContext.Provider>
      </Router>,
    );

    await findByText("发布时自动生成导读");
    const saveBtn = getByRole("button", { name: "保存" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedDraft).not.toBeNull();
    });

    // Inline feedback without blocking Alert Modal
    const savedButton = await waitFor(() => getByRole("button", { name: /已保存/ }));
    expect(savedButton).toBeDefined();
    expect(queryByRole("dialog")).toBeNull();
    expect(savedDraft.serverConfig["ai_summary.provider"]).toBe("openai");
  });

  it("AdminAIPage displays alert modal only when save fails", async () => {
    client.config.getAll = async () => ({
      data: {
        clientConfig: {},
        serverConfig: {
          "ai_summary.enabled": "true",
          "ai_summary.provider": "openai",
          "ai_summary.model": "gpt-4o-mini",
          "ai_summary.api_key": "",
          "ai_summary.api_url": "https://api.openai.com/v1",
        },
      },
    });
    client.config.updateAll = async () => ({
      error: { status: 500, value: "保存出错：权限不足" },
    });

    const config = new ConfigWrapper({}, defaultClientConfig);
    const { findByText, getByRole } = render(
      <Router ssrPath="/admin/ai">
        <ClientConfigContext.Provider value={config}>
          <AdminAIPage />
        </ClientConfigContext.Provider>
      </Router>,
    );

    await findByText("发布时自动生成导读");
    const saveBtn = getByRole("button", { name: "保存" });
    fireEvent.click(saveBtn);

    expect(await findByText("保存出错：权限不足")).toBeDefined();
    expect(await findByText("confirm")).toBeDefined();
  });

  it("AISummarySettings syncs prompt presets to onChange and fetches models with stored apiKeySet without modal alert on success", async () => {
    const updatesLog: Array<Record<string, unknown>> = [];
    const fetchCalls: Array<Record<string, unknown>> = [];
    const serverPresets = JSON.stringify([
      {
        id: "server_preset_1",
        name: "服务端预设方案",
        stage: "custom",
        stageLabel: "自定义",
        enabled: true,
        prompt: "服务端提示词内容",
      },
    ]);

    client.config.fetchAIModels = async (body: any) => {
      fetchCalls.push(body);
      return {
        data: {
          success: true,
          models: ["claude-sonnet-4-5", "claude-3-5-haiku"],
        },
      };
    };

    const { getByText, queryByRole, findByText } = render(
      <AISummarySettings
        value={{
          enabled: true,
          provider: "claude",
          model: "claude-sonnet-4-5",
          apiKey: "",
          apiKeySet: true,
          apiUrl: "https://api.anthropic.com/v1",
          promptPresets: serverPresets,
        }}
        onChange={(updates) => {
          updatesLog.push(updates);
        }}
      />,
    );

    // Server prompt presets rendered instead of hardcoded defaults
    expect(getByText("服务端预设方案")).toBeDefined();

    // Add custom preset updates promptPresets JSON via onChange
    fireEvent.click(getByText("新增预设版本"));
    expect(updatesLog.length).toBeGreaterThan(0);
    const lastUpdate = updatesLog[updatesLog.length - 1];
    expect(typeof lastUpdate.promptPresets).toBe("string");
    expect(String(lastUpdate.promptPresets)).toContain("服务端预设方案");

    // Fetch remote models works even when apiKey input is empty because apiKeySet=true
    const fetchBtn = getByText("从端点拉取模型");
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(fetchCalls).toHaveLength(1);
    });
    expect(fetchCalls[0].provider).toBe("claude");
    expect(await findByText(/已拉取 \(2\)/)).toBeDefined();
    expect(await findByText(/已从端点拉取 2 个可用模型/)).toBeDefined();
    expect(queryByRole("dialog")).toBeNull();
  });

  it("AISummarySettings saves prompt inline without alert modal", async () => {
    let savedCalled = false;
    const { getByText, queryByRole, findByText } = render(
      <AISummarySettings
        value={{
          enabled: true,
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "",
          apiKeySet: true,
          apiUrl: "https://api.openai.com/v1",
        }}
        onChange={() => {}}
        onSave={async () => {
          savedCalled = true;
        }}
      />,
    );

    fireEvent.click(getByText("保存提示词"));
    await waitFor(() => {
      expect(savedCalled).toBe(true);
    });
    expect(await findByText("✓ 已保存")).toBeDefined();
    expect(queryByRole("dialog")).toBeNull();
  });

  it("WritingAICopilotDrawer uses unified ai_summary.* keys and loads server-persisted prompt presets", async () => {
    const updatePayloads: Array<{ type: string; body: Record<string, unknown> }> = [];
    const fetchCalls: Array<Record<string, unknown>> = [];
    const serverPresets = JSON.stringify([
      {
        id: "srv-p1",
        name: "服务端写作预设",
        stage: "custom",
        stageLabel: "自定义",
        enabled: true,
        prompt: "请按照服务端规范梳理",
      },
    ]);

    client.config.get = async () => ({
      data: {
        "ai_summary.enabled": "true",
        "ai_summary.provider": "gemini",
        "ai_summary.model": "gemini-2.5-flash",
        "ai_summary.api_key": "••••••••",
        "ai_summary.api_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "ai_summary.prompt_presets": serverPresets,
      },
    });
    client.config.update = async (type: any, body: any) => {
      updatePayloads.push({ type, body });
      return { data: undefined };
    };
    client.config.fetchAIModels = async (body: any) => {
      fetchCalls.push(body);
      return { data: { success: true, models: ["gemini-2.5-flash", "gemini-2.5-pro"] } };
    };
    client.config.testAI = async () => ({ data: { success: true, response: "hi" } });

    const config = new ConfigWrapper({}, defaultClientConfig);
    const { getByText, getByTitle, findByText } = render(
      <ClientConfigContext.Provider value={config}>
        <WritingAICopilotDrawer
          isOpen
          onClose={() => {}}
          articleContent="hello"
          onInsertText={() => {}}
          onReplaceContent={() => {}}
          onApplySummary={() => {}}
        />
      </ClientConfigContext.Provider>,
    );

    // Switch to Presets tab and verify server-persisted prompt preset is displayed
    fireEvent.click(getByText("提示词预设"));
    expect(await findByText("服务端写作预设")).toBeDefined();

    // Open in-situ settings panel and verify model fetch + save write ai_summary.* keys
    fireEvent.click(getByTitle("AI 模型与服务商就地配置"));
    const fetchModelsBtn = await findByText("从端点拉取模型");
    fireEvent.click(fetchModelsBtn);
    await waitFor(() => {
      expect(fetchCalls).toHaveLength(1);
    });
    expect(fetchCalls[0].provider).toBe("gemini");

    fireEvent.click(getByText("保存并测试连通性"));
    await waitFor(() => {
      expect(updatePayloads.length).toBeGreaterThan(0);
    });
    const saved = updatePayloads[0].body;
    expect(saved["ai_summary.provider"]).toBe("gemini");
    expect(saved["ai_summary.model"]).toBe("gemini-2.5-flash");
    expect(saved["ai_summary.enabled"]).toBe("true");
    expect(saved["ai_provider"]).toBeUndefined();
    expect(saved["ai_model"]).toBeUndefined();
  });

  it("AISummarySettings keeps model configuration and prompt presets accessible even when auto-summary is disabled", () => {
    const { getByText, getByPlaceholderText } = render(
      <AISummarySettings
        value={{
          enabled: false,
          provider: "gemini",
          model: "gemini-2.5-flash",
          apiKey: "",
          apiKeySet: false,
          apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        }}
        onChange={() => {}}
      />,
    );

    expect(getByText("发布时自动生成导读")).toBeDefined();
    expect(getByText("已关闭")).toBeDefined();
    expect(getByText("模型接入与鉴权")).toBeDefined();
    expect(getByText("提示词预设库")).toBeDefined();
    expect(getByPlaceholderText("请填写当前服务商的 API Key...")).toBeDefined();
    expect(getByText("测试连接")).toBeDefined();
  });

  it("AISummarySettings blocks fetching models when switching provider without entering a new API key", () => {
    let fetchCalled = false;
    client.config.fetchAIModels = async () => {
      fetchCalled = true;
      return { data: { success: true, models: [] } };
    };

    const { getByText } = render(
      <AISummarySettings
        value={{
          enabled: false,
          provider: "gemini",
          model: "gemini-2.5-flash",
          apiKey: "",
          apiKeySet: true,
          apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        }}
        savedProvider="openai"
        onChange={() => {}}
      />,
    );

    expect(getByText("切换服务商后请填写新密钥")).toBeDefined();
    const fetchBtn = getByText("从端点拉取模型").closest("button")!;
    expect(fetchBtn.disabled).toBe(true);
    expect(fetchCalled).toBe(false);
  });
});
