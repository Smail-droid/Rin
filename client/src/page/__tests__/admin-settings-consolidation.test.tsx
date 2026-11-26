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
const { AdminLayout } = await import("../../components/admin-layout");
const { ClientConfigContext, ConfigWrapper, defaultClientConfig } = await import("../../state/config");
const { Settings } = await import("../settings");
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
(globalThis as any).sessionStorage = {
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

const origGetAll = client.config.getAll.bind(client.config);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  client.config.getAll = origGetAll;
});

describe("Admin Settings & Layout consolidation", () => {
  it("Settings exposes footer.by_text/by_url in general tab and links AI config cleanly to /admin/ai in services tab", async () => {
    client.config.getAll = async () => ({
      data: {
        clientConfig: {
          "site.name": "Gallery Blog",
          "footer.by_text": "80hou",
          "footer.by_url": "https://example.com",
        },
        serverConfig: {
          "ai_summary.enabled": "true",
          "ai_summary.provider": "openai",
          "ai_summary.model": "gpt-4o-mini",
          "ai_summary.api_key": "••••••••",
        },
      },
    });

    const config = new ConfigWrapper({}, defaultClientConfig);
    const { getByText, getByLabelText, queryByText } = render(
      <Router ssrPath="/admin/settings">
        <ClientConfigContext.Provider value={config}>
          <Settings />
        </ClientConfigContext.Provider>
      </Router>,
    );

    await waitFor(() => {
      expect(queryByText("读取配置…")).toBeNull();
    });

    // Switch to 基础与安全 tab and verify footer attribution inputs & single save action after editing
    fireEvent.click(getByText("基础与安全"));
    const byTextInput = getByLabelText("页脚署名文字") as HTMLInputElement;
    expect(byTextInput.value).toBe("80hou");
    fireEvent.click(getByText("极简纯文本社论顶栏"));
    expect(await waitFor(() => getByText("有未保存改动"))).toBeDefined();

    // Switch to 扩展与服务 tab and verify AI links to /admin/ai without duplicate prompt editor
    fireEvent.click(getByText("扩展与服务"));
    expect(getByText("前往 AI 助手工作台")).toBeDefined();
    expect(queryByText("保存提示词")).toBeNull();
  });

  it("AdminLayout Ctrl+K opens floating quick-navigation results", async () => {
    const config = new ConfigWrapper({}, defaultClientConfig);
    const { getByPlaceholderText, getAllByText } = render(
      <Router ssrPath="/admin/settings">
        <ClientConfigContext.Provider value={config}>
          <AdminLayout title="站点设置">
            <div>content</div>
          </AdminLayout>
        </ClientConfigContext.Provider>
      </Router>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = await waitFor(() => getByPlaceholderText("快速检索后台导航..."));
    fireEvent.change(searchInput, { target: { value: "AI" } });

    await waitFor(() => {
      expect(getAllByText("AI 助手").length).toBeGreaterThanOrEqual(2);
    });
  });
});
