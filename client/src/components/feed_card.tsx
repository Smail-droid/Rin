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
    // 2. 巨幅画册海报 (Poster Visual Hero) - 沉浸式海报背景，横幅宽屏画幅，文字悬浮微光蒙版
    // =========================================================================
    if (activeVariant === "poster" && avatar) {
        const posterBody = (
            <div className="group relative my-3 overflow-hidden rounded-3xl border border-black/10 shadow-lg hover:shadow-2xl transition-all duration-300 dark:border-white/10 break-inside-avoid">
                <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-neutral-900">
                    <img
                        src={avatar}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* 微光暗部渐变与磨砂文字浮层 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex flex-col justify-end p-5 text-white">
                        {safeHashtags.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap text-xs text-white/70 mb-2">
                                {safeHashtags.map(({ name }, i) => (
                                    <span key={i}>#{name}</span>
                                ))}
                            </div>
                        ) : null}
                        <h2 className="text-xl font-bold leading-snug drop-shadow-sm group-hover:text-theme-hover transition-colors">
                            {title}
                        </h2>
                        {summary ? (
                            <p className="mt-2 line-clamp-2 text-xs text-white/80 leading-relaxed font-normal">
                                {summary}
                            </p>
                        ) : null}
                        <div className="flex items-center justify-between text-[11px] text-white/60 mt-3 pt-2.5 border-t border-white/15">
                            <div className="flex items-center gap-2">
                                <span>{timeago(createdAt)}</span>
                                {top === 1 ? <span className="text-amber-400 font-bold">· {t('article.top.title')}</span> : null}
                            </div>
                            <span className="flex items-center gap-1">
                                <i className="ri-time-line" />
                                {finalReadingMinutes} 分钟
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
        return preview ? posterBody : <Link href={`/feed/${id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0 w-full">{posterBody}</Link>;
    }

    // =========================================================================
    // 3. 极简杂志社论 (Editorial Magazine) - 宽幅艺术画报、典雅衬线标题与呼吸感摘要
    // =========================================================================
    if (activeVariant === "editorial") {
        const editorialBody = (
            <article className="group my-2 break-inside-avoid overflow-hidden rounded-2xl border border-black/10 bg-w p-3.5 sm:p-4 shadow-xs hover:shadow-lg transition-all hover:-translate-y-0.5 dark:border-white/10">
                {avatar ? (
                    <div className="w-full aspect-[16/10] sm:aspect-[16/9] overflow-hidden rounded-xl mb-2.5 border border-black/5 dark:border-white/10 bg-neutral-100 dark:bg-neutral-800">
                        <img src={avatar} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                ) : null}
                <div className="flex flex-col gap-1 px-0.5">
                    {safeHashtags.length > 0 ? (
                        <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-0.5 flex items-center gap-1.5 flex-wrap">
                            {safeHashtags.map(({ name }, i) => (
                                <span key={i} className="hover:text-theme">#{name}</span>
                            ))}
                        </div>
                    ) : null}
                    <h2 className="text-base sm:text-lg font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-100 group-hover:text-theme transition-colors leading-snug">
                        {title}
                    </h2>
                    {summary ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300 font-normal">
                            {summary}
                        </p>
                    ) : null}
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 font-mono px-0.5">
                    <div className="flex items-center gap-2">
                        <span>{timeago(createdAt)}</span>
                        {top === 1 ? <span className="text-theme font-semibold">· {t('article.top.title')}</span> : null}
                        {draft === 1 ? <span className="text-amber-500">· {t("draft")}</span> : null}
                    </div>
                    <span>{finalReadingMinutes} 分钟阅读</span>
                </div>
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
