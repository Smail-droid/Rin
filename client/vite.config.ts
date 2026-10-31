import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const serverPort = Number(process.env.RIN_SERVER_PORT || "11499");
  const serverTarget = `http://127.0.0.1:${serverPort}`;
  const cacheDir = process.env.RIN_VITE_CACHE_DIR || "../.vite/client";
  
  return {
    cacheDir,
    // Note: Client configuration is fetched from server at runtime
    // No environment variables are injected at build time
    build: {
      outDir: '../dist/client',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) {
              return;
            }

            // 1. Monaco Editor (独立分包，仅写作页/后台按需拉取)
            if (normalizedId.includes('monaco-editor') || normalizedId.includes('@monaco-editor')) {
              return 'vendor-monaco';
            }

            // 2. Mermaid & Cytoscape (图表独立大包，仅在有 mermaid 图表时按需拉取)
            if (
              normalizedId.includes('/mermaid/') ||
              normalizedId.includes('/cytoscape/') ||
              normalizedId.includes('/cytoscape-cose-bilkent/') ||
              normalizedId.includes('/dagre-d3-es/') ||
              normalizedId.includes('/elkjs/')
            ) {
              return 'vendor-mermaid';
            }

            // 3. KaTeX 数学公式解析与渲染引擎
            if (normalizedId.includes('/katex/')) {
              return 'vendor-katex';
            }

            // 4. 代码高亮库生态
            if (
              normalizedId.includes('/react-syntax-highlighter/') ||
              normalizedId.includes('/refractor/') ||
              normalizedId.includes('/prismjs/')
            ) {
              return 'vendor-highlighter';
            }

            // 5. 画廊灯箱组件
            if (normalizedId.includes('/yet-another-react-lightbox/')) {
              return 'vendor-lightbox';
            }

            // 6. Markdown 抽象语法树与解析渲染管线
            if (
              normalizedId.includes('/react-markdown/') ||
              normalizedId.includes('/remark-') ||
              normalizedId.includes('/rehype-') ||
              normalizedId.includes('/micromark') ||
              normalizedId.includes('/mdast') ||
              normalizedId.includes('/hast') ||
              normalizedId.includes('/unist')
            ) {
              return 'vendor-markdown';
            }

            // 7. React 基础运行时与核心交互生态
            if (
              normalizedId.includes('/react/') ||
              normalizedId.includes('/react-dom/') ||
              normalizedId.includes('/wouter/') ||
              normalizedId.includes('/react-helmet/') ||
              normalizedId.includes('/react-i18next/') ||
              normalizedId.includes('/i18next/') ||
              normalizedId.includes('/@radix-ui/') ||
              normalizedId.includes('/react-modal/') ||
              normalizedId.includes('/reactjs-popup/') ||
              normalizedId.includes('/remixicon/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    plugins: [
      react(),
      // Output visualizer stats file
      visualizer({
        filename: '../dist/client/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: !isDev && process.env.RIN_ANALYZE === 'true'
      })
    ],
    server: {
      proxy: {
        "/api": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/rss.xml": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/atom.xml": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/rss.json": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/feed.json": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/feed.xml": {
          target: serverTarget,
          changeOrigin: false,
        },
      },
    },
  }
})
