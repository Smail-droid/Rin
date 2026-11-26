import React, { cloneElement, isValidElement, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  oneDark,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import gfm from "remark-gfm";
import remarkMermaid from "../remark/remarkMermaid";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkBreaks from "remark-breaks";
import Lightbox, { SlideImage } from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Download from "yet-another-react-lightbox/plugins/download";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { drawBlurhashToCanvas } from "../utils/blurhash";
import { useColorMode } from "../utils/darkModeUtils";
import { parseImageUrlMetadata } from "../utils/image-upload";
import { useImageLoadState } from "../utils/use-image-load-state";
import { safeHttpUrl } from "../utils/url";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "iframe",
    "section",
    "math",
    "annotation",
    "semantics",
    "mtext",
    "mn",
    "mo",
    "mi",
    "mspace",
    "mover",
    "munder",
    "munderover",
    "msup",
    "msub",
    "msubsup",
    "mfrac",
    "mroot",
    "msqrt",
    "mtable",
    "mtr",
    "mtd",
    "mlabeledtr",
    "mrow",
    "menclose",
    "mstyle",
    "mpadded",
    "mphantom",
    "mglyph",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] || []),
      "className",
      "style",
      "dataFootnotes",
      "data-footnotes",
    ],
    iframe: [
      "src",
      "title",
      "width",
      "height",
      "allow",
      "allowFullScreen",
      "frameBorder",
      "scrolling",
      "loading",
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https"],
  },
};


const countNewlinesBeforeNode = (text: string, offset: number) => {
  let newlinesBefore = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (text[i] === "\n") {
      newlinesBefore++;
    } else {
      break;
    }
  }
  return newlinesBefore;
};

const isMarkdownImageLinkAtEnd = (text: string) => {
  const trimmed = text.trim();

  const match = trimmed.match(/(.*)(!\\[.*?\\]\\(.*?\\))$/s);

  if (match) {
    const [, beforeImage, _] = match;

    return beforeImage.trim().length === 0 || beforeImage.endsWith("\n");
  }

  return false;
};

