import "../../test/setup";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";

if (typeof globalThis.document !== "undefined") {
  if (typeof (globalThis.document as any).queryCommandSupported !== "function") {
    (globalThis.document as any).queryCommandSupported = () => true;
  }
  if (typeof (globalThis.document as any).execCommand !== "function") {
    (globalThis.document as any).execCommand = () => true;
  }
}

mock.module("monaco-editor", () => ({
  Range: class Range {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number
    ) {}
  },
  Selection: class Selection {
    constructor(
      public selectionStartLineNumber: number,
      public selectionStartColumn: number,
      public positionLineNumber: number,
      public positionColumn: number
    ) {}
  },
}));

let lastEditorProps: Record<string, any> | null = null;
const mockLayout = mock(() => {});

mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { changeLanguage: mock() },
  }),
}));

mock.module("react-modal", () => ({
  default: ({ isOpen, children }: { isOpen?: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

mock.module("@monaco-editor/react", () => ({
  default: (props: Record<string, any>) => {
    lastEditorProps = props;
    if (typeof props.onMount === "function") {
      props.onMount({
        onDidCompositionStart: mock(),
        onDidCompositionEnd: mock(),
        onDidChangeModelContent: mock(),
        onDidBlurEditorText: mock(),
        onDidScrollChange: mock(),
        getModel: () => ({ getValue: () => props.defaultValue ?? "" }),
        getValue: () => props.defaultValue ?? "",
        setValue: mock(),
        layout: mockLayout,
      });
    }
    return <div data-testid="monaco-mock" data-height={props.height} />;
  },
}));

mock.module("../markdown", () => ({
  Markdown: ({ content }: { content: string }) => <div data-testid="markdown-preview">{content}</div>,
}));

const { MarkdownEditor } = await import("../markdown_editor");

describe("MarkdownEditor fill-height & layout chain", () => {
  afterEach(() => {
    cleanup();
    lastEditorProps = null;
    mockLayout.mockClear();
  });

  it("maintains an unbroken flex/grid height chain and automaticLayout in 100% fill mode", async () => {
    const { container, getByText } = render(
      <div style={{ height: "720px" }}>
        <MarkdownEditor
          content={"```bash\nuname -r\n```"}
          setContent={() => {}}
          height="100%"
          defaultPreview="edit"
        />
      </div>
    );

    const root = container.querySelector("[data-markdown-editor-root]") as HTMLElement;
    const panes = container.querySelector("[data-markdown-editor-panes]") as HTMLElement;
    const codePane = container.querySelector("[data-markdown-editor-code-pane]") as HTMLElement;
    const monacoHost = container.querySelector("[data-markdown-editor-monaco-host]") as HTMLElement;
    const previewPane = container.querySelector("[data-markdown-editor-preview-pane]") as HTMLElement;

    expect(root.className).toContain("h-full");
    expect(root.className).toContain("min-h-0");
    expect(panes.className).toContain("flex-1");
    expect(panes.className).toContain("min-h-0");
    expect(codePane.className).toContain("h-full");
    expect(codePane.className).toContain("min-h-0");
    expect(monacoHost.className).toContain("flex-1");
    expect(monacoHost.firstElementChild?.className).toContain("absolute");
    expect(monacoHost.firstElementChild?.className).toContain("inset-0");
    expect(previewPane.className).toContain("h-full");
    expect(previewPane.style.height).toBe("");
    expect(lastEditorProps?.height).toBe("100%");
    expect(lastEditorProps?.options?.automaticLayout).toBe(true);

    // 切换到「对比」分栏视图后，应开启双列/双行布局并主动触发布局重算
    fireEvent.click(getByText("comparison"));

    expect(panes.className).toContain("lg:grid-cols-2");
    expect(panes.className).toContain("grid-rows-2");
    await waitFor(() => {
      expect(mockLayout).toHaveBeenCalled();
    });
  });

  it("preserves explicit height behavior for standalone writing page", () => {
    const { container } = render(
      <MarkdownEditor
        content="hello"
        setContent={() => {}}
        height="calc(100vh - 240px)"
        defaultPreview="comparison"
      />
    );

    const root = container.querySelector("[data-markdown-editor-root]") as HTMLElement;
    const previewPane = container.querySelector("[data-markdown-editor-preview-pane]") as HTMLElement;

    expect(root.className).not.toContain("h-full");
    expect(previewPane.style.height).toBe("calc(100vh - 240px)");
    expect(lastEditorProps?.height).toBe("calc(100vh - 240px)");
    expect(lastEditorProps?.options?.automaticLayout).toBe(true);
  });
});
