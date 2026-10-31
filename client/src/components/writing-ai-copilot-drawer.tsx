import { useState, useRef, useEffect } from "react";
import { client } from "../app/runtime";
import { Markdown } from "./markdown";

export type AICopilotMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export function WritingAICopilotDrawer({
  isOpen,
  onClose,
  articleContent,
  onInsertText,
  onReplaceContent,
  onApplySummary,
}: {
  isOpen: boolean;
  onClose: () => void;
  articleContent: string;
  onInsertText: (text: string) => void;
  onReplaceContent: (newContent: string) => void;
  onApplySummary: (summary: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"chat" | "pipeline">("chat");

  // Chat State
  const [messages, setMessages] = useState<AICopilotMessage[]>([
    {
      role: "assistant",
      content:
        "你好！我是你的 AI 写作副驾驶。你可以随时向我提问技术细节、查询代码配置、润色文章段落，或在右侧一键运行流水线梳理。",
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Pipeline State
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<{ result: string; summary?: string } | null>(null);
  const [copiedToast, setCopiedToast] = useState("");

  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(""), 2000);
  };

  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (customPrompt?: string) => {
    const query = (customPrompt || inputQuestion).trim();
    if (!query || chatLoading) return;

    const userMsg: AICopilotMessage = { role: "user", content: query };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!customPrompt) setInputQuestion("");
    setChatLoading(true);

    try {
      // 包含文章上下文作为辅助系统提示
      const contextPrefix = articleContent.trim().length > 0
        ? `当前博主正在编辑的文章内容如下（仅供参考）：\n\"\"\"\n${articleContent.slice(0, 4000)}\n\"\"\"\n\n`
        : "";

      const apiMessages = [
        {
          role: "system" as const,
          content: `${contextPrefix}你是一位博主专属的极客 AI 写作与代码副驾驶助手。请直接输出针对用户问题的专业、准确、干货答案与格式规范的代码块，无需过多客套套话。`,
        },
        ...nextMessages.filter((m) => m.role !== "system").map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const { data, error } = await client.config.chatAI({ messages: apiMessages });
      if (data?.success && data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
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
        showToast("✨ 流水线梳理就绪！可查看下方结果");
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
      {/* Drawer Overlay for Mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Floating Copilot Drawer */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 flex w-full sm:w-[440px] md:w-[480px] flex-col border-l border-black/10 bg-w/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 dark:border-white/10 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-theme/10 text-theme text-sm">
              <i className="ri-sparkling-fill" />
            </span>
            <div>
              <p className="text-sm font-bold t-primary">AI 创作副驾驶</p>
              <p className="text-[11px] text-neutral-400">实时边写边聊 · 代码查询与流水线梳理</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200"
              title="收起 AI 助手"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center border-b border-black/5 bg-black/[0.015] p-2 dark:border-white/5 dark:bg-white/[0.015]">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition ${
              activeTab === "chat"
                ? "bg-theme text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            <i className="ri-chat-smile-2-line" />
            <span>智能问答对话</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pipeline")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition ${
              activeTab === "pipeline"
                ? "bg-theme text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            <i className="ri-magic-line" />
            <span>流水线文章梳理</span>
          </button>
        </div>

        {/* Notification Toast */}
        {copiedToast && (
          <div className="mx-4 mt-2 rounded-xl bg-theme text-white px-3 py-1.5 text-xs font-semibold shadow-md text-center ani-show">
            {copiedToast}
          </div>
        )}

        {/* TAB 1: Chat Mode */}
        {activeTab === "chat" && (
          <div className="flex flex-1 min-h-0 flex-col">
            {/* Quick Prompts */}
            <div className="flex items-center gap-1.5 overflow-x-auto p-2.5 border-b border-black/5 text-[11px] scrollbar-none dark:border-white/5">
              {[
                "帮我写段命令行配置",
                "检查代码块是否闭合",
                "润色选中的段落",
                "提炼3个核心要点",
              ].map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => handleSendMessage(qp)}
                  className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-neutral-600 hover:bg-theme/10 hover:text-theme dark:bg-white/5 dark:text-neutral-300 transition"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col gap-1.5 ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 px-1">
                    <span>{msg.role === "user" ? "你" : "AI 助手"}</span>
                  </div>

                  <div
                    className={`group relative max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-theme text-white rounded-br-none"
                        : "bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-bl-none t-primary"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div>
                        <Markdown content={msg.content} />

                        {/* Action buttons on AI messages */}
                        <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              showToast("已复制到剪贴板！");
                            }}
                            className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
                            title="复制内容"
                          >
                            <i className="ri-file-copy-line mr-1" />
                            复制
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onInsertText(msg.content);
                              showToast("已插入到当前光标处！");
                            }}
                            className="rounded-lg bg-theme/10 text-theme px-2.5 py-0.5 text-[11px] font-semibold hover:bg-theme/20"
                            title="插入当前回答到编辑器"
                          >
                            <i className="ri-arrow-left-down-line mr-1" />
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
                  <i className="ri-loader-4-line animate-spin text-theme text-base" />
                  <span>AI 正在思考解答中…</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-black/5 dark:border-white/5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="随时向 AI 提问代码、命令或写作问题..."
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  disabled={chatLoading}
                  className="flex-1 rounded-xl border border-black/10 bg-w px-3.5 py-2 text-xs t-primary placeholder-neutral-400 focus:border-theme focus:ring-2 focus:ring-theme/20 outline-none dark:border-white/10"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !inputQuestion.trim()}
                  className="rounded-xl bg-theme px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-theme-hover disabled:opacity-50 transition shrink-0"
                >
                  <i className="ri-send-plane-fill" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: Pipeline Mode */}
        {activeTab === "pipeline" && (
          <div className="flex flex-1 min-h-0 flex-col p-4 overflow-y-auto space-y-4">
            <div>
              <p className="text-xs font-bold t-primary mb-1">执行阶段勾选（按需多选）：</p>
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
                    <span>正在依次梳理文章中…</span>
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
                {pipelineResult.summary && !pipelineResult.summary.includes("请提供") && !pipelineResult.summary.includes("请发送") && (
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
                          showToast("已替换正文！可按Ctrl+Z撤销");
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
    </>
  );
}
