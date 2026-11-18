import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { timeago } from "../utils/timeago";
import { useEffect, useRef } from "react";
import { drawBlurhashToCanvas } from "../utils/blurhash";
import { parseImageUrlMetadata } from "../utils/image-upload";
import { useImageLoadState } from "../utils/use-image-load-state";
import { type FeedCardVariant, normalizeFeedCardVariant } from "./feed-card-options";
import { useSiteConfig } from "../hooks/useSiteConfig";

function FeedCardImage({ src, variant }: { src: string; variant: FeedCardVariant }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(src);
    const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(cleanSrc);
    const aspectRatio = width && height ? `${width} / ${height}` : "16 / 9";
    const imageFrameClass =
        variant === "editorial"
            ? "relative flex max-h-80 w-full flex-row items-center overflow-hidden rounded-[20px]"
            : "relative mb-2 flex max-h-80 w-full flex-row items-center overflow-hidden rounded-xl";

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
        <div
            className={imageFrameClass}
            style={{ aspectRatio: aspectRatio || '16 / 9' }}
        >
            {blurhash && !loaded ? (
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
                />
            ) : null}
            {failed && !blurhash ? (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                    <i className="ri-image-line text-2xl" aria-hidden="true" />
                </div>
            ) : null}
            <img
                ref={imageRef}
                src={cleanSrc}
                alt=""
                width={width}
                height={height}
                onLoad={onLoad}
                onError={onError}
                className={`absolute inset-0 h-full w-full object-cover object-center hover:scale-105 translation duration-300 ${failed || (blurhash && !loaded) ? "opacity-0" : "opacity-100"
                    }`}
            />
        </div>
    );
}

function estimateReadingMinutes(text: string): number {
    const chars = (text || "").length;
    return Math.max(1, Math.round(chars / 250));
}

export type FeedCardProps = {
    id: string;
    avatar?: string;
    draft?: number;
    listed?: number;
    top?: number;
    title: string;
    summary: string;
    readingTime?: number;
    hashtags?: { id: number, name: string }[];
    createdAt: Date;
    updatedAt: Date;
    preview?: boolean;
    variant?: FeedCardVariant;
};

