import { Spinner } from "@rin/ui";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { AISummarySettings, type AISettingsValue } from "./settings-ai";
import {
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
  const [draft, setDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [hasStoredAiApiKey, setHasStoredAiApiKey] = useState(false);

  useEffect(() => {
    loadSettingsConfigState()
      .then((state) => {
        setDraft(state.draft);
        setHasStoredAiApiKey(state.hasStoredAiApiKey);
      })
      .catch((err) => showAlert(err.message))
      .finally(() => setLoading(false));
  }, [showAlert]);

  const aiValue = buildAIConfigDraftValue(draft, hasStoredAiApiKey);

  const handleAIChange = (updates: Partial<AISettingsValue>) => {
    const flatUpdates = buildAIConfigUpdates(updates);
    setDraft((curr) => {
      let next = curr;
      for (const [key, value] of Object.entries(flatUpdates)) {
        next = updateDraftConfig(next, "server", key, value);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const state = await saveSettingsConfigState(draft);
      setDraft(state.draft);
      setHasStoredAiApiKey(Boolean(state.hasStoredAiApiKey || (aiValue.apiKey && aiValue.apiKey.trim().length > 0)));
      showAlert("AI 配置与提示词保存成功！");
    } catch (err: any) {
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

      <div className="flex flex-col gap-6">
        {/* Page Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/5 dark:border-white/5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme/10 text-theme text-xs font-bold mb-1">
              <i className="ri-robot-2-line" />
              <span>大模型智能中心</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold t-primary">AI 智能配置与提示词预设</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              配置 AI 模型服务商与系统指令，支持内容精炼总结、文章自动排版整理与多提示词预设切换
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Button
              title={saving ? "保存中…" : "保存 AI 配置"}
              onClick={handleSave}
              disabled={loading || saving}
              className="py-2.5 px-6 shadow-sm"
            />
          </div>
        </div>

        {/* AI Main Body */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Spinner size="2rem" label="正在读取 AI 配置…" />
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <AISummarySettings value={aiValue} onChange={handleAIChange} onSave={handleSave} />
          </div>
        )}
      </div>

      <AlertUI />
    </>
  );
}
