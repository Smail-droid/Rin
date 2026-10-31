/**
 * Asynchronously renders Mermaid diagram elements on demand.
 * Mermaid and its heavy dependencies (d3, cytoscape, dagre, etc.) are only loaded
 * when .mermaid_default or .mermaid_dark elements actually exist in DOM.
 */
let mermaidModulePromise: Promise<typeof import("mermaid")> | null = null;

function loadMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import("mermaid");
  }
  return mermaidModulePromise;
}

export async function renderMermaidElements(container?: ParentNode): Promise<void> {
  const root = container || document;
  const defaultNodes = root.querySelectorAll<HTMLElement>("pre.mermaid_default");
  const darkNodes = root.querySelectorAll<HTMLElement>("pre.mermaid_dark");

  if (defaultNodes.length === 0 && darkNodes.length === 0) {
    return;
  }

  try {
    const { default: mermaid } = await loadMermaid();

    if (defaultNodes.length > 0) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
      });
      await mermaid.run({
        suppressErrors: true,
        nodes: defaultNodes,
      });
    }

    if (darkNodes.length > 0) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
      });
      await mermaid.run({
        suppressErrors: true,
        nodes: darkNodes,
      });
    }
  } catch (err) {
    console.error("Failed to render Mermaid diagrams:", err);
  }
}
