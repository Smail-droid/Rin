import { ConfigWrapper } from "@rin/config";
import type { TFunction } from "i18next";
import { client, endpoint } from "../app/runtime";
import { defaultClientConfig, defaultServerConfig } from "../state/config";
import { headersWithAuth } from "../utils/auth";
import { emitToast } from "../utils/toast";

const MASKED_SECRET = "••••••••";

export type SettingsDraft = {
  clientConfig: Record<string, unknown>;
  serverConfig: Record<string, unknown>;
};
export type SettingsLoadState = {
  draft: SettingsDraft;
  hasStoredAiApiKey: boolean;
};

export const AI_PROVIDER_PRESETS = [
  { value: "worker-ai", label: "Cloudflare Worker AI (Free)", url: "", requiresApiKey: false, requiresApiUrl: false },
  { value: "openai", label: "OpenAI", url: "https://api.openai.com/v1", requiresApiKey: true, requiresApiUrl: true },
  { value: "claude", label: "Claude", url: "https://api.anthropic.com/v1", requiresApiKey: true, requiresApiUrl: true },
  { value: "gemini", label: "Gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai", requiresApiKey: true, requiresApiUrl: true },
  { value: "deepseek", label: "DeepSeek", url: "https://api.deepseek.com/v1", requiresApiKey: true, requiresApiUrl: true },
  { value: "zhipu", label: "Zhipu", url: "https://open.bigmodel.cn/api/paas/v4", requiresApiKey: true, requiresApiUrl: true },
] as const;

export const AI_MODEL_PRESETS: Record<string, string[]> = {
  "worker-ai": ["llama-3-8b", "llama-3-1-8b", "llama-2-7b", "mistral-7b", "mistral-7b-v2", "gemma-2b", "gemma-7b", "deepseek-coder", "qwen-7b"],
  openai: ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-pro", "gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5.1-codex-mini", "gpt-5-codex", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o3", "o3-mini", "o1", "o1-mini", "o1-preview"],
  claude: ["claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001", "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  gemini: ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-preview-09-2025", "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-preview-09-2025", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-exp", "gemini-2.0-flash-lite", "gemini-2.0-flash-lite-001", "gemini-1.5-pro", "gemini-1.5-flash"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  zhipu: ["glm-4.7", "glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4.5-airx", "glm-4.5-flash", "glm-4-long", "glm-4.6v", "glm-4.1v-thinking-flashx", "glm-4.6v-flash", "glm-4.1v-thinking-flash", "glm-4v-flash", "glm-4", "glm-4-plus", "glm-4-air", "glm-4-flash", "glm-4-flash-250414", "glm-4-flashx-250414", "glm-3-turbo"],
};

export function mergeSessionConfig(updates: Record<string, unknown>) {
  const currentConfig = sessionStorage.getItem("config");
  const parsedConfig = currentConfig ? JSON.parse(currentConfig) : {};
  sessionStorage.setItem("config", JSON.stringify({ ...parsedConfig, ...updates }));
}

export async function loadSettingsConfigState() {
  const response = await client.config.getAll();
  return normalizeSettingsState(response.data);
}

export async function saveSettingsConfigState(draft: SettingsDraft) {
  const response = await client.config.updateAll(draft);
  if (response.error) {
    throw new Error(typeof response.error.value === "string" ? response.error.value : "保存配置失败，请检查网络或权限");
  }
  return normalizeSettingsState(response.data);
}

export function normalizeSettingsState(
  data: SettingsDraft | null | undefined,
): SettingsLoadState {
  const clientConfig = { ...(data?.clientConfig ?? {}) };
  const serverConfig = { ...(data?.serverConfig ?? {}) };
  const hasStoredAiApiKey = serverConfig["ai_summary.api_key"] === MASKED_SECRET;

  if (hasStoredAiApiKey) {
    serverConfig["ai_summary.api_key"] = "";
  }

  return {
    draft: {
      clientConfig,
      serverConfig,
    },
    hasStoredAiApiKey,
  };
}

export function createSettingsConfigWrappers(draft: SettingsDraft) {
  return {
    clientConfig: new ConfigWrapper(draft.clientConfig, defaultClientConfig),
    serverConfig: new ConfigWrapper(draft.serverConfig, defaultServerConfig),
  };
}

