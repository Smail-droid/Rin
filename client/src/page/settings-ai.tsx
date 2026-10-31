import {
  DEFAULT_PROMPT_FORMAT,
  DEFAULT_PROMPT_SUMMARY,
  DEFAULT_PROMPT_TECH,
} from "@rin/config";
import {
  SearchableSelect,
  SettingsBadge,
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
  SettingsCardRow,
} from "@rin/ui";
import * as Switch from "@radix-ui/react-switch";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog";
import { ItemTitle } from "./settings-items";
import {
  AI_MODEL_PRESETS,
  AI_PROVIDER_PRESETS,
  buildAITestRequest,
  getAIProviderFields,
  getAIProviderPreset,
} from "./settings-helpers";

export type AISettingsValue = {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string;
  apiKeySet: boolean;
  apiUrl: string;
  systemPrompt?: string;
  pipelineStages?: string;
  promptTech?: string;
  promptFormat?: string;
  promptSummary?: string;
};

export function AISummarySettings({
  value,
  onChange,
  onSave,
}: {
  value: AISettingsValue;
  onChange: (updates: Partial<AISettingsValue>) => void;
  onSave?: () => void;
}) {
  const { t } = useTranslation();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ success?: boolean; response?: string; error?: string; details?: string } | null>(null);
  const [activeStage, setActiveStage] = useState<"tech" | "format" | "summary">("tech");
  const { showAlert, AlertUI } = useAlert();
  const providerFields = getAIProviderFields(value.provider);

  const enabledStages = useMemo(() => {
    const raw = value.pipelineStages || "tech,format,summary";
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }, [value.pipelineStages]);

  const toggleStage = (stageId: "tech" | "format" | "summary") => {
    const current = new Set(enabledStages);
    if (current.has(stageId)) {
      current.delete(stageId);
    } else {
      current.add(stageId);
    }
    const order: ("tech" | "format" | "summary")[] = ["tech", "format", "summary"];
    const sorted = order.filter((s) => current.has(s));
    onChange({ pipelineStages: sorted.join(",") });
  };

  const getCurrentStagePrompt = () => {
    if (activeStage === "tech") return value.promptTech ?? DEFAULT_PROMPT_TECH;
    if (activeStage === "format") return value.promptFormat ?? DEFAULT_PROMPT_FORMAT;
    return value.promptSummary || value.systemPrompt || DEFAULT_PROMPT_SUMMARY;
  };

  const handleCurrentStagePromptChange = (newPrompt: string) => {
    if (activeStage === "tech") onChange({ promptTech: newPrompt });
    else if (activeStage === "format") onChange({ promptFormat: newPrompt });
    else {
      onChange({ promptSummary: newPrompt, systemPrompt: newPrompt });
    }
  };

  const handleResetCurrentStagePrompt = () => {
    if (activeStage === "tech") onChange({ promptTech: DEFAULT_PROMPT_TECH });
    else if (activeStage === "format") onChange({ promptFormat: DEFAULT_PROMPT_FORMAT });
    else onChange({ promptSummary: DEFAULT_PROMPT_SUMMARY, systemPrompt: DEFAULT_PROMPT_SUMMARY });
  };

  const handleProviderChange = (nextProvider: string) => {
    const preset = getAIProviderPreset(nextProvider);
    const models = AI_MODEL_PRESETS[nextProvider] || [];

    onChange({
      provider: nextProvider,
      apiUrl: preset?.url ?? "",
      model: models[0] ?? value.model,
    });
  };

  const handleTestModel = async () => {
    setTestStatus("testing");
    setTestResult(null);
    try {
      const requestBody = buildAITestRequest({
        provider: value.provider,
        model: value.model,
        apiUrl: value.apiUrl,
        apiKey: value.apiKey,
      });
      const { data, error } = await client.config.testAI(requestBody);

      if (error) {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: error.value || t("settings.ai_summary.test.failed"),
          details: t("settings.ai_summary.test.http_error$status", { status: error.status }),
        });
      } else if (data?.success) {
        setTestStatus("success");
        setTestResult({
          success: true,
          response: data.response || t("settings.ai_summary.test.success"),
        });
      } else {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: data?.error || t("settings.ai_summary.test.failed"),
          details: data?.details,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestStatus("error");
      setTestResult({
        success: false,
        error: message || t("settings.ai_summary.test.error"),
      });
    }
  };

  const modelOptions = AI_MODEL_PRESETS[value.provider] || [];

  return (
    <>
      <ItemTitle title={t("settings.ai_summary.title")} />
      <SettingsCard>
        <SettingsCardRow
          header={<SettingsCardHeader title={t("settings.ai_summary.enable.title")} description={t("settings.ai_summary.enable.desc")} />}
          action={
            <Switch.Root
              className="SwitchRoot"
              checked={value.enabled}
              onCheckedChange={(checked) => {
                onChange({ enabled: checked });
              }}
            >
              <Switch.Thumb className="SwitchThumb" />
            </Switch.Root>
          }
        />
      </SettingsCard>

      {value.enabled && (
        <>
          <SettingsCard>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.ai_summary.provider.title")} description={t("settings.ai_summary.provider.desc")} />}
              action={
                <SearchableSelect
                  value={value.provider}
                  onChange={handleProviderChange}
                  options={AI_PROVIDER_PRESETS.map((preset) => ({
                    label: preset.label,
                    value: preset.value,
                  }))}
                  placeholder={t("settings.ai_summary.provider.title")}
                  searchable={false}
                />
              }
            />
            <SettingsCardBody>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium t-primary">{t("settings.ai_summary.model.title")}</p>
                  <SearchableSelect
                    value={value.model}
                    onChange={(nextValue) => {
                      onChange({ model: nextValue });
                    }}
                    options={modelOptions.map((option) => ({
                      label: option,
                      value: option,
                    }))}
                    placeholder={t("settings.ai_summary.model.desc")}
                    searchPlaceholder={t("settings.ai_summary.model.desc")}
                    emptyLabel={t("no_more")}
                    allowCustomValue
                    customValueLabel={(nextValue) => `${t("update.title")}: ${nextValue}`}
                  />
                </div>
                {providerFields.requiresApiKey ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium t-primary">
                      {t("settings.ai_summary.api_key.title")}
                      {value.apiKeySet && (
                        <span className="ml-2">
                          <SettingsBadge tone="success">{t("settings.ai_summary.api_key.set")}</SettingsBadge>
                        </span>
                      )}
                    </p>
                    <input
                      type="password"
                      name="rin-ai-api-key"
                      autoComplete="new-password"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={value.apiKey}
                      onChange={(event) => {
                        onChange({ apiKey: event.target.value });
                      }}
                      placeholder={value.apiKeySet ? t("settings.ai_summary.api_key.placeholder_set") : "sk-..."}
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                    />
                  </div>
                ) : null}
                {providerFields.requiresApiUrl ? (
                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm font-medium t-primary">{t("settings.ai_summary.api_url.title")}</p>
                    <input
                      type="text"
                      value={value.apiUrl}
                      onChange={(event) => {
                        onChange({ apiUrl: event.target.value });
                      }}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                    />
                  </div>
                ) : null}
              </div>
            </SettingsCardBody>
          </SettingsCard>

          {/* AI Multi-Stage Pipeline Workflow & Prompts Customization */}
          <SettingsCard>
            <SettingsCardRow
              header={
                <SettingsCardHeader
                  title="AI 智能流水线多阶段处理流程（Pipeline）"
                  description="支持复选开启 3 大处理流程，发布或梳理时按严格顺序自动执行：1. 提炼教程命令 ➔ 2. 正文结构排版 ➔ 3. 顶部输出精炼摘要"
                />
              }
              action={<div />}
            />
            <SettingsCardBody>
              <div className="flex flex-col gap-4">
                {/* 3 Steps Multi-select Pipeline Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold t-primary">流水线阶段勾选（支持复选多选，点击卡片切换查看与编辑该阶段提示词）：</p>
                    <span className="text-[11px] text-theme font-medium">
                      已启用 {enabledStages.length} / 3 个流水线阶段
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Step 1: Tech Tutorial Extraction */}
                    <div
                      onClick={() => setActiveStage("tech")}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all flex flex-col justify-between ${
                        activeStage === "tech"
                          ? "border-theme bg-theme/5 shadow-xs ring-1 ring-theme"
                          : "border-black/10 bg-black/[0.015] hover:border-black/20 dark:border-white/10 dark:bg-white/[0.02]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-[11px]">1</span>
                            <span>教程与命令提炼</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={enabledStages.includes("tech")}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleStage("tech");
                            }}
                            className="h-4 w-4 cursor-pointer rounded accent-theme"
                            title="勾选此阶段"
                          />
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                          优先提取命令核心步骤、环境配置与避坑排查，规范代码块包裹
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                        <span className={enabledStages.includes("tech") ? "text-theme font-semibold" : "text-neutral-400"}>
                          {enabledStages.includes("tech") ? "✓ 已加入流水线" : "未开启"}
                        </span>
                        {activeStage === "tech" && (
                          <span className="text-neutral-400 font-mono text-[10px]">正在编辑 ✍️</span>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Content Formatting */}
                    <div
                      onClick={() => setActiveStage("format")}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all flex flex-col justify-between ${
                        activeStage === "format"
                          ? "border-theme bg-theme/5 shadow-xs ring-1 ring-theme"
                          : "border-black/10 bg-black/[0.015] hover:border-black/20 dark:border-white/10 dark:bg-white/[0.02]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-[11px]">2</span>
                            <span>内容直接排版整理</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={enabledStages.includes("format")}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleStage("format");
                            }}
                            className="h-4 w-4 cursor-pointer rounded accent-theme"
                            title="勾选此阶段"
                          />
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                          梳理多级标题架构、盘古之白空格、修正所有未闭合代码块
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                        <span className={enabledStages.includes("format") ? "text-theme font-semibold" : "text-neutral-400"}>
                          {enabledStages.includes("format") ? "✓ 已加入流水线" : "未开启"}
                        </span>
                        {activeStage === "format" && (
                          <span className="text-neutral-400 font-mono text-[10px]">正在编辑 ✍️</span>
                        )}
                      </div>
                    </div>

                    {/* Step 3: Executive Summary */}
                    <div
                      onClick={() => setActiveStage("summary")}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all flex flex-col justify-between ${
                        activeStage === "summary"
                          ? "border-theme bg-theme/5 shadow-xs ring-1 ring-theme"
                          : "border-black/10 bg-black/[0.015] hover:border-black/20 dark:border-white/10 dark:bg-white/[0.02]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 text-[11px]">3</span>
                            <span>精炼置顶摘要生成</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={enabledStages.includes("summary")}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleStage("summary");
                            }}
                            className="h-4 w-4 cursor-pointer rounded accent-theme"
                            title="勾选此阶段"
                          />
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                          在文章修正完毕后，在最顶部输出 50~100 字凝练的 AI 摘要
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                        <span className={enabledStages.includes("summary") ? "text-theme font-semibold" : "text-neutral-400"}>
                          {enabledStages.includes("summary") ? "✓ 已加入流水线" : "未开启"}
                        </span>
                        {activeStage === "summary" && (
                          <span className="text-neutral-400 font-mono text-[10px]">正在编辑 ✍️</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prompt Editor for Selected Stage */}
                <div className="space-y-2 pt-3 border-t border-black/5 dark:border-white/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold t-primary">
                        正在编辑：
                        {activeStage === "tech"
                          ? "【阶段 1: 技术教程与命令提炼】系统提示词"
                          : activeStage === "format"
                          ? "【阶段 2: 文章内容直接排版整理】系统提示词"
                          : "【阶段 3: 精炼置顶摘要生成】系统提示词"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetCurrentStagePrompt}
                        className="text-xs text-neutral-500 hover:text-theme transition"
                      >
                        恢复此阶段默认提示词
                      </button>
                      {onSave && (
                        <button
                          type="button"
                          onClick={() => {
                            onSave();
                            showAlert("当前阶段提示词已成功保存！");
                          }}
                          className="rounded-lg bg-theme px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-theme-hover transition"
                        >
                          保存提示词
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={getCurrentStagePrompt()}
                    onChange={(e) => handleCurrentStagePromptChange(e.target.value)}
                    placeholder="在此输入专属提示词指令..."
                    className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm leading-relaxed t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-theme focus:ring-2 focus:ring-theme/10 dark:border-white/10"
                  />
                  <p className="text-[11px] text-neutral-400">
                    💡 提示：您可以为每个阶段单独存放专属的提示词；当发布或梳理文章时，系统会按 1 ➔ 2 ➔ 3 的顺序将文章流经已勾选的阶段进行处理。
                  </p>
                </div>
              </div>
            </SettingsCardBody>
          </SettingsCard>

          <SettingsCard tone={testStatus === "error" ? "danger" : testStatus === "success" ? "success" : "default"}>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.ai_summary.test.title")} description={t("settings.ai_summary.test.desc")} />}
              action={
                <>
                  {testStatus === "testing" && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                  <Button
                    title={t("settings.ai_summary.test.button")}
                    onClick={handleTestModel}
                    disabled={testStatus === "testing"}
                  />
                </>
              }
            />
            {testStatus === "success" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t("settings.ai_summary.test.success")}</p>
                <p className="mt-1 text-sm text-green-700/90 dark:text-green-300/90">{testResult.response}</p>
              </SettingsCardBody>
            )}
            {testStatus === "error" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("settings.ai_summary.test.failed")}</p>
                {testResult.error && <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{testResult.error}</p>}
                {testResult.details && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{testResult.details}</p>}
                {!testResult.error && !testResult.details && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">{JSON.stringify(testResult)}</p>
                )}
              </SettingsCardBody>
            )}
          </SettingsCard>
        </>
      )}
      <AlertUI />
    </>
  );
}
