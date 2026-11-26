import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { emitToast } from "../utils/toast";
import { AISummarySettings, type AISettingsValue } from "./settings-ai";
import {
  areSettingsDraftsEqual,
  buildAIConfigDraftValue,
  buildAIConfigUpdates,
  loadSettingsConfigState,
  saveSettingsConfigState,
  type SettingsDraft,
  updateDraftConfig,
} from "./settings-helpers";

export function AdminAIPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [initialDraft, setInitialDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [hasStoredAiApiKey, setHasStoredAiApiKey] = useState(false);
  const [savedProvider, setSavedProvider] = useState<string>("openai");

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadSettingsConfigState()
      .then((state) => {
        setDraft(state.draft);
        setInitialDraft(state.draft);
        setHasStoredAiApiKey(state.hasStoredAiApiKey);
        setSavedProvider(String(state.draft.serverConfig["ai_summary.provider"] ?? "openai"));
      })
      .catch((err) => showAlert(err.message))
      .finally(() => setLoading(false));
  }, [showAlert]);

  const aiValue = buildAIConfigDraftValue(draft, hasStoredAiApiKey);
  const isDirty = !areSettingsDraftsEqual(draft, initialDraft);

  const handleAIChange = (updates: Partial<AISettingsValue>) => {
    const flatUpdates = buildAIConfigUpdates(updates);
    setSaveStatus("idle");
    setDraft((curr) => {
      let next = curr;
      for (const [key, value] of Object.entries(flatUpdates)) {
        next = updateDraftConfig(next, "server", key, value);
      }
      return next;
    });
  };

  const handleReset = () => {
    setSaveStatus("idle");
    setDraft(initialDraft);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("saving");
    try {
      const state = await saveSettingsConfigState(draft);
      setDraft(state.draft);
      setInitialDraft(state.draft);
      setHasStoredAiApiKey(Boolean(state.hasStoredAiApiKey || (aiValue.apiKey && aiValue.apiKey.trim().length > 0)));
      setSavedProvider(String(state.draft.serverConfig["ai_summary.provider"] ?? aiValue.provider));
      setSaveStatus("saved");
      emitToast("AI 配置已保存并生效", "success");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus((curr) => (curr === "saved" ? "idle" : curr));
      }, 2500);
    } catch (err: any) {
      setSaveStatus("error");
      showAlert(err.message || "保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{`AI 智能配置与提示词定制 - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-col gap-4">
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb)/0.92)] px-4 py-2.5 shadow-2xs backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs text-[rgb(var(--rin-ink-muted-rgb))]">
            <i className="ri-sparkling-2-line text-theme text-base" />
            <span className="font-semibold text-[rgb(var(--rin-ink-rgb))]">AI 模型与提示词工作台</span>
            {isDirty ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>未保存</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {saveStatus === "saved" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                已保存 ✓
              </span>
            )}
            {isDirty && !saving && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
              >
                重置
              </button>
            )}
            <Button
              title={saving ? "保存中…" : saveStatus === "saved" ? "已保存 ✓" : "保存"}
              onClick={handleSave}
              disabled={loading || saving}
              className="py-2 px-5 shadow-sm text-xs font-bold"
            />
          </div>
        </div>

        {/* AI Main Body */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-xs text-[rgb(var(--rin-ink-muted-rgb))]">
            <i className="ri-loader-4-line animate-spin text-xl text-theme" />
            <span>正在读取 AI 配置…</span>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <AISummarySettings value={aiValue} savedProvider={savedProvider} onChange={handleAIChange} />
          </div>
        )}
      </div>

      <AlertUI />
    </>
  );
}
