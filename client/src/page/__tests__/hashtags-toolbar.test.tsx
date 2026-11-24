import "../../test/setup";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { HashtagsPage } from "../hashtags";
import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from "../../state/config";
import { ProfileContext } from "../../state/profile";
import { client } from "../../app/runtime";
import { subscribeToast } from "../../utils/toast";
import ReactModal from "react-modal";

mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: {
      language: "zh-CN",
      changeLanguage: mock(),
    },
  }),
}));

mock.module("react-modal", () => ({
  default: ({ isOpen, children }: { isOpen?: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

if (typeof globalThis.location === "undefined" && typeof window !== "undefined") {
  (globalThis as any).location = window.location;
}

const createMemStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
};

if (typeof globalThis.requestAnimationFrame === "undefined") {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = createMemStorage();
}
if (typeof globalThis.sessionStorage === "undefined") {
  (globalThis as any).sessionStorage = createMemStorage();
}

if (typeof ReactModal?.setAppElement === "function") {
  ReactModal.setAppElement(document.body);
}

const activeSpies: Array<{ mockRestore: () => void }> = [];

afterEach(() => {
  cleanup();
  while (activeSpies.length > 0) {
    activeSpies.pop()?.mockRestore();
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
});

const sampleTags = [
  {
    id: 1,
    name: "Cloudflare",
    feeds: 8,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: 2,
    name: "DesignSystem",
    feeds: 4,
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z",
  },
  {
    id: 3,
    name: "OrphanTag",
    feeds: 0,
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
  },
];

beforeEach(() => {
  activeSpies.push(
    spyOn(client.tag, "list").mockResolvedValue({ data: sampleTags, error: null } as any),
    spyOn(client.tag, "create").mockResolvedValue({ data: { id: 4, name: "NewTag" }, error: null } as any),
  );
});

function renderHashtagsPage(isAdmin = false) {
  const config = new ConfigWrapper({}, defaultClientConfig);
  return render(
    <Router ssrPath="/hashtags">
      <ProfileContext.Provider value={isAdmin ? { id: 1, name: "admin", avatar: "", permission: true } : undefined}>
        <ClientConfigContext.Provider value={config}>
          <HashtagsPage />
        </ClientConfigContext.Provider>
      </ProfileContext.Provider>
    </Router>,
  );
}

describe("HashtagsPage unified PageHeader, toolbar, and bottom pagination", () => {
  it("renders unified PageHeader without 返回画廊 and single balanced toolbar for visitors", async () => {
    const { container, getByText, getByPlaceholderText, getByRole, queryByText, queryByRole } =
      renderHashtagsPage(false);

    await waitFor(
      () => {
        expect(container.querySelector("[data-hashtags-toolbar='true']")).not.toBeNull();
      },
      { timeout: 4000 },
    );

    const main = container.querySelector("main");
    expect(main?.className).toContain("max-w-6xl");

    const header = container.querySelector("header[data-page-header-mode]");
    expect(header).not.toBeNull();
    expect(getByRole("heading", { level: 1 }).textContent?.length).toBeGreaterThan(0);
    // Subtitle may show translated or key form depending on mock resolution order
    expect(queryByText(/返回画廊|back_to_gallery/)).toBeNull();

    // Unified toolbar
    const toolbar = container.querySelector("[data-hashtags-toolbar='true']");
    expect(toolbar).not.toBeNull();

    const searchInput = getByPlaceholderText("搜索标签或 ID...");
    expect(toolbar?.contains(searchInput)).toBe(true);
    expect(getByRole("button", { name: /最新/ }).isConnected).toBe(true);
    expect(getByRole("button", { name: /热门/ }).isConnected).toBe(true);
    expect(getByRole("button", { name: /素雅描边/ }).isConnected).toBe(true);
    expect(getByRole("button", { name: /晶透书签/ }).isConnected).toBe(true);
    expect(getByRole("button", { name: /极简排印/ }).isConnected).toBe(true);

    // Visitor cannot see admin-only controls
    expect(queryByRole("button", { name: /表格/ })).toBeNull();
    expect(queryByRole("button", { name: /新建标签/ })).toBeNull();
    expect(queryByText("OrphanTag")).toBeNull();

    await waitFor(
      () => {
        expect(getByText("DesignSystem").isConnected).toBe(true);
      },
      { timeout: 5000 },
    );

    // Default calm hairline pill styling on tags
    const designLink = getByText("DesignSystem").closest("a");
    expect(designLink?.className).toContain("border-[rgb(var(--rin-hairline-rgb))]");
    expect(designLink?.className).toContain("bg-[rgb(var(--rin-surface-rgb))]");
    expect(getByText("Cloudflare").isConnected).toBe(true);
  }, 15000);

  it(
    "provides compact inline create toggle, view switcher, bottom pagination footer, and emitToast feedback for admins",
    async () => {
    const toasts: Array<{ message: string; tone: string }> = [];
    const unsubscribe = subscribeToast((payload) => {
      toasts.push({ message: payload.message, tone: payload.tone });
    });

    try {
      const {
        container,
        getByRole,
        getByPlaceholderText,
        getByText,
        queryByPlaceholderText,
      } = renderHashtagsPage(true);

    await waitFor(
      () => {
        expect(container.querySelector("[data-hashtags-toolbar='true']")).not.toBeNull();
      },
      { timeout: 4000 },
    );

    // Admin segmented filters & clean button in unified toolbar
    // Note: button names come from either translated Chinese or i18n keys
    const toolbar = container.querySelector("[data-hashtags-toolbar='true']");
    expect(toolbar).not.toBeNull();
    const toolbarButtons = toolbar!.querySelectorAll("button");
    expect(toolbarButtons.length).toBeGreaterThanOrEqual(5);

    // Inline create bar is collapsed initially
    expect(queryByPlaceholderText(/输入新标签名称/)).toBeNull();

    const createBtn = Array.from(container.querySelectorAll("button")).find((b: Element) =>
      b.textContent?.includes("新建标签"),
    );
    expect(createBtn).toBeDefined();
    await act(async () => {
      fireEvent.click(createBtn!);
    });

    const createInput = getByPlaceholderText("输入新标签名称（回车创建）...");
    expect(createInput.isConnected).toBe(true);

    await act(async () => {
      fireEvent.change(createInput, { target: { value: "NewTag" } });
    });
    await new Promise((r) => setTimeout(r, 60));

    await act(async () => {
      const submitBtn = container.querySelector("form button[type='submit']");
      if (submitBtn) {
        fireEvent.click(submitBtn);
      } else {
        const form = createInput.closest("form");
        if (form) fireEvent.submit(form);
      }
    });

    await waitFor(
      () => {
        expect(toasts.some((t) => t.tone === "success" && t.message.includes("NewTag"))).toBe(true);
      },
      { timeout: 4000 },
    );

      // Switch to table view
      const tableViewBtn = Array.from(container.querySelectorAll("button")).find((b: Element) =>
        /表格|table/i.test(b.textContent || ""),
      );
      expect(tableViewBtn).toBeDefined();
      await act(async () => {
        fireEvent.click(tableViewBtn!);
      });

      const table = container.querySelector("table");
      expect(table).not.toBeNull();

      const paginationFooter = container.querySelector("[data-hashtags-pagination-footer='true']");
      expect(paginationFooter).not.toBeNull();
      expect(paginationFooter?.className).toContain("border-t");
      expect(paginationFooter?.textContent).toContain("显示第 1 - 3 项 (共 3 项)");
      expect(getByText(/显示第 1 - 3 项/)).toBeTruthy();
      expect(paginationFooter?.contains(getByText(/显示第 1 - 3 项/))).toBe(true);

      // Selecting all reveals 批量删除 (N) button in toolbar
      const selectAllCheckbox = getByRole("checkbox", { name: "全选当前页标签" });
      await act(async () => {
        fireEvent.click(selectAllCheckbox);
      });
      expect(getByRole("button", { name: /批量删除 \(3\)/ }).isConnected).toBe(true);
    } finally {
      unsubscribe();
    }
  }, 15000);
});
