import "katex/dist/katex.min.css";
import React, { cloneElement, isValidElement, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  base16AteliersulphurpoolLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import gfm from "remark-gfm";
import remarkMermaid from "../remark/remarkMermaid";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkMath from "remark-math";
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
        className={`mx-auto max-w-full cursor-zoom-in transition-opacity ${roundedClass} ${className || ""} ${
          failed ? "hidden" : blurhash && !loaded ? "opacity-0" : "opacity-100"
        }`}
      />
    </span>
  );
}

export function Markdown({ content }: { content: string }) {
  const colorMode = useColorMode();
  const [index, setIndex] = React.useState(-1);
  const slides = useRef<SlideImage[]>();

  useEffect(() => {
    slides.current = undefined;
  }, [content]);



  const Content = useMemo(() => (
    <ReactMarkdown
      className="toc-content min-w-0 dark:text-neutral-300 [overflow-wrap:anywhere]"
      remarkPlugins={[gfm, remarkMermaid, remarkMath, remarkAlert, remarkBreaks]}
      children={content}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
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
          const [copied, setCopied] = React.useState(false);
          const { children, className, node, ...rest } = props;
          const match = /language-(\w+)/.exec(className || "");

          const curContent = content.slice(node?.position?.start.offset || 0);
          const isCodeBlock = curContent.trimStart().startsWith("```");

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

          const language = match ? match[1] : "";

          if (isCodeBlock) {
            return (
              <div className="relative group my-4 rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden shadow-xs bg-[#f8fafc] dark:bg-[#1e1e1e]">
                {/* Mac Code Header Bar */}
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] select-none">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80 inline-block" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 inline-block" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 inline-block" />
                    </div>
                    {language && (
                      <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {language}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-black/5 dark:hover:bg-white/10 dark:text-neutral-400 dark:hover:text-white transition"
                    title="一键复制完整代码"
                  >
                    {copied ? (
                      <>
                        <i className="ri-check-line text-emerald-500" />
                        <span className="text-emerald-500">已复制!</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-file-copy-line" />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-1">
                  <SyntaxHighlighter
                    PreTag="div"
                    className="!bg-transparent !p-3.5 !m-0"
                    language={language}
                    style={
                      colorMode === "dark"
                        ? vscDarkPlus
                        : base16AteliersulphurpoolLight
                    }
                    wrapLongLines={true}
                    codeTagProps={{ style: codeBlockStyle }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          } else {
            return (
              <code
                {...rest}
                className={`bg-[#eff1f3] dark:bg-[#4a5061] h-[24px] px-[4px] rounded-md mx-[2px] py-[2px] text-neutral-800 dark:text-neutral-300 ${className || ""
                  }`}
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
              className="border-l-4 border-gray-300 dark:border-gray-500 pl-4 italic text-gray-500 dark:text-gray-400"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        em({ children, ...props }) {
          return (
            <em className="ml-[1px] mr-[4px]" {...props}>
              {children}
            </em>
          );
        },
        strong({ children, ...props }) {
          return (
            <strong className="mx-[1px]" {...props}>
              {children}
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
            ? "list-none pl-2 my-2 space-y-1"
            : "list-disc pl-5 my-2 space-y-1";
          return (
            <ul className={listClass} {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-5 my-2 space-y-1.5 marker:text-theme marker:font-bold" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return (
            <li className="pl-1 py-0.5 leading-relaxed" {...props}>
              {children}
            </li>
          );
        },
        a({ children, ...props }) {
          return (
            <a
              className="break-words text-theme font-medium hover:underline [overflow-wrap:anywhere]"
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
              className={`${props.className || ""} mt-8 mb-4 text-2xl sm:text-3xl font-extrabold t-primary tracking-tight flex items-center gap-2.5 pb-2.5 border-b border-black/10 dark:border-white/10`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="flex h-6 w-1.5 rounded-full bg-theme shrink-0 shadow-xs" />
              <span className="break-words [overflow-wrap:anywhere] flex-1">{children}</span>
            </h1>
          );
        },
        h2({ children, ...props }) {
          return (
            <h2
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-7 mb-3 text-xl sm:text-2xl font-bold t-primary tracking-tight flex items-center gap-2 pb-1`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="h-2 w-2 rounded-full bg-theme/80 shrink-0 shadow-2xs" />
              <span className="break-words [overflow-wrap:anywhere] flex-1">{children}</span>
            </h2>
          );
        },
        h3({ children, ...props }) {
          return (
            <h3
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-5 mb-2 text-lg sm:text-xl font-bold t-primary flex items-center gap-2`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              <span className="text-theme text-xs select-none">◆</span>
              <span className="break-words [overflow-wrap:anywhere] flex-1">{children}</span>
            </h3>
          );
        },
        h4({ children, ...props }) {
          return (
            <h4
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-4 break-words text-lg font-bold [overflow-wrap:anywhere]`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h4>
          );
        },
        h5({ children, ...props }) {
          return (
            <h5
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-4 break-words text-base font-bold [overflow-wrap:anywhere]`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h5>
          );
        },
        h6({ children, ...props }) {
          return (
            <h6
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} mt-4 break-words text-sm font-bold [overflow-wrap:anywhere]`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h6>
          );
        },
        p({ children, node, ...props }) {
          return (
            <p className="mt-2 break-words py-1 [overflow-wrap:anywhere]" {...props}>
              {children}
            </p>
          );
        },
        hr({ children, ...props }) {
          return <hr className="my-4" {...props} />;
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
        div({ children, node, ...props }) {
          return <div {...props}>{children}</div>;
        },
      }}
    />), [content])



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
      />
    </>
  );
}
