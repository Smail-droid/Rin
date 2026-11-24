import "../../test/setup";
import React from "react";

if (typeof globalThis.location === "undefined" && typeof window !== "undefined") {
  (globalThis as any).location = window.location;
}
if (typeof window !== "undefined") {
  (globalThis as any).Event = window.Event;
  (globalThis as any).CustomEvent = window.CustomEvent;
  (globalThis as any).InputEvent = window.InputEvent;
  (globalThis as any).HTMLInputElement = window.HTMLInputElement;
  (globalThis as any).HTMLSelectElement = window.HTMLSelectElement;
  (globalThis as any).HTMLTextAreaElement = window.HTMLTextAreaElement;
  (globalThis as any).HTMLCollection = (window as any).HTMLCollection;
  (globalThis as any).NodeList = (window as any).NodeList;
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

const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
const { afterEach, describe, it, expect, spyOn } = await import("bun:test");
const { Router } = await import("wouter");
const {
  FriendsPage,
  parseFriendCategory,
  formatFriendDesc,
  PRESET_CATEGORIES,
  parseNodeSeekPastedText,
  fetchClientSideNsDetail,
} = await import("../friends");
const { ClientConfigContext, ConfigWrapper, defaultClientConfig } = await import("../../state/config");
const { ProfileContext } = await import("../../state/profile");
const { client } = await import("../../app/runtime");
const { subscribeToast } = await import("../../utils/toast");
const ReactModal = (await import("react-modal")).default as any;
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

describe("Friends page helper functions", () => {
    it("should include all essential categories in PRESET_CATEGORIES", () => {
        expect(PRESET_CATEGORIES).toContain("全部");
        expect(PRESET_CATEGORIES).toContain("友邻博客");
        expect(PRESET_CATEGORIES).toContain("主机算力");
        expect(PRESET_CATEGORIES).toContain("探针测速");
        expect(PRESET_CATEGORIES).toContain("极客工具");
        expect(PRESET_CATEGORIES).toContain("技术社区");
        expect(PRESET_CATEGORIES).toContain("漫游灵感");
    });

    it("should parse category bracket correctly and map legacy categories", () => {
        const { category, cleanDesc } = parseFriendCategory("[VPS/基础设施] 某某云服务器提供商");
        expect(category).toBe("主机算力");
        expect(cleanDesc).toBe("某某云服务器提供商");

        const legacy = parseFriendCategory("[友友们] 我的个人博客");
        expect(legacy.category).toBe("友邻博客");
    });

    it("should fallback to heuristic category when no bracket prefix exists", () => {
        const { category, cleanDesc } = parseFriendCategory("好用的 GitHub 开源工具箱", "https://github.com/my-tool");
        expect(category).toBe("极客工具");
        expect(cleanDesc).toBe("好用的 GitHub 开源工具箱");
    });

    it("should infer VPS category from text and url", () => {
        const { category } = parseFriendCategory("性价比高的主机评测", "https://vpshost.com");
        expect(category).toBe("主机算力");
    });

    it("should infer probe / speedtest category", () => {
        const { category } = parseFriendCategory("哪吒探针服务器监控系统", "https://status.example.com");
        expect(category).toBe("探针测速");
    });

    it("should format friend desc with category prefix", () => {
        const result = formatFriendDesc("极客工具", "在线 JSON 格式化与转换");
        expect(result).toBe("[极客工具] 在线 JSON 格式化与转换");
    });

    it("should omit prefix when category is '全部' or empty", () => {
        const result = formatFriendDesc("全部", "普通描述");
        expect(result).toBe("普通描述");
    });

    it("should preserve full descriptions longer than 40 characters across formatFriendDesc and parseFriendCategory", () => {
        const longDesc =
            "专注于边缘计算、Cloudflare Workers 全栈架构、网络路由测量、独立设计系统与慢生活记录的个人数字花园，欢迎交换友链。";
        expect(longDesc.length).toBeGreaterThan(40);

        const formatted = formatFriendDesc("友邻博客", longDesc, {
            spaceUrl: "https://www.nodeseek.com/space/27361#/general",
            nsData: { name: "夜轻", rank: 6, coin: 11575, days: 640 },
        });
        const parsed = parseFriendCategory(formatted, "https://blog.example.com", "夜轻");

        expect(parsed.category).toBe("友邻博客");
        expect(parsed.cleanDesc).toBe(longDesc);
        expect(parsed.cleanDesc.length).toBe(longDesc.length);
        expect(parsed.nsData?.rank).toBe(6);
    });

    describe("parseNodeSeekPastedText", () => {
        it("should accurately parse multi-line webpage copy without false username", () => {
            const rawWebText = `加入天数
640
等级
6
鸡腿数目
11575
主题帖数
226
评论数目
8191`;

            const parsed = parseNodeSeekPastedText(rawWebText);
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.days).toBe(640);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
            // Must not falsely recognize "加入天数" as member name
            expect(parsed.name).toBeUndefined();
        });

        it("should parse pure API JSON response directly and cleanly", () => {
            const jsonText = `{"success": true, "detail": {"member_id": 27361, "member_name": "夜轻", "isAdmin": 0, "rank": 6, "coin": 11575, "stardust": 723, "bio": "个人签名测试", "created_at": "2025-02-18T06:42:29.000Z", "created_at_str": "639days ago", "nComment": 8191, "nPost": 226}}`;

            const parsed = parseNodeSeekPastedText(jsonText);
            expect(parsed.name).toBe("夜轻");
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
            expect(parsed.days).toBeGreaterThanOrEqual(630);
            expect(parsed.bio).toBe("个人签名测试");
        });

        it("should parse DevTools console output with key-value pairs", () => {
            const devtoolsText = `https://www.nodeseek.com/api/account/getInfo/27361?readme=1
detail
: 
{member_id: 27361, member_name: "夜轻", isAdmin: 0, rank: 6, coin: 11575, stardust: 723, bio: "",…}
bio
: 
""
coin
: 
11575
created_at_str
: 
"639days ago"
member_name
: 
"夜轻"
nComment
: 
8191
nPost
: 
226
rank
: 
6`;

            const parsed = parseNodeSeekPastedText(devtoolsText);
            expect(parsed.name).toBe("夜轻");
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
            expect(parsed.days).toBe(639);
        });

        it("should parse single-line colon-separated text", () => {
            const singleLine = "坛友: 夜轻 等级: 6 鸡腿: 11575 加入天数: 640 主题: 226 评论: 8191";
            const parsed = parseNodeSeekPastedText(singleLine);
            expect(parsed.name).toBe("夜轻");
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.days).toBe(640);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
        });

        it("should safely handle empty or invalid inputs", async () => {
            expect(await fetchClientSideNsDetail("")).toBeNull();
        });
    });
});