function MarkdownImage({
  src,
  alt,
  show,
  rounded,
  scale,
  className,
}: {
  src?: string;
  alt?: string;
  show: (src?: string) => void;
  rounded: boolean;
  scale: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(src);
  const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(cleanSrc);
  const roundedClass = rounded ? "rounded-xl" : "";
  const aspectRatio = width && height ? `${width} / ${height}` : undefined;

  useEffect(() => {
    if (!blurhash || !canvasRef.current) {
      return;
    }
    try {
      drawBlurhashToCanvas(canvasRef.current, blurhash);
    } catch (error) {
      console.error("Failed to render blurhash", error);
    }
  }, [blurhash]);

  return (
    <span
      className={`relative inline-block max-w-full overflow-hidden ${roundedClass}`}
      style={{ zoom: scale, aspectRatio }}
    >
      {blurhash && !loaded ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full scale-110 blur-sm ${roundedClass}`}
        />
      ) : null}
      {failed && !blurhash ? (
        <span
          aria-label={alt || undefined}
          role={alt ? "img" : undefined}
          className={`${rounded ? "flex min-h-32 min-w-48" : "inline-flex h-8 w-8"} items-center justify-center bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 ${roundedClass}`}
        >
          <i className="ri-image-line" aria-hidden="true" />
        </span>
      ) : null}
      <img
        ref={imageRef}
        src={cleanSrc}
        alt={alt}
        width={width}
        height={height}
        onClick={() => {
          show(cleanSrc);
        }}
        onLoad={onLoad}
        onError={onError}
        className={`mx-auto max-w-full h-auto cursor-zoom-in transition-opacity ${roundedClass} ${className || ""} ${
          failed ? "hidden" : blurhash && !loaded ? "opacity-0" : "opacity-100"
        }`}
      />
    </span>
  );
}

function normalizeLanguage(lang: string): string {
  const l = (lang || "").trim().toLowerCase();
  const aliasMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    py: "python",
    python3: "python",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    bash: "bash",
    env: "bash",
    dotenv: "bash",
    cmd: "batch",
    bat: "batch",
    batch: "batch",
    dos: "batch",
    ps1: "powershell",
    pwsh: "powershell",
    powershell: "powershell",
    yml: "yaml",
    yaml: "yaml",
    rs: "rust",
    rust: "rust",
    go: "go",
    golang: "go",
    c: "c",
    cpp: "cpp",
    "c++": "cpp",
    cxx: "cpp",
    cs: "csharp",
    csharp: "csharp",
    java: "java",
    kt: "kotlin",
    kotlin: "kotlin",
    sql: "sql",
    mysql: "sql",
    pgsql: "sql",
    postgres: "sql",
    html: "html",
    xml: "xml",
    svg: "xml",
    vue: "markup",
    svelte: "markup",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    docker: "dockerfile",
    dockerfile: "dockerfile",
    nginx: "nginx",
    conf: "nginx",
    lua: "lua",
    toml: "toml",
    ini: "ini",
    diff: "diff",
    patch: "diff",
    make: "makefile",
    makefile: "makefile",
    graphql: "graphql",
  };
  return aliasMap[l] || l || "text";
}

const STEP_NUMBER_COLORS = [
  "text-theme",
  "text-blue-500 dark:text-blue-400",
  "text-emerald-500 dark:text-emerald-400",
  "text-amber-500 dark:text-amber-400",
  "text-violet-500 dark:text-violet-400",
  "text-rose-500 dark:text-rose-400",
] as const;

const CHINESE_NUMERAL_INDEX: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function getLeadingNumberColorClass(token: string): string {
  const digits = token.match(/\d+/);
  if (digits) {
    const n = parseInt(digits[0], 10);
    return STEP_NUMBER_COLORS[(Math.max(n, 1) - 1) % STEP_NUMBER_COLORS.length];
  }
  for (const [ch, idx] of Object.entries(CHINESE_NUMERAL_INDEX)) {
    if (token.includes(ch)) {
      return STEP_NUMBER_COLORS[(idx - 1) % STEP_NUMBER_COLORS.length];
    }
  }
  return STEP_NUMBER_COLORS[0];
}

function highlightLeadingNumber(children: React.ReactNode): React.ReactNode {
  const nodes = React.Children.toArray(children);
  if (nodes.length === 0) return children;
  const first = nodes[0];
  if (typeof first !== "string") return children;
  // 支持 "1. "、"1、"、"一、"、"（一）" 等常见中文/数字步骤编号前缀
  const match = first.match(/^((?:\d+[.、])|(?:[一二三四五六七八九十百]+[、.])|(?:[（(](?:\d+|[一二三四五六七八九十]+)[）)]))(\s*.*)?$/s);
  if (!match) return children;
  const [, num, rest = ""] = match;
  const colorClass = getLeadingNumberColorClass(num);
  return [
    <span key="leading-num" className={`${colorClass} font-extrabold`}>
      {num}
    </span>,
    rest,
    ...nodes.slice(1),
  ];
}

function MarkdownCodeBlock({
  rawLanguage,
  language,
  rawCode,
  linesCount,
  colorMode,
  codeBlockStyle,
}: {
  rawLanguage: string;
  language: string;
  rawCode: string;
  linesCount: number;
  colorMode: "light" | "dark";
  codeBlockStyle: React.CSSProperties;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="relative group my-4 rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden shadow-xs bg-[#fafafa] dark:bg-[#1e1e24] transition-all">
      {/* Mac Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-black/5 dark:border-white/5 bg-black/[0.03] dark:bg-white/[0.03] select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400 inline-block shadow-2xs" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block shadow-2xs" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block shadow-2xs" />
          </div>
          {rawLanguage && (
            <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-theme/10 text-theme border border-theme/20">
              {rawLanguage}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(rawCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-black/5 dark:hover:bg-white/10 dark:text-neutral-400 dark:hover:text-white transition"
          title="一键复制完整代码"
        >
          {copied ? (
            <>
              <i className="ri-check-line text-emerald-500" />
              <span className="text-emerald-500 font-bold">已复制!</span>
            </>
          ) : (
            <>
              <i className="ri-file-copy-line" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <div className="p-1 overflow-x-auto">
        <SyntaxHighlighter
          PreTag="div"
          className="!bg-transparent !p-3.5 !m-0 !text-[13px] leading-relaxed"
          language={language}
          style={colorMode === "dark" ? oneDark : oneLight}
          showLineNumbers={linesCount > 3}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: colorMode === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)",
            fontSize: "12px",
            userSelect: "none",
          }}
          wrapLongLines={false}
          codeTagProps={{ style: codeBlockStyle }}
        >
          {rawCode}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function cleanCodeBlockContent(code: string): string {
  // 1. 全域无死角清洗代码块内部的 Markdown 链接语法：
  // 无论是在 Shell 命令行中（如 curl -fsSL [https://...](https://...)），
  // 还是在注释行（如 # [说明](http://...)），或是配置文件中，
  // 统统剥离方括号与圆括号，确保用户复制到终端时 100% 为可执行的纯文本裸字符串！
  const lines = code.split("\n");
  const processedLines = lines.map((line) => {
    return line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      // 若 [text](url) 相同，直接返回纯裸链（如 https://get.docker.com）
      if (text === url) return url;
      // 若为命令行中误写入的 [说明](http://url)，提取出真正的可执行链接 url
      if (url.startsWith("http://") || url.startsWith("https://")) {
        // 如果是在注释行中，保留纯文字形式 "说明: url"
        const trimmed = line.trimStart();
        if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("--") || trimmed.startsWith(";")) {
          return `${text}: ${url}`;
        }
        return url;
      }
      return text;
    });
  });

  let result = processedLines.join("\n");
  // 2. 修复意外被换行拆分的 TOML 标签 [vars]：如 [\n vars \n] 自动复原为 [vars]
  result = result.replace(/\[\s*\n+\s*([a-zA-Z0-9_\-\.]+)\s*\n+\s*\]/g, "[$1]");
  return result;
}

// 修复 Markdown 表格前后空行规范（确保与普通段落无缝分离，同时严禁破坏表格内部行间距，保护代码块中的管道符）
function fixTableBlockSpacing(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  const isTableLine = (l: string, insideCode: boolean) => {
    if (insideCode) return false;
    const trimmed = l.trim();
    if (!trimmed) return false;
    return trimmed.includes("|") && (trimmed.startsWith("|") || trimmed.endsWith("|") || /^[^\n|]+\|[^\n|]+/.test(trimmed));
  };

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (cur.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      result.push(cur);
      continue;
    }

    if (inCodeBlock) {
      result.push(cur);
      continue;
    }

    const prev = lines[i - 1];
    const next = lines[i + 1];

    // 如果当前行是表格首行，且上一行非空且不是表格行，在表格前补空行以触发 GFM 块级解析
    if (isTableLine(cur, inCodeBlock) && prev !== undefined && prev.trim() !== "" && !isTableLine(prev, false)) {
      result.push("");
    }

    result.push(cur);

    // 如果当前行是表格末行，且下一行非空且不是表格行，在表格后补空行
    if (isTableLine(cur, inCodeBlock) && next !== undefined && next.trim() !== "" && !isTableLine(next, false)) {
      result.push("");
    }
  }

  return result.join("\n");
}

// 预处理清洗全篇 Markdown 文本（修复表格块间距、LaTeX 公式转纯文本符号等顽疾）
function preprocessMarkdownContent(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. 规范化表格块与前后段落的空行，杜绝把表格中间行误切断
  text = fixTableBlockSpacing(text);

  // 2. 清洗历史旧文章中残留的 LaTeX 数学公式语法，自动还原为纯净易懂的文本：
  // 例: $\le 65536$ -> ≤ 65536, $\ge 131072$ -> ≥ 131072
  text = text.replace(/\$\\le\s*([0-9.]+)\$/g, "≤ $1");
  text = text.replace(/\$\\ge\s*([0-9.]+)\$/g, "≥ $1");
  text = text.replace(/\$<\s*([0-9.]+)\$/g, "< $1");
  text = text.replace(/\$>\s*([0-9.]+)\$/g, "> $1");
  text = text.replace(/\$=\s*([0-9.]+)\$/g, "= $1");
  text = text.replace(/\$([0-9.]+)\s*\\sim\s*([0-9.]+)\$/g, "$1 ~ $2");
  text = text.replace(/\$([0-9.]+)\s*\\times\s*([0-9.]+)(?:\\text\{\s*([A-Za-z]+)\s*\})?\s*\\approx\s*(?:\\mathbf\{)?([0-9.]+)(?:\\text\{\s*([A-Za-z]+)\s*\})?\}?\$/g, "$1 × $2$3 ≈ $4 $5");
  // 消除遗留的普通 $...$ 包裹但内部只是简单不等式/公式的字符
  text = text.replace(/\$([^\$\n]+)\$/g, (_match, inner) => {
    let cleaned = inner;
    cleaned = cleaned.replace(/\\le/g, "≤").replace(/\\ge/g, "≥").replace(/\\approx/g, "≈").replace(/\\times/g, "×").replace(/\\sim/g, "~");
    cleaned = cleaned.replace(/\\text\{([^\}]+)\}/g, "$1").replace(/\\mathbf\{([^\}]+)\}/g, "$1");
    cleaned = cleaned.replace(/\\/g, "").trim();
    return cleaned;
  });

  return text;
}

export function Markdown({ content }: { content: string }) {
  const colorMode = useColorMode();
  const [index, setIndex] = React.useState(-1);
  const slides = useRef<SlideImage[]>();

  useEffect(() => {
    slides.current = undefined;
  }, [content]);



  const cleanContent = useMemo(() => preprocessMarkdownContent(content), [content]);

  const Content = useMemo(() => {
    let hrCounter = 0;
    return (
    <ReactMarkdown
      className="toc-content min-w-0 dark:text-neutral-300 [overflow-wrap:anywhere]"
      remarkPlugins={[gfm, remarkMermaid, remarkAlert, remarkBreaks]}
      children={cleanContent}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      components={{
        img({ node, src, ...props }) {
          const offset = node!.position!.start.offset!;
          const previousContent = content.slice(0, offset);
          const newlinesBefore = countNewlinesBeforeNode(
            previousContent,
            offset
          );
          const Image = ({
            rounded,
            scale,
          }: {
            rounded: boolean;
            scale: string;
          }) => (
            <MarkdownImage
              src={src}
              alt={props.alt}
              show={show}
              rounded={rounded}
              scale={scale}
              className={props.className}
            />
          );
          if (
            newlinesBefore >= 1 ||
            previousContent.trim().length === 0 ||
            isMarkdownImageLinkAtEnd(previousContent)
          ) {
            return (
              <span className="block w-full text-center my-4">
                <Image scale="0.75" rounded={true} />
              </span>
            );
          } else {
            return (
              <span className="inline-block align-middle mx-1 ">
                <Image scale="0.5" rounded={false} />
              </span>
            );
          }
        },
        code(props) {
          const { children, className, node, ...rest } = props;
          const match = /language-([^\s]+)/.exec(className || "");

          // 健壮判断是否为多行独立代码块：
          // 1. 带有 language-xxx 类名；或 2. 内容含有换行；或 3. 原始文本切片以 ``` 或 ~~~ 开头
          const curContent = cleanContent.slice(node?.position?.start.offset || 0);
          const startsWithFence = curContent.trimStart().startsWith("```") || curContent.trimStart().startsWith("~~~");
          const hasMultipleLines = String(children).includes("\n");
          const isCodeBlock = Boolean(match) || startsWithFence || hasMultipleLines;

          const codeBlockStyle = {
            fontFamily: 'ui-monospace, "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: "14px",
            fontVariantLigatures: "normal",
            WebkitFontFeatureSettings: '"liga" 1',
            fontFeatureSettings: '"liga" 1',
          };

          const inlineCodeStyle = {
            ...codeBlockStyle,
            fontSize: "13px",
          };

          const rawLanguage = match ? match[1] : "";
          const language = normalizeLanguage(rawLanguage);
          const rawCode = cleanCodeBlockContent(String(children).replace(/\n$/, ""));
          const linesCount = rawCode.split("\n").length;

          if (isCodeBlock) {
            return (
              <MarkdownCodeBlock
                rawLanguage={rawLanguage}
                language={language}
                rawCode={rawCode}
                linesCount={linesCount}
                colorMode={colorMode}
                codeBlockStyle={codeBlockStyle}
              />
            );
          } else {
            return (
              <code
                {...rest}
                className={`bg-theme/10 text-theme border border-theme/20 dark:bg-theme/15 dark:text-theme dark:border-theme/30 px-1.5 py-0.5 rounded-md mx-[2px] font-medium [overflow-wrap:anywhere] ${className || ""}`}
                style={inlineCodeStyle}
              >
                {children}
              </code>
            );
          }
        },
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="my-4 border-l-4 border-theme/60 bg-theme/[0.04] dark:bg-theme/[0.08] rounded-r-xl px-4 py-2.5 text-neutral-700 dark:text-neutral-300 leading-relaxed"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        em({ children, ...props }) {
          return (
            <em className="ml-[1px] mr-[4px] text-neutral-600 dark:text-neutral-300" {...props}>
              {children}
            </em>
          );
        },
        strong({ children, ...props }) {
          return (
            <strong className="mx-[1px] font-bold text-neutral-900 dark:text-white" {...props}>
              {highlightLeadingNumber(children)}
            </strong>
          );
        },

        table({ children, ...props }: any) {
          return (
            <div className="my-6 w-full overflow-x-auto rounded-2xl border border-black/10 bg-w shadow-2xs dark:border-white/10">
              <table className="w-full text-left text-xs sm:text-sm border-collapse" {...props}>
                {children}
              </table>
            </div>
          );
        },
        thead({ children, ...props }: any) {
          return (
            <thead className="bg-black/[0.03] dark:bg-white/[0.04] border-b border-black/10 dark:border-white/10 text-xs font-bold t-primary select-none" {...props}>
              {children}
            </thead>
          );
        },
        th({ children, ...props }: any) {
          return (
            <th className="px-4 py-3 font-extrabold text-theme/90 dark:text-theme tracking-wider border-r border-black/5 dark:border-white/5 last:border-r-0 whitespace-nowrap" {...props}>
              {children}
            </th>
          );
        },
        td({ children, ...props }: any) {
          return (
            <td className="px-4 py-3 text-xs sm:text-sm leading-relaxed border-t border-black/5 dark:border-white/5 border-r border-black/5 dark:border-white/5 last:border-r-0 t-primary" {...props}>
              {children}
            </td>
          );
        },
        tr({ children, ...props }) {
          return (
            <tr className="transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.02]" {...props}>
              {children}
            </tr>
          );
        },
        ul({ children, className, ...props }) {
          const listClass = className?.includes("contains-task-list")
            ? "list-none pl-2 my-2.5 space-y-1.5"
            : "list-disc pl-5 my-2.5 space-y-1.5 marker:text-theme";
          return (
            <ul className={listClass} {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-5 my-2.5 space-y-2 marker:text-theme marker:font-extrabold" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return (
            <li className="pl-1 py-0.5 leading-7" {...props}>
              {children}
            </li>
          );
        },
        a({ children, ...props }) {
          return (
            <a
              className="break-words text-theme font-medium underline decoration-theme/35 underline-offset-4 hover:decoration-theme transition-colors [overflow-wrap:anywhere]"
              {...props}
            >
              {children}
            </a>
          );
        },
        h1({ children, ...props }) {
          return (
            <h1
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-8 mb-4 text-2xl sm:text-3xl font-extrabold t-primary tracking-tight flex items-center gap-2.5 pb-2.5 border-b border-theme/20`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="flex h-6 w-1.5 rounded-full bg-theme shrink-0 shadow-xs" />
              <span className="break-words [overflow-wrap:anywhere] flex-1">{highlightLeadingNumber(children)}</span>
            </h1>
          );
        },
        h2({ children, ...props }) {
          return (
            <h2
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-7 mb-3 text-xl sm:text-2xl font-bold t-primary tracking-tight flex items-center gap-2.5 pb-1.5 border-b border-theme/15`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="h-5 w-1 rounded-full bg-theme/85 shrink-0 shadow-2xs" />
              <span className="break-words [overflow-wrap:anywhere] flex-1">{highlightLeadingNumber(children)}</span>
            </h2>
          );
        },
        h3({ children, ...props }) {
          return (
            <h3
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-6 mb-2.5 text-lg sm:text-xl font-bold t-primary flex items-center gap-2`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="text-theme text-xs select-none shrink-0">◆</span>
              <span className="break-words [overflow-wrap:anywhere] flex-1">{highlightLeadingNumber(children)}</span>
            </h3>
          );
        },
        h4({ children, ...props }) {
          return (
            <h4
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-5 mb-2 text-base sm:text-lg font-bold t-primary flex items-center gap-2`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="text-theme/80 text-xs select-none shrink-0">▸</span>
              <span className="break-words [overflow-wrap:anywhere] flex-1">{highlightLeadingNumber(children)}</span>
            </h4>
          );
        },
        h5({ children, ...props }) {
          return (
            <h5
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-4 mb-1.5 text-base font-bold t-primary flex items-center gap-2`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-theme/70 shrink-0" />
              <span className="break-words [overflow-wrap:anywhere] flex-1">{highlightLeadingNumber(children)}</span>
            </h5>
          );
        },
        h6({ children, ...props }) {
          return (
            <h6
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-4 mb-1.5 text-sm font-bold t-primary flex items-center gap-2`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-theme/55 shrink-0" />
              <span className="break-words [overflow-wrap:anywhere] flex-1">{highlightLeadingNumber(children)}</span>
            </h6>
          );
        },
        p({ children, node, ...props }) {
          return (
            <p className="mt-2.5 py-0.5 leading-7 break-words [overflow-wrap:anywhere]" {...props}>
              {children}
            </p>
          );
        },
        hr({ children, ...props }) {
          const variant = hrCounter++ % 4;
          if (variant === 0) {
            return (
              <div className="my-7 flex items-center gap-3 select-none" data-hr-variant="sparkle">
                <hr className="flex-1 border-0 h-px bg-gradient-to-r from-transparent to-theme/35" {...props} />
                <span className="text-theme/75 text-xs" aria-hidden="true">✦</span>
                <span className="flex-1 h-px bg-gradient-to-l from-transparent to-theme/35" aria-hidden="true" />
              </div>
            );
          }
          if (variant === 1) {
            return (
              <div className="my-7 flex items-center justify-center gap-2.5 select-none" data-hr-variant="dots">
                <hr className="sr-only" {...props} />
                <span className="h-1.5 w-1.5 rounded-full bg-theme/65" aria-hidden="true" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400/75" aria-hidden="true" />
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400/75" aria-hidden="true" />
              </div>
            );
          }
          if (variant === 2) {
            return (
              <hr
                data-hr-variant="prism"
                className="my-7 border-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-theme/40 via-50% to-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, transparent, rgb(var(--theme-rgb) / 0.45), rgba(96, 165, 250, 0.45), rgba(167, 139, 250, 0.45), transparent)",
                }}
                {...props}
              />
            );
          }
          return (
            <div className="my-7 flex items-center gap-3 select-none" data-hr-variant="diamond">
              <hr className="flex-1 border-0 h-px bg-gradient-to-r from-transparent to-emerald-400/40" {...props} />
              <span className="text-emerald-500/70 dark:text-emerald-400/75 text-[10px]" aria-hidden="true">◆</span>
              <span className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-400/40" aria-hidden="true" />
            </div>
          );
        },
        sup: ({ children, ...props }) => (
          <sup className="text-xs mr-[4px]" {...props}>
            {children}
          </sup>
        ),
        sub: ({ children, ...props }) => (
          <sub className="text-xs mr-[4px]" {...props}>
            {children}
          </sub>
        ),
        section({ children, ...props }) {
          if (props.hasOwnProperty("data-footnotes")) {
            props.className = `${props.className || ""} mt-8`.trim();
          }
          const modifiedChildren = React.Children.map(children, (child) => {
            if (isValidElement(child) && child.props.node.tagName === "ol") {
              return cloneElement(child, {
                ...child.props,
                className: "list-decimal px-10 text-sm text-[#6B7280]",
              } as React.HTMLAttributes<HTMLParagraphElement>);
            }
            return child;
          });
          return <section {...props}>{modifiedChildren}</section>;
        },
        iframe({ node, src, title, ...props }) {
          const safeSrc = safeHttpUrl(src);
          if (!safeSrc) {
            return null;
          }
          return (
            <div className="my-4 w-full">
              <iframe
                {...props}
                src={safeSrc}
                title={title || "Embedded content"}
                className="w-full rounded-xl border border-black/10 dark:border-white/10"
                style={{ minHeight: "400px" }}
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-popups allow-forms allow-presentation"
              />
            </div>
          );
        },
        details({ children, className, ...props }) {
          return (
            <details
              className={`my-3 ${className || ""}`.trim()}
              {...props}
            >
              {children}
            </details>
          );
        },
        summary({ children, className, ...props }) {
          return (
            <summary
              className={`cursor-pointer font-semibold t-primary hover:text-theme transition-colors marker:text-theme select-none ${className || ""}`.trim()}
              {...props}
            >
              {children}
            </summary>
          );
        },
        div({ children, node, ...props }) {
          return <div {...props}>{children}</div>;
        },
      }}
    />
    );
  }, [cleanContent, colorMode])



  const show = (src: string | undefined) => {
    let slidesLocal = slides.current;
    if (!slidesLocal) {
      const parent = document.getElementsByClassName("toc-content")[0];
      if (!parent) return;
      const images = parent.querySelectorAll("img");
      slidesLocal = Array.from(images)
        .map((image) => {
          const url = image.getAttribute("src") || "";
          const filename = url.split("/").pop() || "";
          const alt = image.getAttribute("alt") || "";
          return {
            src: url,
            alt: alt,
            imageFit: "contain" as const,
            download: {
              url: url,
              filename: filename,
            },
          };
        })
        .filter((slide) => slide.src !== "");
      slides.current = (slidesLocal);
    }
    const index = slidesLocal?.findIndex((slide) => slide.src === src) ?? -1;
    setIndex(index);
  };

  return (
    <>
      {Content}
      <Lightbox
        plugins={[Download, Zoom, Counter]}
        index={index}
        slides={slides.current}
        open={index >= 0}
        close={() => setIndex(-1)}
        controller={{ closeOnBackdropClick: true }}
      />
    </>
  );
}
