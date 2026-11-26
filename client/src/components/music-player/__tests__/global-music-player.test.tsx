import "../../../test/setup";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { GlobalMusicPlayer } from "../global-music-player";

const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  },
};
(globalThis as any).localStorage = mockLocalStorage;

if (typeof window !== "undefined" && !(window as any).PointerEvent) {
  (window as any).PointerEvent = class PointerEvent extends (window as any).MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, params: any = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 1;
      this.pointerType = params.pointerType || "mouse";
    }
  };
}

mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key,
    i18n: { changeLanguage: mock() },
  }),
}));

mock.module("wouter", () => ({
  useLocation: () => ["/", mock()],
}));

const mockMusicContext = {
  currentTrack: {
    id: "test-1",
    name: "测试曲目",
    artist: "测试歌手",
    url: "https://example.com/audio.mp3",
    pic: "https://example.com/pic.jpg",
  },
  playlist: [{ id: "test-1", name: "测试曲目", artist: "测试歌手", url: "https://example.com/audio.mp3" }],
  isPlaying: false,
  currentTime: 10,
  duration: 180,
  playMode: "loop" as const,
  volume: 0.8,
  isMuted: false,
  currentLyricText: "",
  loadError: null,
  togglePlay: mock(),
  next: mock(),
  prev: mock(),
  seek: mock(),
  setVolume: mock(),
  toggleMute: mock(),
  setPlayMode: mock(),
  play: mock(),
  removeTrack: mock(),
  addTrack: mock(),
  playTemporaryTrack: mock(),
  setPlaylist: mock(),
  clearPlaylist: mock(),
};

mock.module("../music-player-context", () => ({
  useMusicPlayer: () => mockMusicContext,
}));

mock.module("../../hooks/useSiteConfig", () => ({
  useSiteConfig: () => ({
    musicEnabled: true,
  }),
}));

