import { describe, it, expect } from "bun:test";
import { renderMermaidElements } from "../render-mermaid";

describe("renderMermaidElements", () => {
  it("returns early without errors when no mermaid elements exist", async () => {
    const mockContainer = {
      querySelectorAll: () => [] as unknown as NodeListOf<HTMLElement>,
    } as unknown as ParentNode;

    await expect(renderMermaidElements(mockContainer)).resolves.toBeUndefined();
  });
});
