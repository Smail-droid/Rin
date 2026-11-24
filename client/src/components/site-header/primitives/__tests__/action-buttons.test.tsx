import "../../../../test/setup";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ConfigWrapper } from "../../../../state/config";
import { ClientConfigContext, defaultClientConfig } from "../../../../state/config";
import type { Profile } from "../../../../state/profile";
import { client } from "../../../../app/runtime";
import { HeaderActions, UserAvatar } from "../action-buttons";

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

const setLocationMock = mock();

mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: {
      language: "zh-CN",
      changeLanguage: mock(),
    },
  }),
}));

mock.module("wouter", () => ({
  useLocation: () => ["/", setLocationMock],
}));

mock.module("reactjs-popup", () => ({
  default: ({
    trigger,
    open,
    onOpen,
    onClose,
    children,
  }: {
    trigger: ReactNode;
    open?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    children: ReactNode;
  }) => (
    <>
      <span onClick={() => (open ? onClose?.() : onOpen?.())}>{trigger}</span>
      {open ? children : null}
    </>
  ),
}));

mock.module("react-modal", () => ({
  default: ({ isOpen, children }: { isOpen?: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

mock.module("../../../../utils/auth", () => ({
  removeAuthToken: mock(),
}));

const spies: Array<{ mockRestore: () => void }> = [];

beforeEach(() => {
  setLocationMock.mockClear();
  spies.push(
    spyOn(client.user, "logout").mockResolvedValue({} as any),
    spyOn(client.search, "search").mockResolvedValue({ data: { data: [] } } as any),
    spyOn(client.config, "update").mockResolvedValue({} as any),
  );
  try {
    sessionStorage.clear();
  } catch {}
});

afterEach(() => {
  cleanup();
  while (spies.length > 0) {
    spies.pop()?.mockRestore();
  }
});

function renderUserAvatar({
  loginEnabled,
  profile,
}: {
  loginEnabled: boolean;
  profile?: Profile | null;
}) {
  const config = new ConfigWrapper({ "login.enabled": loginEnabled }, defaultClientConfig);

  return render(
    <ClientConfigContext.Provider value={config}>
      <UserAvatar profile={profile} />
    </ClientConfigContext.Provider>,
  );
}

describe("UserAvatar", () => {
  it("hides the login entry when login is disabled and the user is signed out", () => {
    const { container } = renderUserAvatar({ loginEnabled: false, profile: null });

    expect(container.childElementCount).toBe(0);
  });

  it("shows the avatar menu when login is disabled but the user is signed in", () => {
    const { container } = renderUserAvatar({
      loginEnabled: false,
      profile: {
        id: 1,
        avatar: "",
        permission: true,
        name: "admin",
      },
    });

    expect(within(container).getByRole("button", { name: "profile.title" }).isConnected).toBe(true);
  });

  it("renders AppearancePopover trigger and a single ThemeToggle button inside HeaderActions", () => {
    const config = new ConfigWrapper({ "login.enabled": false }, defaultClientConfig);
    const { container } = render(
      <ClientConfigContext.Provider value={config}>
        <HeaderActions profile={null} plain />
      </ClientConfigContext.Provider>,
    );

    expect(within(container).getByRole("button", { name: "外观设置" }).isConnected).toBe(true);
    expect(within(container).getAllByRole("button", { name: "切换日夜模式" })).toHaveLength(1);
  });

  it("exposes AI 助手 link in admin UserAvatar popup menu", () => {
    const { container } = renderUserAvatar({
      loginEnabled: true,
      profile: {
        id: 1,
        avatar: "",
        permission: true,
        name: "admin",
      },
    });

    const avatarTrigger = within(container).getByRole("button", { name: "profile.title" });
    fireEvent.click(avatarTrigger);

    const aiBtn = within(container).getByRole("button", { name: /AI 助手/ });
    expect(aiBtn.isConnected).toBe(true);
    fireEvent.click(aiBtn);
    expect(setLocationMock).toHaveBeenCalledWith("/admin/ai");
  });
});