describe("GlobalMusicPlayer 移动端触控交互与防穿透", () => {
  beforeEach(() => {
    try {
      window.localStorage?.clear();
    } catch {}
    mockLocalStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("折叠状态下轻触音符（无位移）应立即展开", () => {
    const { getByRole } = render(<GlobalMusicPlayer />);

    const noteBtn = getByRole("button", { name: "展开音乐播放器" });
    expect(noteBtn).toBeDefined();

    // 模拟移动端轻点 (Tap: pointerdown -> pointerup 无位移)
    fireEvent.pointerDown(noteBtn, { clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerUp(noteBtn, { clientX: 100, clientY: 100, pointerType: "touch" });

    // 应该立即展开为卡片（出现收起按钮）
    const collapseBtn = getByRole("button", { name: "收起为微光音符图标" });
    expect(collapseBtn).toBeDefined();
    expect(localStorage.getItem("rin_music_expanded")).toBe("true");
  });

  it("展开后遭遇历史延迟穿透的 Ghost Click 时，不应被误收起", () => {
    const { getByRole } = render(<GlobalMusicPlayer />);

    const noteBtn = getByRole("button", { name: "展开音乐播放器" });

    // 1. 移动端 tap 展开
    fireEvent.pointerDown(noteBtn, { clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerUp(noteBtn, { clientX: 100, clientY: 100, pointerType: "touch" });

    // 此时播放器已展开
    const collapseBtn = getByRole("button", { name: "收起为微光音符图标" });
    expect(collapseBtn).toBeDefined();

    // 2. 模拟移动端浏览器延迟合成派发的 Ghost Click（没有经历过对 collapseBtn 的真实 pointerdown）
    fireEvent.click(collapseBtn, { detail: 1 });

    // 播放器必须依然保持展开状态，不被历史穿透事件摧毁！
    expect(getByRole("button", { name: "收起为微光音符图标" })).toBeDefined();
    expect(localStorage.getItem("rin_music_expanded")).toBe("true");
  });

  it("用户在收起按钮上执行完整交互（pointerdown + click）时，应正常收起", async () => {
    const { getByRole } = render(<GlobalMusicPlayer />);

    // 展开播放器
    const noteBtn = getByRole("button", { name: "展开音乐播放器" });
    fireEvent.pointerDown(noteBtn, { clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerUp(noteBtn, { clientX: 100, clientY: 100, pointerType: "touch" });

    const collapseBtn = getByRole("button", { name: "收起为微光音符图标" });

    // 模拟等待 450ms（超过常规防御窗口）后用户主动点击收起
    await new Promise((resolve) => setTimeout(resolve, 450));

    // 用户有意识地按下收起按钮 (pointerdown 武装因果锁)
    fireEvent.pointerDown(collapseBtn, { clientX: 100, clientY: 100 });
    // 随后手指抬起并派发 click
    fireEvent.click(collapseBtn);

    // 播放器应成功收起为音符
    expect(getByRole("button", { name: "展开音乐播放器" })).toBeDefined();
    expect(localStorage.getItem("rin_music_expanded")).toBe("false");
  });

  it("手指按住并移动超过阈值（拖拽）时，松开不应触发展开", () => {
    // 为 JSDOM 补齐 setPointerCapture / releasePointerCapture
    if (typeof window !== "undefined" && window.HTMLElement) {
      if (!window.HTMLElement.prototype.setPointerCapture) {
        window.HTMLElement.prototype.setPointerCapture = () => {};
      }
      if (!window.HTMLElement.prototype.releasePointerCapture) {
        window.HTMLElement.prototype.releasePointerCapture = () => {};
      }
    }

    const { getByRole, queryByRole } = render(<GlobalMusicPlayer />);

    const noteBtn = getByRole("button", { name: "展开音乐播放器" });

    const firePointer = (type: string, clientX: number, clientY: number) => {
      const event = new (window as any).PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        pointerType: "touch",
      });
      Object.defineProperty(event, "clientX", { value: clientX });
      Object.defineProperty(event, "clientY", { value: clientY });
      Object.defineProperty(event, "pointerType", { value: "touch" });
      fireEvent(noteBtn, event);
    };

    // 模拟拖拽：pointerdown -> 移动 30px -> pointerup
    firePointer("pointerdown", 100, 100);
    firePointer("pointermove", 130, 130);
    firePointer("pointerup", 130, 130);

    // 仍保持折叠状态，绝不触发展开
    expect(getByRole("button", { name: "展开音乐播放器" })).toBeDefined();
    expect(queryByRole("button", { name: "收起为微光音符图标" })).toBeNull();
  });

  it("PC 端鼠标未点击仅悬停或移动经过折叠播放器时，绝不跟随鼠标移动或进入拖拽态", () => {
    const { getByRole, container } = render(<GlobalMusicPlayer />);
    const noteBtn = getByRole("button", { name: "展开音乐播放器" });
    const wrapper = container.firstElementChild as HTMLElement;
    const initialTransform = wrapper.style.transform;

    const fireMousePointer = (type: string, clientX: number, clientY: number, opts: { button?: number; buttons?: number } = {}) => {
      const event = new (window as any).PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        pointerType: "mouse",
        pointerId: 1,
        button: opts.button ?? 0,
        buttons: opts.buttons ?? 0,
      });
      Object.defineProperty(event, "clientX", { value: clientX });
      Object.defineProperty(event, "clientY", { value: clientY });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      Object.defineProperty(event, "pointerId", { value: 1 });
      Object.defineProperty(event, "button", { value: opts.button ?? 0 });
      Object.defineProperty(event, "buttons", { value: opts.buttons ?? 0 });
      fireEvent(noteBtn, event);
    };

    // 未按下鼠标直接滑过音符按钮
    fireMousePointer("pointerover", 320, 480);
    fireMousePointer("pointermove", 360, 520);
    fireMousePointer("pointermove", 500, 300);

    expect(wrapper.style.transform).toBe(initialTransform);
    expect(wrapper.className).not.toContain("cursor-grabbing");
    expect(noteBtn.className).not.toContain("scale-110");
    expect(localStorage.getItem("rin_music_player_pos")).toBeNull();

    // 右键按下后移动也不应触发拖拽
    fireMousePointer("pointerdown", 320, 480, { button: 2, buttons: 2 });
    fireMousePointer("pointermove", 480, 480, { button: 2, buttons: 2 });
    expect(wrapper.style.transform).toBe(initialTransform);
    expect(wrapper.className).not.toContain("cursor-grabbing");
  });

  it("PC 端鼠标左键按住拖拽后松开，位置更新且后续悬停移动不再跟随", () => {
    const { getByRole, container, queryByRole } = render(<GlobalMusicPlayer />);
    const noteBtn = getByRole("button", { name: "展开音乐播放器" });
    const wrapper = container.firstElementChild as HTMLElement;

    const fireMousePointer = (type: string, clientX: number, clientY: number, buttons = 1) => {
      const event = new (window as any).PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        pointerType: "mouse",
        pointerId: 7,
        button: 0,
        buttons,
      });
      Object.defineProperty(event, "clientX", { value: clientX });
      Object.defineProperty(event, "clientY", { value: clientY });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      Object.defineProperty(event, "pointerId", { value: 7 });
      Object.defineProperty(event, "button", { value: 0 });
      Object.defineProperty(event, "buttons", { value: buttons });
      fireEvent(noteBtn, event);
    };

    // 按住左键拖拽 60px 并松开
    fireMousePointer("pointerdown", 100, 100, 1);
    fireMousePointer("pointermove", 160, 140, 1);
    expect(wrapper.className).toContain("cursor-grabbing");
    fireMousePointer("pointerup", 160, 140, 0);

    const settledTransform = wrapper.style.transform;
    expect(settledTransform).not.toBe("translate3d(20px, 692px, 0)");
    expect(wrapper.className).not.toContain("cursor-grabbing");
    expect(queryByRole("button", { name: "收起为微光音符图标" })).toBeNull();

    // 松开后继续移动鼠标，播放器位置必须保持静止
    fireMousePointer("pointermove", 420, 220, 0);
    expect(wrapper.style.transform).toBe(settledTransform);
  });
});
