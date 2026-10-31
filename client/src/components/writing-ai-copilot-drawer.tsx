import { useState, useRef, useEffect } from "react";
import { client } from "../app/runtime";
import { Markdown } from "./markdown";

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
    name: "极客架构师",
    icon: "ri-terminal-box-line",
    tagline: "命令排查 · 配置调优 · 零废话",
    systemInstruction:
      "你是一位顶尖 Linux/Cloudflare/全栈技术架构师。请以精简干练的硬核风格回答技术问题：直接给出准确的代码块或命令行（必须使用 ```bash 或对应语言包裹），绝对严禁任何客套话、车轱辘话与AI口水式扩写，只输出关键要点、配置步骤与避坑说明。",
  },
  {
    id: "editor_polisher",
    name: "金牌排版润色",
    icon: "ri-edit-line",
    tagline: "中英空格 · 语法润色 · 结构清晰",
    systemInstruction:
      "你是一位资深中文技术博客编辑。请对文本进行排版润色：规范标题层级结构、严格执行中英文混排空格（盘古之白）、修正标点符号与专业名词大小写，保持文意准确，严禁堆砌辞藻与空洞长篇扩写。",
  },
  {
    id: "security_auditor",
    name: "命令与代码审查",
    icon: "ri-shield-check-line",
    tagline: "代码排查 · 命令语法 · 漏洞预警",
    systemInstruction:
      "你是一位代码安全与命令审核专家。请深度审查输入代码与命令：重点排查括号与引号是否闭合、是否有未转义的特殊字符、是否缺少权限 sudo、是否存在安全隐患，并直接给出修正后的准确版本。",
  },
  {
    id: "brainstorm_expert",
    name: "博客创意灵感",
    icon: "ri-lightbulb-line",
    tagline: "大纲提炼 · 金句总结 · 视角创新",
    systemInstruction:
      "你是一位高口碑技术博主顾问。请为博主提供新颖的文章大纲、切入视角、画龙点睛的总结金句与关键要点，条理清晰，观点鲜明，杜绝套话。",
  },
];

// 二次元萌系猫娘看板娘专属矢量 Avatar
function AnimeChibiAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-11 w-11" : size === "md" ? "h-9 w-9" : "h-7 w-7";
  return (
    <div className={`relative ${dim} shrink-0 select-none`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        {/* Cat Ears */}
        <path d="M 20 40 L 10 10 L 40 25 Z" fill="#fc466b" />
        <path d="M 23 35 L 18 18 L 36 26 Z" fill="#ffd1dc" />
        <path d="M 80 40 L 90 10 L 60 25 Z" fill="#fc466b" />
        <path d="M 77 35 L 82 18 L 64 26 Z" fill="#ffd1dc" />
        {/* Head Base */}
        <circle cx="50" cy="55" r="38" fill="#fff5f7" stroke="#fc466b" strokeWidth="2.5" />
        {/* Bangs */}
        <path d="M 18 45 Q 35 32 50 48 Q 65 32 82 45 Q 75 30 50 28 Q 25 30 18 45 Z" fill="#ffb6c1" />
        {/* Eyes (Anime Sparkle) */}
        <ellipse cx="36" cy="56" rx="5" ry="7" fill="#4a0e2e" />
        <circle cx="34" cy="54" r="2.2" fill="#ffffff" />
        <ellipse cx="64" cy="56" rx="5" ry="7" fill="#4a0e2e" />
        <circle cx="62" cy="54" r="2.2" fill="#ffffff" />
        {/* Blush */}
        <ellipse cx="26" cy="62" rx="4.5" ry="2.5" fill="#ff8da1" opacity="0.7" />
        <ellipse cx="74" cy="62" rx="4.5" ry="2.5" fill="#ff8da1" opacity="0.7" />
        {/* Smile */}
        <path d="M 46 63 Q 50 67 54 63" fill="none" stroke="#4a0e2e" strokeWidth="2" strokeLinecap="round" />
        {/* Ribbon Star */}
        <path d="M 72 26 L 76 22 L 78 27 L 82 28 L 78 30 L 76 35 L 73 31 L 68 30 Z" fill="#ffd700" />
      </svg>
    </div>
  );
}

export function WritingAICopilotDrawer({
  isOpen,
  onClose,
  onToggle,
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
  const [activeTab, setActiveTab] = useState<"chat" | "pipeline">("chat");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("tech_architect");

  // Chat State
  const [messages, setMessages] = useState<AICopilotMessage[]>([
    {
      role: "assistant",
      content:
        "喵呜~ 主人好！我是您的专属 AI 萌娘创作伴侣。已开启【纯硬核技术干货】模式，严禁任何废话套话。您可以随时在下方提问命令、配置、代码漏洞或排版梳理。",
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
      {/* 1. 左下角常驻二次元萌系看板娘触发球 (不遮挡主编辑区) */}
      <div className="fixed left-4 sm:left-6 bottom-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (onToggle) onToggle();
          }}
          className={`group flex items-center gap-2 rounded-full p-1.5 pr-4 shadow-2xl transition-all duration-300 border-2 select-none ${
            isOpen
              ? "bg-theme text-white border-white dark:border-neutral-800 scale-105 ring-4 ring-theme/30"
              : "bg-w/95 text-theme border-theme/40 hover:border-theme hover:bg-theme/10 hover:scale-105 dark:border-white/20 backdrop-blur-md"
          }`}
          title="点击展开/收回 AI 萌宠助手"
        >
          <AnimeChibiAvatar size="md" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold leading-tight flex items-center gap-1">
              <span>AI 萌娘伴侣</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-300 leading-tight">
              {isOpen ? "点击收起 (-)" : "点击咨询代码"}
            </span>
          </div>
        </button>

        {!isOpen && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 text-[11px] text-neutral-400 backdrop-blur-md border border-black/5 dark:border-white/5 ani-show">
            <span>随时提问代码与排版</span>
          </div>
        )}
      </div>

      {/* 2. 左下角现代化二次元画廊风浮窗 (支持最小化收回，不挡右侧编辑) */}
      {isOpen && (
        <aside
          className="fixed left-4 sm:left-6 bottom-20 z-50 flex w-[430px] max-w-[94vw] h-[600px] max-h-[82vh] flex-col rounded-3xl border border-black/10 bg-w/98 shadow-2xl backdrop-blur-2xl transition-all duration-300 dark:border-white/10 ani-show overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.015]">
            <div className="flex items-center gap-2.5">
              <AnimeChibiAvatar size="sm" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-extrabold t-primary">{activePersona.name}</p>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                    在线
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
          <div className="flex items-center border-b border-black/5 p-1.5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1 text-xs font-semibold transition ${
                activeTab === "chat"
                  ? "bg-theme text-white shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <i className="ri-chat-smile-2-line" />
              <span>萌娘对话</span>
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
              <span>流水线梳理</span>
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
                    <span className="text-[10px] text-neutral-400">
                      💡 拒绝 AI 泔水文扩写 · 输出核心干货
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

          {/* TAB 2: Pipeline Mode */}
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