export async function uploadFavicon(file: File, t: TFunction, showAlert: (message: string) => void): Promise<boolean> {
  const maxFileSize = 10 * 1024 * 1024;
  if (file.size > maxFileSize) {
    showAlert(t("upload.failed$size", { size: maxFileSize / 1024 / 1024 }));
    return false;
  }

  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${endpoint}/api/favicon`, {
    method: "POST",
    headers: headersWithAuth(),
    body: formData,
    credentials: "include",
  });

  if (response.ok) {
    emitToast(t("settings.favicon.update.success"), "success");
    return true;
  }

  showAlert(
    t("settings.favicon.update.failed$message", {
      message: response.statusText,
    }),
  );
  return false;
}

export async function importWordPressFile(file: File) {
  const xmlContent = await file.text();
  return client.wp.import(xmlContent);
}

export function buildAIConfigUpdates(updates: Record<string, unknown>) {
  const flatUpdates: Record<string, unknown> = {};
  if (updates.enabled !== undefined) flatUpdates["ai_summary.enabled"] = String(updates.enabled);
  if (updates.provider !== undefined) flatUpdates["ai_summary.provider"] = updates.provider;
  if (updates.model !== undefined) flatUpdates["ai_summary.model"] = updates.model;

  const apiUrl = updates.apiUrl !== undefined ? updates.apiUrl : updates.api_url;
  if (apiUrl !== undefined) flatUpdates["ai_summary.api_url"] = apiUrl;

  const apiKey = updates.apiKey !== undefined ? updates.apiKey : updates.api_key;
  if (apiKey !== undefined) flatUpdates["ai_summary.api_key"] = apiKey;

  const systemPrompt = updates.systemPrompt !== undefined ? updates.systemPrompt : updates.system_prompt;
  if (systemPrompt !== undefined) flatUpdates["ai_summary.system_prompt"] = systemPrompt;

  const pipelineStages = updates.pipelineStages !== undefined ? updates.pipelineStages : updates.pipeline_stages;
  if (pipelineStages !== undefined) flatUpdates["ai_summary.pipeline_stages"] = pipelineStages;

  const promptTech = updates.promptTech !== undefined ? updates.promptTech : updates.prompt_tech;
  if (promptTech !== undefined) flatUpdates["ai_summary.prompt_tech"] = promptTech;

  const promptFormat = updates.promptFormat !== undefined ? updates.promptFormat : updates.prompt_format;
  if (promptFormat !== undefined) flatUpdates["ai_summary.prompt_format"] = promptFormat;

  const promptSummary = updates.promptSummary !== undefined ? updates.promptSummary : updates.prompt_summary;
  if (promptSummary !== undefined) flatUpdates["ai_summary.prompt_summary"] = promptSummary;

  const promptPresets = updates.promptPresets !== undefined ? updates.promptPresets : updates.prompt_presets;
  if (promptPresets !== undefined) {
    flatUpdates["ai_summary.prompt_presets"] =
      typeof promptPresets === "string" ? promptPresets : JSON.stringify(promptPresets);
  }

  return flatUpdates;
}

function normalizePromptPresetsString(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) || (raw && typeof raw === "object")) return JSON.stringify(raw);
  return "";
}

export function buildAITestRequest({
  provider,
  model,
  apiUrl,
  apiKey,
}: {
  provider: string;
  model: string;
  apiUrl: string;
  apiKey: string;
}) {
  const preset = AI_PROVIDER_PRESETS.find((item) => item.value === provider);
  const requestBody: Record<string, string> = { provider, model };

  if (provider !== "worker-ai" && (apiUrl || preset?.url)) {
    requestBody.api_url = apiUrl || preset?.url || "";
  }
  if (apiKey.trim()) {
    requestBody.api_key = apiKey.trim();
  }

  return requestBody;
}

export function getAIProviderPreset(provider: string) {
  return AI_PROVIDER_PRESETS.find((item) => item.value === provider);
}

export function getAIProviderFields(provider: string) {
  const preset = getAIProviderPreset(provider);

  return {
    requiresApiKey: preset?.requiresApiKey ?? true,
    requiresApiUrl: preset?.requiresApiUrl ?? true,
  };
}

export function updateDraftConfig(
  draft: SettingsDraft,
  type: "client" | "server",
  key: string,
  value: unknown,
): SettingsDraft {
  return {
    ...draft,
    [type === "client" ? "clientConfig" : "serverConfig"]: {
      ...draft[type === "client" ? "clientConfig" : "serverConfig"],
      [key]: value,
    },
  };
}

export function buildAIConfigDraftValue(
  draft: SettingsDraft,
  hasStoredAiApiKey: boolean,
) {
  const serverConfig = draft.serverConfig;

  return {
    enabled: serverConfig["ai_summary.enabled"] === true || serverConfig["ai_summary.enabled"] === "true",
    provider: String(serverConfig["ai_summary.provider"] ?? "openai"),
    model: String(serverConfig["ai_summary.model"] ?? "gpt-4o-mini"),
    apiKey: String(serverConfig["ai_summary.api_key"] ?? ""),
    apiKeySet: hasStoredAiApiKey || String(serverConfig["ai_summary.api_key"] ?? "").trim().length > 0,
    apiUrl: String(serverConfig["ai_summary.api_url"] ?? ""),
    systemPrompt: String(serverConfig["ai_summary.system_prompt"] ?? ""),
    pipelineStages: String(serverConfig["ai_summary.pipeline_stages"] ?? "tech,format,summary"),
    promptTech: String(serverConfig["ai_summary.prompt_tech"] ?? ""),
    promptFormat: String(serverConfig["ai_summary.prompt_format"] ?? ""),
    promptSummary: String(serverConfig["ai_summary.prompt_summary"] ?? ""),
    promptPresets: normalizePromptPresetsString(serverConfig["ai_summary.prompt_presets"]),
  };
}

export function areSettingsDraftsEqual(left: SettingsDraft, right: SettingsDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}