describe("FriendsPage layout, PageHeader, and non-truncation", () => {
    const longDescription =
        "这是一段超过四十个字数的完整站点简介内容，用来验证星标友链页面在卡片与表单中不再被强行截断并可以完整展示。";

    const sampleFriend = {
        id: 1,
        uid: 1,
        name: "夜轻的小站",
        url: "https://blog.yeqing.example.com",
        avatar: "https://example.com/avatar.png",
        desc: formatFriendDesc("友邻博客", longDescription, {
            spaceUrl: "https://www.nodeseek.com/space/27361#/general",
            nsData: { name: "夜轻", rank: 6, coin: 11575, days: 640 },
        }),
        accepted: 1,
        health: "ok",
        sort_order: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
    };

    function renderFriendsPage(isAdmin = false) {
        const config = new ConfigWrapper({}, defaultClientConfig);
        return render(
            React.createElement(Router, {
                ssrPath: "/friends",
                children: React.createElement(
                    ProfileContext.Provider,
                    { value: isAdmin ? { id: 1, name: "admin", avatar: "", permission: true } : undefined },
                    React.createElement(
                        ClientConfigContext.Provider,
                        { value: config },
                        React.createElement(FriendsPage),
                    ),
                ),
            }),
        );
    }

    it("renders unified PageHeader inside GALLERY_CONTAINER_CLASS without back link and lifts 40-char truncation", async () => {
        activeSpies.push(
            spyOn(client.friend, "list").mockResolvedValue({
                data: { friend_list: [sampleFriend] },
                error: null,
            } as any),
        );

        const { container, getByText, getByRole, queryByText } = renderFriendsPage(false);

        await waitFor(() => {
            expect(getByText("STARRED GARDEN · 1").isConnected).toBe(true);
        });

        const main = container.querySelector("main");
        expect(main).not.toBeNull();
        expect(main?.className).toContain("max-w-6xl");

        const header = container.querySelector("header[data-page-header-mode]");
        expect(header).not.toBeNull();
        expect(getByRole("heading", { level: 1, name: /星标友链|friends\.starry_title/ }).isConnected).toBe(true);
        expect(queryByText(/返回画廊|back_to_gallery/)).toBeNull();

        // Single-row toolbar with 3-way view toggle labels
        expect(getByRole("button", { name: /横版名片/ }).isConnected).toBe(true);
        expect(getByRole("button", { name: /画廊卡/ }).isConnected).toBe(true);
        expect(getByRole("button", { name: /书签行/ }).isConnected).toBe(true);

        // Full >40-char description is rendered without slicing
        expect(getByText(longDescription).isConnected).toBe(true);
        expect(getByText(/NS #27361/).isConnected).toBe(true);
        expect(getByText(/Lv\.6/).isConnected).toBe(true);

        // Open Add/Apply modal and verify maxLength=40 is gone
        await act(async () => {
            fireEvent.click(getByRole("button", { name: /申请加入星标|friends\.apply_site/ }));
        });
        expect(document.body.textContent).not.toContain("不超过40字");
        expect(document.body.querySelector("[maxlength='40']")).toBeNull();
    });

    it("switches to upgraded gallery vertical card and emits non-blocking toast on admin category move", async () => {
        activeSpies.push(
            spyOn(client.friend, "list").mockResolvedValue({
                data: { friend_list: [sampleFriend] },
                error: null,
            } as any),
            spyOn(client.friend, "update").mockResolvedValue({ data: { success: true }, error: null } as any),
        );

        const receivedToasts: Array<{ message: string; tone: string }> = [];
        const unsubscribe = subscribeToast((payload) => {
            receivedToasts.push({ message: payload.message, tone: payload.tone });
        });

        try {
            const { container, getByRole, getByTitle } = renderFriendsPage(true);

            await waitFor(() => {
                expect(container.querySelector("header[data-page-header-mode]")).not.toBeNull();
            });

            // Switch to gallery vertical card ("画廊卡")
            await act(async () => {
                fireEvent.click(getByRole("button", { name: /画廊卡/ }));
            });

            const banner = container.querySelector("[data-friend-gallery-banner='true']");
            expect(banner).not.toBeNull();
            expect(banner?.className).toContain("from-theme/15");
            expect(banner?.textContent).toContain("blog.yeqing.example.com");

            // Admin quick category move triggers non-blocking success toast
            const catSelect = getByTitle("点击直接切换此友链分类") as HTMLSelectElement;
            await act(async () => {
                fireEvent.change(catSelect, { target: { value: "极客工具" } });
            });

            expect(receivedToasts.some((item) => item.tone === "success")).toBe(true);
        } finally {
            unsubscribe();
        }
    });
});
