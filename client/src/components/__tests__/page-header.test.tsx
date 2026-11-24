import "../../test/setup";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { GALLERY_CONTAINER_CLASS, PageHeader } from "../page-header";
import { ToastViewport } from "../toast-viewport";
import { emitToast, subscribeToast } from "../../utils/toast";

afterEach(() => {
  cleanup();
});

describe("PageHeader", () => {
  it("exports unified GALLERY_CONTAINER_CLASS aligned to max-w-6xl", () => {
    expect(GALLERY_CONTAINER_CLASS).toContain("max-w-6xl");
    expect(GALLERY_CONTAINER_CLASS).toContain("mx-auto");
  });

  it("renders eyebrow, h1 title, subtitle, and right-aligned actions in default clean mode", () => {
    const { getByRole, getByText } = render(
      <PageHeader
        eyebrow="GALLERY ESSAYS · 22"
        title="画廊随想"
        subtitle="记录生活闪光与技术沉淀"
        actions={<button type="button">切换版式</button>}
      />,
    );

    const eyebrow = getByText("GALLERY ESSAYS · 22");
    expect(eyebrow.className).toContain("uppercase");
    expect(eyebrow.className).toContain("tracking-[0.2em]");

    const heading = getByRole("heading", { level: 1, name: "画廊随想" });
    expect(heading.isConnected).toBe(true);
    expect(heading.className).toContain("text-2xl");

    expect(getByText("记录生活闪光与技术沉淀").isConnected).toBe(true);
    expect(getByRole("button", { name: "切换版式" }).isConnected).toBe(true);
  });

  it("applies orthogonal titleFont and titleEffect attributes and classes", () => {
    const { getByRole } = render(
      <PageHeader
        title="时光长河"
        titleFont="kai"
        titleEffect="editorial_rule"
      />,
    );

    const heading = getByRole("heading", { level: 1, name: "时光长河" });
    expect(heading.getAttribute("data-title-font")).toBe("kai");
    expect(heading.getAttribute("data-title-effect")).toBe("editorial_rule");
    expect(heading.className).toContain("rin-title-font-kai");
    expect(heading.className).toContain("rin-title-effect-editorial_rule");
  });

  it("renders banner mode with soft surface wash and optional avatar", () => {
    const { container, getByRole } = render(
      <PageHeader
        mode="banner"
        eyebrow="CHRONICLE"
        title="时光长河"
        subtitle="岁序常易"
        avatar="https://example.com/avatar.png"
        actions={<span>筛选</span>}
      />,
    );

    const header = container.querySelector("[data-page-header-mode='banner']") as HTMLElement;
    expect(header).not.toBeNull();
    expect(getByRole("heading", { level: 1, name: "时光长河" }).isConnected).toBe(true);
    expect(header.querySelector("img")).not.toBeNull();
  });

  it("renders only actions in hidden mode and returns null when no actions are given", () => {
    const { container, queryByRole, getByRole, rerender } = render(
      <PageHeader
        mode="hidden"
        eyebrow="HIDDEN"
        title="隐藏标题"
        subtitle="隐藏副标题"
        actions={<button type="button">仅保留动作</button>}
      />,
    );

    expect(queryByRole("heading", { level: 1 })).toBeNull();
    expect(getByRole("button", { name: "仅保留动作" }).isConnected).toBe(true);

    rerender(<PageHeader mode="hidden" title="隐藏标题" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ToastViewport & emitToast", () => {
  it("renders non-blocking portal toasts into document.body and auto-dismisses", async () => {
    render(<ToastViewport />);

    act(() => {
      emitToast("已保存主题设置", "success", 60);
    });

    const toastNode = document.body.querySelector("[data-toast-tone='success']");
    expect(toastNode).not.toBeNull();
    expect(toastNode?.textContent).toContain("已保存主题设置");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 90));
    });

    expect(document.body.querySelector("[data-toast-tone='success']")).toBeNull();
  });

  it("ignores blank toast messages and cleanly unsubscribes listeners", () => {
    const received: string[] = [];
    const unsubscribe = subscribeToast((payload) => {
      received.push(payload.message);
    });

    expect(emitToast("   ", "info")).toBeNull();
    emitToast("第一条通知", "info");
    unsubscribe();
    emitToast("已退订通知", "error");

    expect(received).toEqual(["第一条通知"]);
  });
});
