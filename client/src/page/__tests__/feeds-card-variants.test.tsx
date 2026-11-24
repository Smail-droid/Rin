import "../../test/setup";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";

if (typeof globalThis.location === "undefined" && typeof window !== "undefined") {
  (globalThis as any).location = window.location;
}
if (typeof window !== "undefined") {
  (globalThis as any).Event = window.Event;
  (globalThis as any).CustomEvent = window.CustomEvent;
  if (!window.matchMedia) {
    window.matchMedia = (() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as any;
  }
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

(globalThis as any).sessionStorage = createMemStorage();
(globalThis as any).localStorage = createMemStorage();

import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from "../../state/config";
import { ProfileContext } from "../../state/profile";
import { client } from "../../app/runtime";
import { Router } from "wouter";
import { AtelierPhotoCard, FeedsPage } from "../feeds";
import { TimelinePage } from "../timeline";
import { MomentsPage } from "../moments";

const activeSpies: Array<{ mockRestore: () => void }> = [];

afterEach(() => {
  cleanup();
  while (activeSpies.length > 0) {
    activeSpies.pop()?.mockRestore();
  }
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {}
});

const sampleFeed = {
  id: 42,
  title: "调优 Linux TCP 拥塞控制与队列调度",
  summary: "深入对比 BBR 与 Cubic 在高延迟高丢包链路中的吞吐表现与队列调优实战。",
  avatar: "https://example.com/cover.png#width=1200&height=800",
  createdAt: "2026-11-06T12:00:00Z",
  updatedAt: "2026-11-06T12:00:00Z",
  readingTime: 14,
  top: 1,
  draft: 0,
  hashtags: [
    { id: 1, name: "Linux" },
    { id: 2, name: "TCP" },
  ],
};

function renderCard(variant: "default" | "poster" | "editorial" | "compact", extraConfig: Record<string, unknown> = {}) {
  const config = new ConfigWrapper(
    {
      "feed.card_variant": variant,
      "ai_summary.enabled": false,
      ...extraConfig,
    },
    defaultClientConfig,
  );

  return render(
    <Router ssrPath="/">
      <ClientConfigContext.Provider value={config}>
        <AtelierPhotoCard feed={sampleFeed} index={0} />
      </ClientConfigContext.Provider>
    </Router>,
  );
}

describe("Feeds AtelierPhotoCard variants", () => {
  it("keeps Polaroid title visibly readable in the bottom chin and preserves natural aspect ratio without zero-height collapse", () => {
    const { container, getByText } = renderCard("default");

    const titleHeading = getByText(sampleFeed.title);
    expect(titleHeading.tagName).toBe("H2");
    expect(titleHeading.closest(".opacity-0")).toBeNull();

    const coverWrapper = container.querySelector("[data-cover-frame]") as HTMLElement | null;
    expect(coverWrapper).not.toBeNull();
    expect(coverWrapper?.style.aspectRatio).toBe("1200 / 800");
  });

  it("renders regular article summary in editorial mode even when ai_summary.enabled is false", () => {
    const { getByText } = renderCard("editorial", { "ai_summary.enabled": false });

    expect(getByText(sampleFeed.summary).isConnected).toBe(true);
    expect(getByText("#Linux").isConnected).toBe(true);
  });

  it("renders pure hashtag labels in compact mode without arrow icons", () => {
    const { getByText, container } = renderCard("compact");

    expect(getByText("#Linux").isConnected).toBe(true);
    expect(getByText("#TCP").isConnected).toBe(true);
    expect(container.querySelector(".ri-arrow-right-up-line")).toBeNull();
  });
});

describe("Shared PageHeader & container alignment", () => {
  it("renders layout switcher, AI summary toggle, and tag manager inside FeedsPage PageHeader without the giant hidden-tags banner", async () => {
    activeSpies.push(
      spyOn(client.feed, "list").mockResolvedValue({
        data: { size: 1, data: [sampleFeed], hasNext: false },
        error: null,
      } as any),
      spyOn(client.tag, "list").mockResolvedValue({
        data: [{ id: 1, name: "Linux", feeds: 2 }],
        error: null,
      } as any),
      spyOn(client.config, "update").mockResolvedValue({ data: null, error: null } as any),
    );

    const config = new ConfigWrapper(
      {
        "feed.card_variant": "compact",
        "ai_summary.enabled": false,
        "gallery.align": "center",
        "gallery.columns": "auto",
        "gallery.homepage_tags_config": JSON.stringify({
          enabled: false,
          hiddenIds: [1],
          customOrder: [],
          limit: 0,
          palette: "pastel",
          aliases: {},
        }),
      },
      defaultClientConfig,
    );

    let configEvents = 0;
    const onConfigUpdated = () => {
      configEvents += 1;
    };
    window.addEventListener("rin:config-updated", onConfigUpdated);

    const { container, getByRole, queryByText } = render(
      <Router ssrPath="/">
        <ProfileContext.Provider value={{ id: 1, name: "80hou", avatar: "", permission: true }}>
          <ClientConfigContext.Provider value={config}>
            <FeedsPage />
          </ClientConfigContext.Provider>
        </ProfileContext.Provider>
      </Router>,
    );

    try {
      await waitFor(() => {
        expect(container.querySelector("[data-content-zone='true']")).not.toBeNull();
      });

      const main = container.querySelector("main") as HTMLElement;
      expect(main.className).toContain("max-w-6xl");

      const header = container.querySelector("header[data-page-header-mode='clean']") as HTMLElement;
      expect(header).not.toBeNull();
      expect(main.contains(header)).toBe(true);

      const contentZone = container.querySelector("[data-content-zone='true']") as HTMLElement;
      expect(contentZone.className).toContain("w-full");
      expect(contentZone.className).not.toContain("max-w-4xl");

      const layoutBtn = getByRole("button", { name: /列表|variant\.compact/ });
      const aiBtn = getByRole("button", { name: /导读:关|ai_summary\.status_off/ });
      const tagBtn = getByRole("button", { name: /标签管理/ });
      expect(header.contains(layoutBtn)).toBe(true);
      expect(header.contains(aiBtn)).toBe(true);
      expect(header.contains(tagBtn)).toBe(true);

      expect(queryByText(/首页标签已全部隐藏/)).toBeNull();
      expect(queryByText(/设置首页标签/)).toBeNull();

      await act(async () => {
        fireEvent.click(layoutBtn);
        fireEvent.click(aiBtn);
      });

      const saved = JSON.parse(sessionStorage.getItem("config") || "{}");
      expect(saved["feed.card_variant"]).toBe("default");
      expect(saved["ai_summary.enabled"]).toBe(true);
      expect(configEvents).toBeGreaterThanOrEqual(2);
    } finally {
      window.removeEventListener("rin:config-updated", onConfigUpdated);
    }
  });

  it("aligns TimelinePage and MomentsPage to GALLERY_CONTAINER_CLASS with PageHeader and removes Moments back link", async () => {
    activeSpies.push(
      spyOn(client.feed, "timeline").mockResolvedValue({
        data: [{ id: 42, title: sampleFeed.title, createdAt: sampleFeed.createdAt }],
        error: null,
      } as any),
      spyOn(client.moments, "list").mockResolvedValue({
        data: { size: 1, data: [{ id: 1, content: "随笔测试", createdAt: new Date(), updatedAt: new Date(), user: { id: 1, username: "80hou", avatar: "" } }], hasNext: false },
        error: null,
      } as any),
    );

    const config = new ConfigWrapper({}, defaultClientConfig);

    const timelineRender = render(
      <Router ssrPath="/timeline">
        <ClientConfigContext.Provider value={config}>
          <TimelinePage />
        </ClientConfigContext.Provider>
      </Router>,
    );

    await waitFor(() => {
      expect(timelineRender.container.querySelector("header[data-page-header-mode]")).not.toBeNull();
    });
    expect(timelineRender.container.querySelector("main")?.className).toContain("max-w-6xl");
    expect(timelineRender.getByText("CHRONICLE · 2").isConnected).toBe(true);
    timelineRender.unmount();

    const momentsRender = render(
      <Router ssrPath="/moments">
        <ProfileContext.Provider value={{ id: 1, name: "80hou", avatar: "", permission: true }}>
          <ClientConfigContext.Provider value={config}>
            <MomentsPage />
          </ClientConfigContext.Provider>
        </ProfileContext.Provider>
      </Router>,
    );

    await waitFor(() => {
      expect(momentsRender.container.querySelector("header[data-page-header-mode]")).not.toBeNull();
    });
    expect(momentsRender.container.querySelector("main")?.className).toContain("max-w-6xl");
    expect(momentsRender.getByText("MOMENTS · 1").isConnected).toBe(true);
    expect(momentsRender.queryByText(/返回画廊|back_to_gallery/)).toBeNull();
    expect(momentsRender.getByRole("button", { name: /记录新灵感|moments\.new_moment/ }).isConnected).toBe(true);
  });
});
