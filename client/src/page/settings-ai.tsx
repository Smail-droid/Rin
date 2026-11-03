import {
  DEFAULT_PROMPT_FORMAT,
  DEFAULT_PROMPT_SUMMARY,
  DEFAULT_PROMPT_TECH,
} from "@rin/config";
import {
  SearchableSelect,
} from "@rin/ui";
import * as Switch from "@radix-ui/react-switch";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog";
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

// 提示词多版本预设项规范 (支持多阶段、多版本自由组合切换)
export interface PromptPresetItem {
  id: string;
  name: string;
  stage: "tech" | "format" | "summary" | "custom";
  stageLabel: string;
  enabled: boolean;
  prompt: string;
}

const DEFAULT_PROMPT_PRESETS: PromptPresetItem[] = [
  {
    id: "preset_tech_std",
    name: "教程技术命令提炼 (标准极客版)",
    stage: "tech",
    stageLabel: "① 命令提炼",
    enabled: true,
    prompt: DEFAULT_PROMPT_TECH,
  },
  {
    id: "preset_format_std",
    name: "文章正文直接排版整理 (盘古空格+代码块修正)",
    stage: "format",
    stageLabel: "② 结构排版",
    enabled: true,
    prompt: DEFAULT_PROMPT_FORMAT,
  },
  {
    id: "preset_summary_std",
    name: "精炼置顶摘要生成 (50~100字高密导读)",
    stage: "summary",
    stageLabel: "③ 凝练摘要",
    enabled: true,
    prompt: DEFAULT_PROMPT_SUMMARY,
  },
  {
    id: "preset_custom_anime",
    name: "二次元随笔风趣评 (画廊美学定制版)",
    stage: "custom",
    stageLabel: "④ 随笔风格",
    enabled: false,
    prompt: "请以充满二次元微光美学的画廊随笔口吻，提炼本文最触动人心的 3 个技术或生活金句，语言灵动幽默。",
  },
];

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
  const { showAlert, AlertUI } = useAlert();
  const providerFields = getAIProviderFields(value.provider);

  // 提示词多版本预设库状态 (支持动态新增/选择/组合启用)
  const [promptPresets, setPromptPresets] = useState<PromptPresetItem[]>(() => {
    try {
      const saved = localStorage.getItem("rin_ai_prompt_presets");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_PROMPT_PRESETS;
  });

  const [editingPresetId, setEditingPresetId] = useState<string>("preset_tech_std");

  const savePresets = (next: PromptPresetItem[]) => {
    setPromptPresets(next);
    try {
      localStorage.setItem("rin_ai_prompt_presets", JSON.stringify(next));
    } catch {}

    // 同步更新启用的阶段至 value
    const enabledStagesList = next
      .filter((p) => p.enabled && p.stage !== "custom")
      .map((p) => p.stage);
    onChange({ pipelineStages: enabledStagesList.join(",") });
  };

  const handleTogglePreset = (id: string) => {
    const next = promptPresets.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    savePresets(next);
  };

  const handleAddCustomPreset = () => {
    const newId = `preset_custom_${Date.now()}`;
    const newItem: PromptPresetItem = {
      id: newId,
      name: `自定义提示词方案 #${promptPresets.length + 1}`,
      stage: "custom",
      stageLabel: `自定义`,
      enabled: true,
      prompt: "在此输入自定义提示词要求...",
    };
    const next = [...promptPresets, newItem];
    savePresets(next);
    setEditingPresetId(newId);
  };

  const handleDeletePreset = (id: string) => {
    if (promptPresets.length <= 1) {
      showAlert("请至少保留一个提示词预设方案！");
      return;
    }
    const next = promptPresets.filter((p) => p.id !== id);
    savePresets(next);
    if (editingPresetId === id) {
      setEditingPresetId(next[0].id);
    }
  };

  const currentEditingPreset = promptPresets.find((p) => p.id === editingPresetId) || promptPresets[0];

  const handlePromptTextChange = (text: string) => {
    const next = promptPresets.map((p) => (p.id === currentEditingPreset.id ? { ...p, prompt: text } : p));
    savePresets(next);

    // 同步到当前活动阶段的配置项中
    if (currentEditingPreset.stage === "tech") onChange({ promptTech: text });
    else if (currentEditingPreset.stage === "format") onChange({ promptFormat: text });
    else if (currentEditingPreset.stage === "summary") onChange({ promptSummary: text, systemPrompt: text });
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
    <div className="space-y-3.5 ani-show select-none">
      <div className="flex items-center gap-2 pb-1 border-b border-black/5 dark:border-white/5">
        <i className="ri-sparkling-fill text-theme" />
        <span className="font-bold text-xs uppercase tracking-wider text-theme">智能设置</span>
      </div>

      {/* 开关中枢 (单行紧凑左右排布，消除多余换行占据) */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold t-primary shrink-0">启用AI总结摘要</h3>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
            value.enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
          }`}>
            {value.enabled ? "流水线已就绪" : "已停用"}
          </span>
          <span className="text-xs text-neutral-400 truncate hidden lg:inline">
            · 智能调度大模型生成结构化导读与重点摘要
          </span>
        </div>
        <Switch.Root
          className="SwitchRoot shrink-0"
          checked={value.enabled}
          onCheckedChange={(checked) => {
            onChange({ enabled: checked });
          }}
        >
          <Switch.Thumb className="SwitchThumb" />
        </Switch.Root>
      </div>

      {value.enabled && (
        <>
          {/* AI 服务商与核心参数配置切片 (紧凑 2x2 网格) */}
          <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <span className="font-bold text-xs t-primary flex items-center gap-1.5">
                <i className="ri-cpu-line text-theme" />
                <span>模型接入与鉴权服务 (AI Provider)</span>
              </span>
              <span className="text-[11px] font-mono text-neutral-400">支持 OpenAI 兼容/Gemini/DeepSeek</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* 服务商 */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">AI 供应商</label>
                <SearchableSelect
                  value={value.provider}
                  onChange={handleProviderChange}
                  options={AI_PROVIDER_PRESETS.map((preset) => ({
                    label: preset.label,
                    value: preset.value,
                  }))}
                  placeholder="选择 AI 服务供应商"
                  searchable={false}
                />
              </div>

              {/* 模型 */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">模型名称 (Model)</label>
                <SearchableSelect
                  value={value.model}
                  onChange={(nextValue) => {
                    onChange({ model: nextValue });
                  }}
                  options={modelOptions.map((option) => ({
                    label: option,
                    value: option,
                  }))}
                  placeholder="选择或自定义模型名称"
                  searchPlaceholder="搜索模型..."
                  emptyLabel={t("no_more")}
                  allowCustomValue
                  customValueLabel={(nextValue) => `使用自定义: ${nextValue}`}
                />
              </div>

              {/* API 密钥 */}
              {providerFields.requiresApiKey && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">API 密钥 (API Key)</label>
                    {value.apiKeySet && (
                      <span className="text-[10px] font-mono text-emerald-500 font-bold">已配置</span>
                    )}
                  </div>
                  <input
                    type="password"
                    name="rin-ai-api-key"
                    autoComplete="new-password"
                    value={value.apiKey}
                    onChange={(event) => {
                      onChange({ apiKey: event.target.value });
                    }}
                    placeholder={value.apiKeySet ? "••••••••••••已安全存储••••••••••••" : "sk-..."}
                    className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3 py-2 text-xs t-primary outline-none focus:border-theme transition"
                  />
                </div>
              )}

              {/* API 端点 */}
              {providerFields.requiresApiUrl && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">接口服务端点 (API URL)</label>
                  <input
                    type="text"
                    value={value.apiUrl}
                    onChange={(event) => {
                      onChange({ apiUrl: event.target.value });
                    }}
                    placeholder="https://api.openai.com/v1"
                    className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3 py-2 text-xs font-mono t-primary outline-none focus:border-theme transition"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 提示词多版本预设工坊 (Dense DataGrid 超级表格，支持新增/勾选组合启用) */}
          <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <i className="ri-list-settings-line text-theme" />
                <h3 className="font-bold text-xs t-primary">AI 流水线多阶段提示词版本库 (Dense DataGrid)</h3>
              </div>
              <button
                type="button"
                onClick={handleAddCustomPreset}
                className="px-2.5 py-1 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold transition flex items-center gap-1 select-none"
              >
                <i className="ri-add-line text-xs" />
                <span>新增预设版本</span>
              </button>
            </div>

            {/* 提示词多版本超级表格 */}
            <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3 w-14 text-center">启用</th>
                    <th className="py-2.5 px-3 w-28">阶段定位</th>
                    <th className="py-2.5 px-3">预设版本名</th>
                    <th className="py-2.5 px-3 w-32 text-center">状态</th>
                    <th className="py-2.5 px-3 w-28 text-right pr-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {promptPresets.map((preset) => {
                    const isEditing = editingPresetId === preset.id;
                    return (
                      <tr
                        key={preset.id}
                        onClick={() => setEditingPresetId(preset.id)}
                        className={`cursor-pointer transition-colors ${
                          isEditing
                            ? "bg-theme/[0.06] dark:bg-theme/[0.1]"
                            : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={preset.enabled}
                            onChange={() => handleTogglePreset(preset.id)}
                            className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                            {preset.stageLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold t-primary">
                          <div className="flex items-center gap-1.5">
                            <span>{preset.name}</span>
                            {isEditing && (
                              <span className="text-[10px] text-theme font-mono font-normal">✍️ 正在编辑</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            preset.enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
                          }`}>
                            {preset.enabled ? "已入流水线" : "未开启"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPresetId(preset.id)}
                              className="text-theme hover:underline font-semibold text-xs"
                            >
                              编辑
                            </button>
                            {preset.stage === "custom" && (
                              <button
                                type="button"
                                onClick={() => handleDeletePreset(preset.id)}
                                className="text-neutral-400 hover:text-rose-500 transition text-xs"
                                title="删除此自定义预设"
                              >
                                <i className="ri-delete-bin-line" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 选中的提示词正文编辑区 */}
            {currentEditingPreset && (
              <div className="pt-2 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs t-primary">编辑指令内容：</span>
                    <input
                      type="text"
                      value={currentEditingPreset.name}
                      onChange={(e) => {
                        const next = promptPresets.map((p) => (p.id === currentEditingPreset.id ? { ...p, name: e.target.value } : p));
                        savePresets(next);
                      }}
                      className="text-xs font-semibold t-primary bg-black/[0.03] dark:bg-white/[0.04] px-2 py-0.5 rounded border border-black/10 dark:border-white/10 outline-none focus:border-theme max-w-xs"
                    />
                  </div>
                  {onSave && (
                    <button
                      type="button"
                      onClick={() => {
                        onSave();
                        showAlert("提示词已即时生效保存！");
                      }}
                      className="px-3 py-1 rounded-lg bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover transition"
                    >
                      保存提示词
                    </button>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={currentEditingPreset.prompt}
                  onChange={(e) => handlePromptTextChange(e.target.value)}
                  placeholder="在此输入专属提示词指令..."
                  className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] p-3 text-xs leading-relaxed t-primary outline-none focus:border-theme transition font-mono"
                />
              </div>
            )}
          </div>

          {/* 模型测试单行紧凑切片 (标注 2 解决) */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <i className="ri-speed-up-line text-theme" />
              <div>
                <span className="font-bold text-xs t-primary block">测试模型连通性</span>
                <span className="text-[11px] text-neutral-400">检测 AI 模型服务商与 API Key 是否可用</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              {testStatus === "testing" && <ReactLoading width="1rem" height="1rem" type="spin" color="#FC466B" />}
              {testStatus === "success" && (
                <span className="text-[11px] font-mono font-bold text-emerald-500">连接测试成功 ✓</span>
              )}
              {testStatus === "error" && (
                <span className="text-[11px] font-mono font-bold text-rose-500" title={testResult?.error || ""}>
                  测试失败 ✕
                </span>
              )}
              <button
                type="button"
                onClick={handleTestModel}
                disabled={testStatus === "testing"}
                className="px-3.5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
              >
                测试连接
              </button>
            </div>
          </div>
        </>
      )}
      <AlertUI />
    </div>
  );
}
