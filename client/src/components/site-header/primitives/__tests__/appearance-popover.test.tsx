import "../../../../test/setup";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from "../../../../state/config";
import { ProfileContext, type Profile } from "../../../../state/profile";
import { client } from "../../../../app/runtime";
import { MULTI_COLOR_PALETTES } from "../../../../utils/theme-color";
import { AppearancePopover } from "../appearance-popover";

if (typeof globalThis.location === "undefined" && typeof window !== "undefined") {
  (globalThis as any).location = window.location;
}

if (typeof window !== "undefined") {
  (globalThis as any).Event = window.Event;
  (globalThis as any).CustomEvent = window.CustomEvent;
}

const memStore: Record<string, string> = {};
(globalThis as any).sessionStorage = {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = String(v);
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  clear: () => {
    Object.keys(memStore).forEach((k) => delete memStore[k]);
  },
};

const updateConfigMock = mock(async () => ({}));
const activeSpies: Array<{ mockRestore: () => void }> = [];

mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: {
      language: "zh-CN",
      changeLanguage: mock(),
    },
  }),
}));

function renderPopover({
  configValues = {},
  profile = null,
}: {
  configValues?: Record<string, unknown>;
  profile?: Profile | null;
} = {}) {
  const config = new ConfigWrapper(configValues, defaultClientConfig);
  return render(
    <ProfileContext.Provider value={profile}>
      <ClientConfigContext.Provider value={config}>
        <AppearancePopover plain />
      </ClientConfigContext.Provider>
    </ProfileContext.Provider>,
  );
}

describe("AppearancePopover", () => {
  beforeEach(() => {
    updateConfigMock.mockClear();
    activeSpies.push(spyOn(client.config, "update").mockImplementation(updateConfigMock as any));
    try {
      sessionStorage.clear();
    } catch {}
    document.documentElement.removeAttribute("data-body-font");
    document.documentElement.style.cssText = "";
  });

  afterEach(() => {
    cleanup();
    while (activeSpies.length > 0) {
      activeSpies.pop()?.mockRestore();
    }
    try {
      sessionStorage.clear();
    } catch {}
  });

  it("opens the popover panel, closes on Escape/outside click, and contains no duplicate dark/light mode toggle", () => {
    const { getByRole, queryByRole } = renderPopover();

    const trigger = getByRole("button", { name: "外观设置" });
    expect(trigger).toBeDefined();
    expect(queryByRole("dialog", { name: "外观与氛围设置" })).toBeNull();

    fireEvent.click(trigger);

    const dialog = getByRole("dialog", { name: "外观与氛围设置" });
    expect(dialog).toBeDefined();
    expect(queryByRole("button", { name: /切换日夜模式/ })).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("dialog", { name: "外观与氛围设置" })).toBeNull();

    fireEvent.click(trigger);
    expect(getByRole("dialog", { name: "外观与氛围设置" })).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(queryByRole("dialog", { name: "外观与氛围设置" })).toBeNull();
  });

  it("toggles ambience to sakura, persists sessionStorage, dispatches rin:ambience-updated, and persists admin config", async () => {
    const events: string[] = [];
    const listener = (e: Event) => {
      const mode = (e as CustomEvent<{ mode?: string }>).detail?.mode;
      if (mode) events.push(mode);
    };
    window.addEventListener("rin:ambience-updated", listener);

    try {
      const { getByRole } = renderPopover({
        profile: { id: 1, name: "admin", avatar: "", permission: true },
      });

      fireEvent.click(getByRole("button", { name: "外观设置" }));
      const sakuraBtn = getByRole("button", { name: "樱花" });
      fireEvent.click(sakuraBtn);

      expect(sakuraBtn.getAttribute("aria-pressed")).toBe("true");
      expect(sessionStorage.getItem("rin_visitor_ambience")).toBe("sakura");
      expect(events).toEqual(["sakura"]);

      await waitFor(() => {
        expect(updateConfigMock).toHaveBeenCalledWith("client", { "theme.ambience": "sakura" });
      });
    } finally {
      window.removeEventListener("rin:ambience-updated", listener);
    }
  });

  it("switches paper preset to warm_wheat, updates DOM tokens and sessionStorage config, and supports font & size controls", () => {
    const configEvents: number[] = [];
    const onConfigUpdated = () => configEvents.push(1);
    window.addEventListener("rin:config-updated", onConfigUpdated);

    try {
      const { getByRole, getByText } = renderPopover();
      const warmWheat = MULTI_COLOR_PALETTES.find((p) => p.id === "warm_wheat")!;

      fireEvent.click(getByRole("button", { name: "外观设置" }));
      fireEvent.click(getByRole("button", { name: /暖麦护眼/ }));

      const stored = JSON.parse(sessionStorage.getItem("config") || "{}");
      expect(stored["theme.preset"]).toBe("warm_wheat");
      expect(stored["theme.color"]).toBe(warmWheat.primary);
      expect(stored["theme.secondary_color"]).toBe(warmWheat.secondary);
      expect(configEvents.length).toBeGreaterThanOrEqual(1);
      expect(document.documentElement.style.getPropertyValue("--rin-canvas-rgb")).toBe("250 246 238");

      fireEvent.click(getByRole("button", { name: "霞鹜文楷" }));
      expect(document.documentElement.getAttribute("data-body-font")).toBe("kai");

      expect(getByText("16px")).toBeDefined();
      fireEvent.click(getByRole("button", { name: "增大字号" }));
      expect(getByText("17px")).toBeDefined();
      expect(document.documentElement.style.getPropertyValue("--rin-font-size")).toBe("17px");
    } finally {
      window.removeEventListener("rin:config-updated", onConfigUpdated);
    }
  });
});
