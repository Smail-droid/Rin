import { useState, useRef, useEffect } from "react";
import { client } from "../app/runtime";
import { Markdown } from "./markdown";
import { useSiteConfig } from "../hooks/useSiteConfig";

export type AICopilotMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AIExpertPersona = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  systemInstruction: string;
};

export const AI_EXPERT_PERSONAS: AIExpertPersona[] = [
  {
    id: "tech_architect",
    name: "文字侍从",
    icon: "ri-quill-pen-line",
    tagline: "文本清洗 · 代码梳理 · 删繁就简",
    systemInstruction:
      "你是一位专注于个人博客与画廊工坊的文字侍从（洗脚师）。你的职责是专注处理文本整理、命令纠错与排版洗练：直接给出准确的代码块或步骤（使用对应语言高亮包裹），绝对严禁任何客套废话、车轱辘话与AI口水式扩写，只输出关键要点、配置步骤与避坑说明。",
  },
  {
    id: "editor_polisher",
    name: "排版校对",
    icon: "ri-edit-line",
    tagline: "中英空格 · 语法排版 · 结构工整",
    systemInstruction:
      "你是一位画廊随想专属排版校对助手。请对文本进行排版润色：规范标题层级结构、严格执行中英文混排空格（盘古之白）、修正标点符号与专业名词大小写，保持文意准确利落，严禁堆砌无用辞藻。",
  },
  {
    id: "security_auditor",
    name: "命令审查",
    icon: "ri-shield-check-line",
    tagline: "语法闭合 · 字符转义 · 漏洞预警",
    systemInstruction:
      "你是一位代码安全与命令语法审查助手。请深度审查输入代码与命令：重点排查括号与引号是否闭合、是否有未转义的特殊字符、是否有未闭合代码块、是否存在安全隐患，并直接给出修正后的准确版本。",
  },
  {
    id: "brainstorm_expert",
    name: "灵感提炼",
    icon: "ri-lightbulb-line",
    tagline: "核心提纯 · 结构提纲 · 思想火花",
    systemInstruction:
      "你是一位随想灵感提炼助手。请为博主提供清晰的文章大纲、切入视角、画龙点睛的总结金句与关键要点，条理清晰，观点鲜明，杜绝套话。",
  },
];

