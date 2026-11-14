import { useContext, useState, useEffect } from "react";
import { Modal } from "@rin/ui";
import { ProfileContext } from "../state/profile";
import { Markdown } from "./markdown";
import { Waiting } from "./loading";
import { getAuthToken } from "../utils/auth";

export interface OriginChronicleLensProps {
    slug: string;
    pageTitle: string;
    description?: string;
    highlights?: string[];
    className?: string;
}

export function OriginChronicleLens({
    slug,
    pageTitle,
    description,
    highlights,
    className = "",
}: OriginChronicleLensProps) {
    const profile = useContext(ProfileContext);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [chronicle, setChronicle] = useState<{
        title: string;
        content: string;
        alias?: string;
        id?: number;
    } | null>(null);
    const [statusMsg, setStatusMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const loadChronicle = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/feed/origin-chronicle/${slug}`);
            if (res.ok) {
                const data = await res.json();
                if (data.exists && data.feed) {
                    setChronicle(data.feed);
                } else {
                    setChronicle(null);
                }
            }
        } catch {
            setChronicle(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            void loadChronicle();
        }
    }, [isOpen, slug]);

    const handleSynthesize = async () => {
        setIsSynthesizing(true);
        setStatusMsg("🧠 正在调集架构师能力构思诞生初衷长文（约需 5~12 秒），请稍候...");
        setErrorMsg("");
        try {
            const token = getAuthToken() || localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/feed/origin-chronicle", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify({
                    slug,
                    pageTitle,
                    description,
                    highlights,
                    forceRegenerate: Boolean(chronicle),
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.feed) {
                    setChronicle(data.feed);
                    setStatusMsg(data.isAi ? "✨ 已通过 AI 深度编织完成并入库！" : "✨ 诞生纪事已根据工程规范编织入库！");
                    setTimeout(() => setStatusMsg(""), 4000);
                }
            } else {
                setStatusMsg("");
                const errData = await res.json().catch(() => ({}));
                const errText = typeof errData?.error === "string"
                    ? errData.error
                    : (errData?.error?.message || errData?.message || `编织失败 (${res.status})，请确认管理员登录状态`);
                setErrorMsg(errText);
            }
        } catch (err: any) {
            console.error("Synthesize chronicle error:", err);
            setStatusMsg("");
            setErrorMsg("请求异常: " + (err?.message || "网络中断"));
        } finally {
            setIsSynthesizing(false);
        }
    };

    return (
        <>
            {/* 唤起透镜的微光胶囊按钮 */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-theme/10 hover:bg-theme/20 text-theme border border-theme/20 shadow-2xs hover:shadow-sm hover:scale-[1.02] active:scale-95 transition-all duration-300 text-xs font-medium cursor-pointer select-none backdrop-blur-md ${className}`}
                title="查看本页面的诞生初衷与边缘架构开发纪事"
            >
                <i className="ri-compass-3-line text-sm animate-pulse" />
                <span>诞生初衷</span>
            </button>

            {/* 纪事阅读与沉淀弹窗 */}
            <Modal
                isOpen={isOpen}
                onRequestClose={() => setIsOpen(false)}
                contentLabel={`诞生初衷 · ${pageTitle}`}
                panelClassName="max-h-[85vh] p-4 sm:p-6 max-w-[94vw] sm:max-w-2xl w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans"
            >
                {/* 顶栏 */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/5 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-theme animate-ping" />
                        <h3 className="text-base font-bold t-primary">
                            {`🪐 诞生初衷 · ${pageTitle}`}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
                    >
                        <i className="ri-close-line text-lg" />
                    </button>
                </div>

                {/* 正文区域 */}
                <div className="flex-1 overflow-y-auto pr-1 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed min-h-[220px]">
                    {/* 状态与报错提示浮条 */}
                    {statusMsg && (
                        <div className="mb-3 p-3 rounded-2xl bg-theme/10 border border-theme/20 text-theme flex items-center gap-2 text-xs font-medium animate-pulse">
                            <i className="ri-loader-4-line animate-spin" />
                            <span>{statusMsg}</span>
                        </div>
                    )}
                    {errorMsg && (
                        <div className="mb-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 text-xs">
                            <i className="ri-error-warning-line" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="py-20 flex justify-center">
                            <Waiting />
                        </div>
                    ) : chronicle ? (
                        <div className="space-y-4">
                            <div className="p-3 rounded-2xl bg-theme/5 border border-theme/15 flex items-center justify-between gap-3 text-xs">
                                <span className="text-theme font-medium truncate">
                                    {chronicle.title}
                                </span>
                                <a
                                    href={`/feed/${chronicle.alias || chronicle.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded-lg bg-theme text-white text-[11px] font-bold shrink-0 hover:opacity-90 transition inline-flex items-center gap-1"
                                >
                                    <span>前往阅读完整文章</span>
                                    <i className="ri-arrow-right-line" />
                                </a>
                            </div>

                            <article className="prose dark:prose-invert max-w-none text-xs sm:text-sm">
                                <Markdown content={chronicle.content} />
                            </article>
                        </div>
                    ) : (
                        <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-2xl bg-theme/10 text-theme flex items-center justify-center text-2xl mb-3 shadow-inner">
                                <i className="ri-quill-pen-line" />
                            </div>
                            <h4 className="font-bold text-sm t-primary mb-1">
                                本页开发纪事尚未编织入库
                            </h4>
                            <p className="text-xs text-neutral-400 max-w-sm mb-5 leading-normal">
                                遵循“一页一世界”哲学，每次会话推进设计后，可一键自动将架构构思编织为永恒沉淀的开发手记。
                            </p>
                            {profile?.permission ? (
                                <button
                                    type="button"
                                    onClick={handleSynthesize}
                                    disabled={isSynthesizing}
                                    className="px-4 py-2 rounded-xl bg-theme text-white font-bold text-xs shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                                >
                                    <i className={`ri-magic-line ${isSynthesizing ? "animate-spin" : ""}`} />
                                    <span>{isSynthesizing ? "正在编织开发纪事..." : "✨ 自动编织本页诞生纪事"}</span>
                                </button>
                            ) : (
                                <span className="text-xs text-neutral-400 italic">
                                    博主尚未生成本页公开纪事，敬请期待。
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* 底栏（仅管理员可重新编织） */}
                {profile?.permission && chronicle && !isLoading && (
                    <div className="pt-3 mt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs shrink-0">
                        <span className="text-[11px] text-neutral-400 font-mono">
                            别名: origins-{slug}
                        </span>
                        <button
                            type="button"
                            onClick={handleSynthesize}
                            disabled={isSynthesizing}
                            className="inline-flex items-center gap-1 text-[11px] text-theme hover:underline cursor-pointer disabled:opacity-50"
                        >
                            <i className={`ri-refresh-line ${isSynthesizing ? "animate-spin" : ""}`} />
                            <span>{isSynthesizing ? "重新提炼中..." : "重新编织纪事"}</span>
                        </button>
                    </div>
                )}
            </Modal>
        </>
    );
}
