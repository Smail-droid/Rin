import "../../test/setup";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";

let lastHighlighterProps: Record<string, any> | null = null;

mock.module("react-syntax-highlighter", () => ({
  Prism: (props: Record<string, any>) => {
    lastHighlighterProps = props;
    return (
      <pre data-testid="syntax-highlighter" data-language={props.language}>
        {props.children}
      </pre>
    );
  },
}));

mock.module("yet-another-react-lightbox", () => ({
  default: () => null,
}));
mock.module("yet-another-react-lightbox/plugins/counter", () => ({ default: {} }));
mock.module("yet-another-react-lightbox/plugins/download", () => ({ default: {} }));
mock.module("yet-another-react-lightbox/plugins/zoom", () => ({ default: {} }));

const { Markdown } = await import("../markdown");

describe("Markdown readability and syntax highlighting", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.setAttribute("data-color-mode", "light");
    lastHighlighterProps = null;
  });

  it("renders inline code with theme-colored highlight instead of muted gray", () => {
    const { container } = render(
      <Markdown content={"访问 `https://www.lucky666.cn` 下载 `lucky.exe`。"} />
    );

    const inlineCodes = container.querySelectorAll("code");
    expect(inlineCodes.length).toBe(2);
    for (const codeEl of Array.from(inlineCodes)) {
      expect(codeEl.className).toContain("text-theme");
      expect(codeEl.className).toContain("bg-theme/10");
      expect(codeEl.className).not.toContain("bg-[#eff1f3]");
    }
  });

  it("maps cmd, bat, and powershell code fences to Prism-supported languages and updates on colorMode change", () => {
    const { rerender, getByTestId } = render(
      <Markdown content={"```cmd\ncd C:\\lucky\nnssm install Lucky\n```"} />
    );

    const highlighter = getByTestId("syntax-highlighter");
    expect(highlighter.getAttribute("data-language")).toBe("batch");
    const lightStyle = lastHighlighterProps?.style;

    act(() => {
      document.documentElement.setAttribute("data-color-mode", "dark");
      window.dispatchEvent(new Event("colorSchemeChange"));
    });
    expect(lastHighlighterProps?.style).not.toBe(lightStyle);

    rerender(<Markdown content={"```powershell\nGet-Service Lucky\n```"} />);
    expect(getByTestId("syntax-highlighter").getAttribute("data-language")).toBe("powershell");
  });

  it("highlights ordered/unordered list markers, heading leading numbers, and standalone bold step numbers", () => {
    const content = [
      "### 1. 下载与启动",
      "",
      "**2. 开机自启与注册服务**",
      "",
      "1. 第一步操作",
      "2. 第二步操作",
      "",
      "- 无序条目",
    ].join("\n");

    const { container } = render(<Markdown content={content} />);

    const h3 = container.querySelector("h3");
    expect(h3?.textContent).toContain("1.");
    expect(h3?.querySelector(".text-theme")).not.toBeNull();

    const ol = container.querySelector("ol");
    expect(ol?.className).toContain("marker:text-theme");

    const ul = container.querySelector("ul");
    expect(ul?.className).toContain("marker:text-theme");

    const stepStrong = Array.from(container.querySelectorAll("strong")).find((el) =>
      el.textContent?.includes("2. 开机自启与注册服务")
    );
    expect(stepStrong?.querySelector(".font-extrabold")?.textContent).toContain("2.");
    expect(stepStrong?.querySelector(".text-blue-500")).not.toBeNull();
  });

  it("renders readable non-italic theme-tinted blockquotes and rotating decorative dividers", () => {
    const { container } = render(
      <Markdown
        content={[
          "> 这是一段提示引用",
          "",
          "---",
          "",
          "第二段",
          "",
          "---",
          "",
          "第三段",
          "",
          "---",
          "",
          "第四段",
          "",
          "---",
        ].join("\n")}
      />
    );

    const blockquote = container.querySelector("blockquote");
    expect(blockquote?.className).toContain("border-theme");
    expect(blockquote?.className).not.toContain("italic");

    const variants = Array.from(container.querySelectorAll("[data-hr-variant]")).map((el) =>
      el.getAttribute("data-hr-variant")
    );
    expect(variants).toEqual(["sparkle", "dots", "prism", "diamond"]);
  });

  it("highlights Chinese heading numbers and styles details/summary disclosures with theme-colored markers", () => {
    const content = [
      "### 三、核心 ADB 命令原理解析",
      "",
      "<details>",
      "<summary>点击展开：1_扫描设备写IP.bat</summary>",
      "",
      "内部内容",
      "</details>",
    ].join("\n");

    const { container } = render(<Markdown content={content} />);

    const h3 = container.querySelector("h3");
    const boldSpans = Array.from(h3?.querySelectorAll(".font-extrabold") ?? []);
    expect(boldSpans.some((el) => el.textContent?.includes("三、"))).toBe(true);

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.className).not.toContain("border");
    expect(details?.className).not.toContain("rounded-xl");
    expect(details?.className).not.toContain("bg-theme");

    const summary = container.querySelector("summary");
    expect(summary?.className).toContain("marker:text-theme");
  });
});
