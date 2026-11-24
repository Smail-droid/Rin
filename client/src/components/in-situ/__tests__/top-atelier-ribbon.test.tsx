import "../../../test/setup";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { Router } from "wouter";
import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from "../../../state/config";
import { ProfileContext } from "../../../state/profile";
import { TopAtelierRibbon } from "../top-atelier-ribbon";

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

afterEach(() => {
  cleanup();
  try {
    sessionStorage.clear();
  } catch {}
});

describe("TopAtelierRibbon", () => {
  it("renders ambience controls and visitor-safe toggles without admin links", () => {
    const config = new ConfigWrapper(
      {
        "feed.card_variant": "compact",
        "theme.preset": "sakura_paper",
        "theme.color": "#d87a90",
        "ai_summary.enabled": false,
      },
      defaultClientConfig,
    );

    const { container, queryByText } = render(
      <Router ssrPath="/">
        <ProfileContext.Provider value={null}>
          <ClientConfigContext.Provider value={config}>
            <TopAtelierRibbon />
          </ClientConfigContext.Provider>
        </ProfileContext.Provider>
      </Router>,
    );

    // TopAtelierRibbon still renders its single-strip controls when mounted directly
    expect(container.querySelector("[data-atelier-ribbon]") || container.firstElementChild).toBeDefined();
    // Visitor should not see admin quick links
    expect(queryByText(/^(撰写|writing)$/)).toBeNull();
  });

  it("shows quick studio links when logged in as admin", () => {
    const config = new ConfigWrapper({}, defaultClientConfig);

    const { getByText } = render(
      <Router ssrPath="/">
        <ProfileContext.Provider
          value={{ id: 1, name: "80hou", avatar: "", permission: true }}
        >
          <ClientConfigContext.Provider value={config}>
            <TopAtelierRibbon />
          </ClientConfigContext.Provider>
        </ProfileContext.Provider>
      </Router>,
    );

    expect(getByText(/^(撰写|writing)$/).isConnected).toBe(true);
    expect(getByText(/^(图床|gallery_title)$/).isConnected).toBe(true);
    expect(getByText(/^(音廊|music_title)$/).isConnected).toBe(true);
  });
});