export function FeedCard({ id, title, avatar, draft, listed, top, summary, readingTime, hashtags, createdAt, updatedAt, preview = false, variant }: FeedCardProps) {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const safeHashtags = Array.isArray(hashtags) ? hashtags : [];
    const activeVariant = normalizeFeedCardVariant(variant ?? siteConfig.feedCardVariant);
    const dateTooltip = createdAt === updatedAt ? new Date(createdAt).toLocaleString() : `${new Date(createdAt).toLocaleString()} (更新于 ${new Date(updatedAt).toLocaleString()})`;
    const finalReadingMinutes = readingTime ?? estimateReadingMinutes(summary);

    // =========================================================================
    // 1. 极客高密单行 (Compact Dense Row) - 纯单行排布，适合快速扫读
    // =========================================================================
    if (activeVariant === "compact") {
        const compactBody = (
            <div className="group my-1.5 flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-w px-4 py-2.5 transition-all hover:border-black/20 hover:bg-neutral-50/80 dark:border-white/5 dark:hover:border-white/20 dark:hover:bg-neutral-800/40">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono text-neutral-400 shrink-0" title={dateTooltip}>
                        {timeago(createdAt)}
                    </span>
                    {listed === 0 ? (
                        <span className="shrink-0 rounded-md bg-neutral-500/10 px-1.5 py-0.5 text-[11px] font-bold text-neutral-400">
                            {t("unlisted")}
                        </span>
                    ) : null}
                    {top === 1 ? (
                        <span className="shrink-0 rounded-md bg-theme/10 px-1.5 py-0.5 text-[11px] font-bold text-theme">
                            {t('article.top.title')}
                        </span>
                    ) : null}
                    {draft === 1 ? (
                        <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-500">
                            {t("draft")}
                        </span>
                    ) : null}
                    <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate group-hover:text-theme transition-colors">
                        {title}
                    </h2>
                </div>
                <div className="hidden sm:flex items-center gap-3 shrink-0 text-xs text-neutral-400">
                    {safeHashtags.slice(0, 2).map(({ name }, i) => (
                        <span key={i} className="text-neutral-400 dark:text-neutral-500">#{name}</span>
                    ))}
                    <span className="text-[11px] font-mono opacity-70">
                        {finalReadingMinutes}m
                    </span>
                </div>
            </div>
        );
        return preview ? compactBody : <Link href={`/feed/${id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0 w-full">{compactBody}</Link>;
    }

    // =========================================================================
    // 2. 全幅沉浸画册 (Poster) - 原图完整不裁切 + 贴底轻盈铭牌
    // =========================================================================
    if (activeVariant === "poster" && avatar) {
        const posterBody = (
            <div className="group relative my-3 overflow-hidden rounded-2xl bg-neutral-900 shadow-sm hover:shadow-xl transition-all duration-300 break-inside-avoid">
                <div className="relative w-full overflow-hidden">
                    <img
                        src={avatar}
                        alt=""
                        className="block h-auto w-full group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3.5 pt-8 pb-3 text-white">
                        <div className="flex items-center justify-between text-[10px] font-mono text-white/75 mb-0.5">
                            <span>{timeago(createdAt)}</span>
                            <span>{finalReadingMinutes} 分钟</span>
                        </div>
                        <h2 className="text-sm sm:text-base font-bold leading-snug line-clamp-1">
                            {title}
                        </h2>
                        {safeHashtags.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-white/75 mt-1">
                                {safeHashtags.slice(0, 3).map(({ name }, i) => (
                                    <span key={i}>#{name}</span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
        return preview ? posterBody : <Link href={`/feed/${id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0 w-full">{posterBody}</Link>;
    }

    // =========================================================================
    // 3. 图文双栏杂志 (Editorial) - 横向 6:4 左文右图，去白底厚卡片框
    // =========================================================================
    if (activeVariant === "editorial") {
        const editorialBody = (
            <article className="group py-5 border-b border-neutral-200/80 dark:border-white/10 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                        <span>{timeago(createdAt)}</span>
                        <span>·</span>
                        <span>{finalReadingMinutes} 分钟阅读</span>
                        {top === 1 ? <span className="text-theme font-sans font-semibold">· {t("article.top.title")}</span> : null}
                        {draft === 1 ? <span className="text-amber-500 font-sans">· {t("draft")}</span> : null}
                    </div>
                    <h2 className="text-lg sm:text-xl font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-100 group-hover:text-theme transition-colors leading-snug">
                        {title}
                    </h2>
                    {summary ? (
                        <p className="line-clamp-3 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                            {summary}
                        </p>
                    ) : null}
                    {safeHashtags.length > 0 ? (
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2 flex-wrap pt-1">
                            {safeHashtags.slice(0, 4).map(({ name }, i) => (
                                <span key={i}>#{name}</span>
                            ))}
                        </div>
                    ) : null}
                </div>
                {avatar ? (
                    <div className="w-full sm:w-48 md:w-56 shrink-0 aspect-[16/10] overflow-hidden rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-100 dark:bg-neutral-800">
                        <img src={avatar} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                ) : null}
            </article>
        );
        return preview ? editorialBody : <Link href={`/feed/${id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0 w-full">{editorialBody}</Link>;
    }

    // =========================================================================
    // 4. 拍立得拟物手账 (Polaroid Default) - 真实白边留白、微倾斜暗角与拟物温度
    // =========================================================================
    const polaroidBody = (
        <div className="group my-3 break-inside-avoid rounded-2xl border border-black/10 bg-w p-3.5 shadow-sm hover:shadow-xl transition-all duration-300 dark:border-white/10 hover:-translate-y-1">
            {avatar ? (
                <div className="overflow-hidden rounded-xl border border-black/5 dark:border-white/5 bg-neutral-100 dark:bg-neutral-800">
                    <FeedCardImage src={avatar} variant="default" />
                </div>
            ) : null}
            <div className="px-1 pt-3 pb-1">
                {safeHashtags.length > 0 ? (
                    <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1 flex items-center gap-1.5 flex-wrap">
                        {safeHashtags.map(({ name }, i) => (
                            <span key={i}>#{name}</span>
                        ))}
                    </div>
                ) : null}
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-theme transition-colors line-clamp-2">
                    {title}
                </h2>
                <p className="mt-1.5 line-clamp-3 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {summary}
                </p>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-3 pt-2 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-1.5">
                        <span>{timeago(createdAt)}</span>
                        {top === 1 ? <span className="text-theme font-bold">· {t('article.top.title')}</span> : null}
                        {draft === 1 ? <span className="text-amber-500 font-bold">· {t("draft")}</span> : null}
                    </div>
                    <span>{finalReadingMinutes} 分钟</span>
                </div>
            </div>
        </div>
    );

    return preview ? polaroidBody : <Link href={`/feed/${id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0 w-full">{polaroidBody}</Link>;
}