export function WritingAICopilotDrawer({
  isOpen,
  onClose,
  onToggle: _onToggle,
  articleContent,
  onInsertText,
  onReplaceContent,
  onApplySummary,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToggle?: () => void;
  articleContent: string;
  onInsertText: (text: string) => void;
  onReplaceContent: (newContent: string) => void;
  onApplySummary: (summary: string) => void;
}) {
  const siteConfig = useSiteConfig();
  const [activeTab, setActiveTab] = useState<"chat" | "pipeline" | "presets">("chat");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("tech_architect");

  // 从后台读取自定义提示词预设库（实现前后台双向联动）
  const [promptPresets] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("rin_ai_prompt_presets");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "preset_tech_std", stage: "tech", name: "教程技术命令提炼", prompt: "请提取核心执行命令与配置..." },
      { id: "preset_format_std", stage: "format", name: "文章正文直接排版整理", prompt: "请规范标题层级与中英空格..." },
      { id: "preset_summary_std", stage: "summary", name: "精炼置顶摘要生成", prompt: "请输出50~100字高密导读..." },
    ];
  });

  // Chat State
  const [messages, setMessages] = useState<AICopilotMessage[]>([
    {
      role: "assistant",
      content:
        "您好！我是画廊工坊的文字侍从。已就绪代码与排版精炼模式，请随时在此输入需要排查的命令、代码或排版需求，我将为您输出干净利落的结构化内容。",
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 自由拖拽移动位置状态 (默认右侧)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // 首次打开或屏幕尺寸变化时，默认停靠在右侧推荐工作区，并进行严格边界保护防出界
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const drawerW = Math.min(480, winW * 0.94);
      const drawerH = Math.min(680, winH * 0.86);

      setPosition((prev) => {
        if (!prev) return { x: Math.max(16, winW - drawerW - 32), y: 70 };
        const safeX = Math.max(12, Math.min(winW - drawerW - 12, prev.x));
        const safeY = Math.max(60, Math.min(winH - drawerH - 12, prev.y));
        return { x: safeX, y: safeY };
      });
    };

    if (isOpen && position === null) {
      handleResize();
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, position]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    isDraggingRef.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const drawerW = typeof window !== "undefined" ? Math.min(480, window.innerWidth * 0.94) : 480;
    const currentPos = position || {
      x: typeof window !== "undefined" ? Math.max(20, window.innerWidth - drawerW - 32) : 200,
      y: 70,
    };

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initX: currentPos.x,
      initY: currentPos.y,
    };

    const handleDragMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      const curX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = curX - dragStartRef.current.startX;
      const deltaY = curY - dragStartRef.current.startY;

      const safeX = Math.max(10, Math.min(window.innerWidth - drawerW - 10, dragStartRef.current.initX + deltaX));
      const safeY = Math.max(50, Math.min(window.innerHeight - 150, dragStartRef.current.initY + deltaY));

      setPosition({ x: safeX, y: safeY });
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove);
    window.addEventListener("touchend", handleDragEnd);
  };

  // Pipeline State
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<{ result: string; summary?: string } | null>(null);
  const [copiedToast, setCopiedToast] = useState("");

  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(""), 2200);
  };

  const activePersona =
    AI_EXPERT_PERSONAS.find((p) => p.id === selectedPersonaId) ?? AI_EXPERT_PERSONAS[0];

  // 严格局部平滑滚动，彻底杜绝调用原生 scrollIntoView 导致整页上滚的 Bug
  useEffect(() => {
    if (activeTab === "chat" && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, activeTab, chatLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const query = (customPrompt || inputQuestion).trim();
    if (!query || chatLoading) return;

    const userMsg: AICopilotMessage = { role: "user", content: query };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!customPrompt) setInputQuestion("");
    setChatLoading(true);

    try {
      const contextPrefix =
        articleContent.trim().length > 0
          ? `当前博主正在编辑的文章内容如下（供参考）：\n\"\"\"\n${articleContent.slice(0, 4000)}\n\"\"\"\n\n`
          : "";

      const apiMessages = [
        {
          role: "system" as const,
          content: `${contextPrefix}${activePersona.systemInstruction}`,
        },
        ...nextMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
      ];

      const { data, error } = await client.config.chatAI({ messages: apiMessages });
      if (data?.success && data.reply) {
        // 清理可能由于非标准后端产生的 undefined 等脏字符串
        const cleanReply = data.reply.replace(/\s*undefined\s*$/g, "").trim();
        setMessages((prev) => [...prev, { role: "assistant", content: cleanReply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ 处理失败: ${data?.error || error?.value || "请检查 AI 配置"}` },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ 网络异常: ${err.message || String(err)}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!articleContent.trim()) {
      showToast("请先在编辑器输入文章内容");
      return;
    }
    if (pipelineStages.length === 0) {
      showToast("请勾选至少一个流程阶段");
      return;
    }

    setPipelineLoading(true);
    try {
      const { data, error } = await client.config.runAIPipeline({
        content: articleContent,
        stages: pipelineStages,
      });
      if (data?.success && data.result) {
        setPipelineResult({
          result: data.result,
          summary: data.summary,
        });
        showToast("✨ 流水线梳理就绪！可查看下方独立分区");
      } else {
        showToast(data?.error || String(error?.value || "梳理失败"));
      }
    } catch (err: any) {
      showToast(err.message || "梳理异常");
    } finally {
      setPipelineLoading(false);
    }
  };

  const togglePipelineStage = (stage: string) => {
    setPipelineStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  return (
    <>
      {/* 2. 可自由拖拽移动的二次元画廊风浮窗 (由左侧侧边栏底部的 AI 图标统一触发呼出，彻底移除左下角遮挡气泡) */}
      {isOpen && (
        <aside
          style={
            position
              ? {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                }
              : undefined
          }
          className={`fixed z-50 flex w-[480px] max-w-[94vw] h-[680px] max-h-[86vh] flex-col rounded-3xl border border-black/10 bg-w/98 shadow-2xl backdrop-blur-2xl dark:border-white/10 ani-show overflow-hidden ${
            !position ? "right-4 sm:right-8 top-16 sm:top-20" : ""
          }`}
        >
          {/* Draggable Header (左上角使用网站真实头像，典雅工坊侍从) */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onDoubleClick={() => {
              if (typeof window !== "undefined") {
                const defaultWidth = Math.min(480, window.innerWidth * 0.94);
                setPosition({ x: window.innerWidth - defaultWidth - 36, y: 80 });
              }
            }}
            className="flex items-center justify-between border-b border-black/5 px-4 py-3 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] cursor-move select-none"
            title="按住鼠标可自由拖拽移动窗口位置 · 双击重置到右侧"
          >
            <div className="flex items-center gap-2.5">
              {siteConfig.avatar ? (
                <img
                  src={siteConfig.avatar}
                  alt={siteConfig.name || "80Hou"}
                  className="h-8 w-8 rounded-xl object-cover shadow-sm ring-1 ring-theme/20"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-theme to-pink-500 text-white font-extrabold text-[10px] shadow-sm">
                  80H
                </span>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-extrabold t-primary">画廊文字侍从</p>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                    就绪
                  </span>
                  <span className="text-[10px] text-neutral-400 font-normal hidden sm:inline">
                    (可拖拽)
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">{activePersona.tagline}</p>
              </div>
            </div>

            {/* 包含收起 (-) 与关闭 (X) 按钮 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200 transition font-bold"
                title="收回 (-)"
              >
                <i className="ri-subtract-line text-base" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200 transition"
                title="关闭"
              >
                <i className="ri-close-line text-base" />
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center border-b border-black/5 p-1.5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1 text-xs font-semibold transition ${
                activeTab === "chat"
                  ? "bg-theme text-white shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <i className="ri-chat-1-line" />
              <span>对话咨询</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("presets")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1 text-xs font-semibold transition ${
                activeTab === "presets"
                  ? "bg-theme text-white shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <i className="ri-list-settings-line" />
              <span>提示词预设</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pipeline")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1 text-xs font-semibold transition ${
                activeTab === "pipeline"
                  ? "bg-theme text-white shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <i className="ri-magic-line" />
              <span>流水线</span>
            </button>
          </div>

          {/* Notification Toast */}
          {copiedToast && (
            <div className="mx-3 mt-1.5 rounded-lg bg-theme text-white px-2.5 py-1 text-xs font-semibold shadow-xs text-center ani-show">
              {copiedToast}
            </div>
          )}

          {/* TAB 1: Chat Mode */}
          {activeTab === "chat" && (
            <div className="flex flex-1 min-h-0 flex-col">
              {/* Expert Personas Selector Bar (一键切换专家人设模板) */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-b border-black/5 text-[11px] scrollbar-none dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
                {AI_EXPERT_PERSONAS.map((persona) => {
                  const isSelected = selectedPersonaId === persona.id;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => {
                        setSelectedPersonaId(persona.id);
                        showToast(`已切换至【${persona.name}】模式！`);
                      }}
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition select-none ${
                        isSelected
                          ? "bg-theme text-white shadow-2xs"
                          : "bg-black/5 text-neutral-600 hover:bg-theme/10 hover:text-theme dark:bg-white/5 dark:text-neutral-300"
                      }`}
                      title={persona.systemInstruction}
                    >
                      <i className={persona.icon} />
                      <span>{persona.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Prompts (多行自适应平铺，不再强制单行截断) */}
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-black/5 text-[11px] dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
                {[
                  "帮我写段命令行配置",
                  "检查代码块是否闭合",
                  "润色选中的段落",
                  "提炼3个核心要点",
                  "排查语法漏洞与参数",
                  "提取为技术实操手册",
                ].map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => handleSendMessage(qp)}
                    className="rounded-full bg-black/5 px-2.5 py-0.5 text-neutral-600 hover:bg-theme/10 hover:text-theme dark:bg-white/5 dark:text-neutral-300 transition text-[10px]"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Messages Container (局部容器滚动，杜绝整页上滚) */}
              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3"
              >
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col gap-1 ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400 px-1">
                      <span>{msg.role === "user" ? "你" : activePersona.name}</span>
                    </div>

                    <div
                      className={`group relative max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-theme text-white rounded-br-none shadow-2xs"
                          : "bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-bl-none t-primary shadow-2xs"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div>
                          <Markdown content={msg.content} />

                          {/* Action Buttons on AI Messages */}
                          <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                showToast("已复制回答纯文本！");
                              }}
                              className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
                              title="复制内容"
                            >
                              <i className="ri-file-copy-line mr-0.5" />
                              复制
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onInsertText(msg.content);
                                showToast("已插入到当前光标处！");
                              }}
                              className="rounded-md bg-theme/10 text-theme px-2 py-0.5 text-[10px] font-semibold hover:bg-theme/20"
                              title="插入到编辑器当前光标处"
                            >
                              <i className="ri-arrow-left-down-line mr-0.5" />
                              插入光标处
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 p-2 text-xs text-neutral-400">
                    <i className="ri-loader-4-line animate-spin text-theme text-sm" />
                    <span>{activePersona.name} 正在梳理干货回答中…</span>
                  </div>
                )}
              </div>

              {/* Chat Input at the BOTTOM (多行 Textarea) */}
              <div className="p-3 border-t border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex flex-col gap-2"
                >
                  <textarea
                    rows={2}
                    placeholder="输入需要查询的代码、配置或写作问题（Shift+Enter 换行，Enter 发送）..."
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={chatLoading}
                    className="w-full resize-none rounded-xl border border-black/10 bg-w px-3 py-2 text-xs leading-relaxed t-primary placeholder-neutral-400 focus:border-theme focus:ring-2 focus:ring-theme/20 outline-none dark:border-white/10"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-serif italic">
                      岁月不语 · 惟石能言 · 凝结每一次灵感火花
                    </span>
                    <button
                      type="submit"
                      disabled={chatLoading || !inputQuestion.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-theme px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-theme-hover disabled:opacity-50 transition"
                    >
                      <i className="ri-send-plane-fill" />
                      <span>发送</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Presets Mode (后台预设联动，支持直接选用预设与插入) */}
          {activeTab === "presets" && (
            <div className="flex flex-1 min-h-0 flex-col p-3.5 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                <span className="text-xs font-bold t-primary">后台提示词预设工坊 (实时联动)</span>
                <span className="text-[10px] text-neutral-400 font-mono">共 {promptPresets.length} 套预设</span>
              </div>

              <div className="space-y-2">
                {promptPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs t-primary">{preset.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setInputQuestion(preset.prompt);
                          setActiveTab("chat");
                          showToast("已将预设指令填入对话输入框！");
                        }}
                        className="px-2 py-0.5 rounded bg-theme/10 hover:bg-theme/20 text-theme text-[10px] font-bold transition"
                      >
                        调用此预设
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 font-mono leading-relaxed">
                      {preset.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Pipeline Mode */}
          {activeTab === "pipeline" && (
            <div className="flex flex-1 min-h-0 flex-col p-4 overflow-y-auto space-y-4">
              <div>
                <p className="text-xs font-bold t-primary mb-1">执行阶段勾选（默认不勾选，按需自由选择）：</p>
                <div className="space-y-2">
                  {[
                    { id: "tech", label: "1. 教程与命令提炼", desc: "重点排查命令行与配置代码块包裹" },
                    { id: "format", label: "2. 内容排版整理", desc: "规范标题层级与中英空格留白" },
                    { id: "summary", label: "3. 顶部 AI 摘要", desc: "提炼纯净独立摘要卡片" },
                  ].map((st) => {
                    const isChecked = pipelineStages.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition ${
                          isChecked
                            ? "border-theme bg-theme/5 shadow-2xs"
                            : "border-black/5 bg-black/[0.015] hover:border-black/10 dark:border-white/5"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePipelineStage(st.id)}
                          className="h-4 w-4 rounded accent-theme mt-0.5 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold ${isChecked ? "text-theme" : "t-primary"}`}>
                            {st.label}
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{st.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleRunPipeline}
                  disabled={pipelineLoading || !articleContent.trim() || pipelineStages.length === 0}
                  className="mt-3 w-full rounded-xl bg-theme py-2.5 text-xs font-bold text-white shadow-xs hover:bg-theme-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {pipelineLoading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      <span>正在按所选流程梳理文章中…</span>
                    </>
                  ) : (
                    <>
                      <i className="ri-magic-line" />
                      <span>立即开始梳理文章</span>
                    </>
                  )}
                </button>
              </div>

              {/* Pipeline Output Partitioning */}
              {pipelineResult && (
                <div className="space-y-3 pt-3 border-t border-black/5 dark:border-white/5 ani-show">
                  {/* Partition A: Summary */}
                  {pipelineResult.summary &&
                    !pipelineResult.summary.includes("请提供") &&
                    !pipelineResult.summary.includes("请发送") && (
                      <div className="rounded-xl border border-theme/30 bg-theme/5 p-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-theme flex items-center gap-1">
                            <i className="ri-file-text-line" />
                            <span>分区 A · AI 独立摘要</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(pipelineResult.summary || "");
                                showToast("已复制摘要纯文本！");
                              }}
                              className="rounded-md bg-w px-2 py-0.5 text-[10px] font-semibold text-theme border border-theme/20 shadow-2xs"
                            >
                              仅复制摘要
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (pipelineResult.summary) {
                                  onApplySummary(pipelineResult.summary);
                                  showToast("已填入文章简介！");
                                }
                              }}
                              className="rounded-md bg-theme px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs"
                            >
                              应用为简介
                            </button>
                          </div>
                        </div>
                        <p className="text-xs t-primary leading-relaxed bg-white/70 dark:bg-black/40 p-2 rounded-lg">
                          {pipelineResult.summary}
                        </p>
                      </div>
                    )}

                  {/* Partition B: Processed Content */}
                  <div className="rounded-xl border border-black/10 bg-neutral-50/70 p-3 dark:border-white/10 dark:bg-neutral-900/40 flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/5">
                      <span className="text-[11px] font-bold t-primary flex items-center gap-1">
                        <i className="ri-align-left text-theme" />
                        <span>分区 B · 排版正文纯文本</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pipelineResult.result);
                            showToast("已复制正文纯 Markdown！");
                          }}
                          className="rounded-md bg-w px-2 py-0.5 text-[10px] font-semibold t-primary border border-black/10 shadow-2xs hover:bg-neutral-100 dark:border-white/10"
                        >
                          仅复制正文
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onReplaceContent(pipelineResult.result);
                            showToast("已替换正文！可按 Ctrl+Z 撤销");
                          }}
                          className="rounded-md bg-theme px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs hover:bg-theme-hover"
                        >
                          替换正文
                        </button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto text-xs p-1">
                      <Markdown content={pipelineResult.result} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
}
