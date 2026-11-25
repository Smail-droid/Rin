import type { AIConfig } from "@rin/api";
import {
    DEFAULT_PROMPT_FORMAT,
    DEFAULT_PROMPT_SUMMARY,
    DEFAULT_PROMPT_TECH,
} from "@rin/config";
import { getAIConfig } from "./db-config";

type ConfigReader = {
    get(key: string): Promise<unknown>;
};

// AI Provider presets with their default API URLs
const AI_PROVIDER_URLS: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    claude: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    deepseek: "https://api.deepseek.com/v1",
    zhipu: "https://open.bigmodel.cn/api/paas/v4",
};

const ANTHROPIC_VERSION = "2023-06-01";

// Cloudflare Worker AI models mapping (short name -> full model ID)
export const WORKER_AI_MODELS: Record<string, string> = {
    "llama-3-8b": "@cf/meta/llama-3-8b-instruct",
    "llama-3-1-8b": "@cf/meta/llama-3.1-8b-instruct",
    "llama-2-7b": "@cf/meta/llama-2-7b-chat-int8",
    "mistral-7b": "@cf/mistral/mistral-7b-instruct-v0.1",
    "mistral-7b-v2": "@cf/mistral/mistral-7b-instruct-v0.2-lora",
    "gemma-2b": "@cf/google/gemma-2b-it-lora",
    "gemma-7b": "@cf/google/gemma-7b-it-lora",
    "deepseek-coder": "@cf/deepseek-ai/deepseek-coder-6.7b-base-awq",
    "qwen-7b": "@cf/qwen/qwen1.5-7b-chat-awq",
};

export const AI_SUMMARY_SYSTEM_PROMPT = DEFAULT_PROMPT_SUMMARY;

/**
 * Get full Worker AI model ID from short name
 */
export function getWorkerAIModelId(shortName: string): string {
    return WORKER_AI_MODELS[shortName] || shortName;
}

export function normalizeExternalAIBaseUrl(apiUrl: string): string {
    return apiUrl
        .trim()
        .replace(/\/+$/g, "")
        .replace(/\/chat\/completions$/i, "")
        .replace(/\/messages$/i, "");
}

export function isAnthropicNativeEndpoint(provider: string, apiUrl: string): boolean {
    const trimmed = (apiUrl || AI_PROVIDER_URLS[provider] || "").trim().replace(/\/+$/g, "");
    if (!trimmed) {
        return provider === "claude";
    }
    const lower = trimmed.toLowerCase();
    if (/\/chat\/completions$/i.test(lower) || lower.includes("/openai") || lower.includes("openrouter.ai")) {
        return false;
    }
    if (lower.includes("anthropic.com") || /\/messages$/i.test(lower)) {
        return true;
    }
    return provider === "claude";
}

export function isGeminiNativeEndpoint(provider: string, apiUrl: string): boolean {
    const trimmed = (apiUrl || AI_PROVIDER_URLS[provider] || "").trim().replace(/\/+$/g, "");
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (lower.includes("/openai") || /\/chat\/completions$/i.test(lower)) {
        return false;
    }
    return (provider === "gemini" || lower.includes("generativelanguage.googleapis.com"))
        && /\/v\d+(beta)?(\/models.*)?$/i.test(lower);
}

export function normalizeModelsEndpoint(provider: string, apiUrl?: string): string {
    const rawBase = (apiUrl || AI_PROVIDER_URLS[provider] || AI_PROVIDER_URLS.openai).trim().replace(/\/+$/, "");
    if (!rawBase) {
        return `${AI_PROVIDER_URLS.openai}/models`;
    }
    if (/\/chat\/completions$/i.test(rawBase)) {
        return rawBase.replace(/\/chat\/completions$/i, "/models");
    }
    if (/\/messages$/i.test(rawBase)) {
        return rawBase.replace(/\/messages$/i, "/models");
    }
    if (/\/models$/i.test(rawBase)) {
        return rawBase;
    }
    if (/\/v\d+(beta)?(\/openai)?$/i.test(rawBase)) {
        return `${rawBase}/models`;
    }
    if (provider === "claude" && rawBase.includes("anthropic.com")) {
        return `${rawBase}/v1/models`;
    }
    return `${rawBase}/v1/models`;
}

export function buildExternalAIChatCompletionsUrl(
    provider: string,
    apiUrl: string,
): string {
    const rawUrl = (apiUrl || AI_PROVIDER_URLS[provider] || "").trim().replace(/\/+$/g, "");
    if (!rawUrl) {
        throw new Error("API URL not configured");
    }

    if (isAnthropicNativeEndpoint(provider, rawUrl)) {
        const base = normalizeExternalAIBaseUrl(rawUrl);
        if (/\/v\d+(beta)?$/i.test(base) || /\/anthropic/i.test(base)) {
            return `${base}/messages`;
        }
        try {
            const parsed = new URL(base);
            if (parsed.pathname === "" || parsed.pathname === "/") {
                return `${base}/v1/messages`;
            }
        } catch {}
        return `${base}/messages`;
    }

    const normalizedApiUrl = normalizeExternalAIBaseUrl(rawUrl);
    if (!normalizedApiUrl) {
        throw new Error("API URL not configured");
    }

    return `${normalizedApiUrl}/chat/completions`;
}

function extractAIText(response: unknown): string | null {
    if (typeof response === "string") {
        return response;
    }

    if (!response || typeof response !== "object") {
        return null;
    }

    const responseObj = response as Record<string, any>;

    if (typeof responseObj.response === "string") return responseObj.response;
    if (typeof responseObj.content === "string") return responseObj.content;
    if (typeof responseObj.output === "string") return responseObj.output;
    if (typeof responseObj.result === "string") return responseObj.result;

    const messageContent = responseObj.choices?.[0]?.message?.content;
    if (typeof messageContent === "string" && messageContent.trim()) {
        return messageContent.trim();
    }

    const outputText = responseObj.output?.[0]?.content?.[0]?.text;
    if (typeof outputText === "string" && outputText.trim()) {
        return outputText.trim();
    }

    return null;
}

/**
 * Execute Worker AI request
 */
async function executeWorkerAI(
    env: Env,
    modelId: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<string | null> {
    if (!env.AI || typeof env.AI.run !== "function") {
        throw new Error("Workers AI binding is not configured");
    }

    // Worker AI uses messages format for chat models
    const response = await env.AI.run(modelId as any, {
        messages
    } as any);

    return extractAIText(response);
}

function extractAnthropicText(data: any): string | null {
    if (!data || !Array.isArray(data.content)) {
        return null;
    }
    const textBlock = data.content.find((block: any) => block?.type === "text" && typeof block.text === "string");
    if (textBlock) {
        return textBlock.text.trim() || null;
    }
    const fallbackText = data.content[0]?.text;
    return typeof fallbackText === "string" ? fallbackText.trim() || null : null;
}

/**
 * Execute external AI API request
 */
export async function executeExternalAI(
    config: {
        provider: string;
        model: string;
        api_key: string;
        api_url: string;
    },
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<string | null> {
    const { provider, model, api_key, api_url } = config;

    if (!api_key) {
        throw new Error("API key not configured");
    }

    if (isAnthropicNativeEndpoint(provider, api_url)) {
        const finalApiUrl = buildExternalAIChatCompletionsUrl(provider, api_url);
        const systemParts = messages
            .filter((m) => m.role === "system")
            .map((m) => m.content.trim())
            .filter(Boolean);
        const nonSystemMessages = messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content }));
        const payloadMessages = nonSystemMessages.length > 0
            ? nonSystemMessages
            : [{ role: "user" as const, content: systemParts.join("\n\n") || "Hello" }];

        const response = await fetch(finalApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                temperature: 0.3,
                ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
                messages: payloadMessages,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const data = await response.json() as any;
        return extractAnthropicText(data);
    }

    if (isGeminiNativeEndpoint(provider, api_url)) {
        const base = normalizeExternalAIBaseUrl(api_url).replace(/\/models.*$/i, "");
        const finalApiUrl = `${base}/models/${encodeURIComponent(model)}:generateContent`;
        const systemParts = messages
            .filter((m) => m.role === "system")
            .map((m) => m.content.trim())
            .filter(Boolean);
        const contents = messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            }));

        const response = await fetch(finalApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            body: JSON.stringify({
                ...(systemParts.length > 0
                    ? { systemInstruction: { parts: [{ text: systemParts.join("\n\n") }] } }
                    : {}),
                contents,
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const data = await response.json() as any;
        const text = data.candidates?.[0]?.content?.parts
            ?.map((part: any) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
            .trim();
        return text || null;
    }

    const finalApiUrl = buildExternalAIChatCompletionsUrl(provider, api_url);

    const response = await fetch(finalApiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${api_key}`,
        },
        body: JSON.stringify({
            model: model,
            messages,
            max_tokens: 1024,
            temperature: 0.3,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * Test AI model configuration
 */
export async function testAIModel(
    env: Env,
    config: {
        provider: string;
        model: string;
        api_key?: string;
        api_url?: string;
    },
    testPrompt: string
): Promise<{ success: boolean; response?: string; error?: string; details?: string }> {
    try {
        let result: string | null;

        if (config.provider === 'worker-ai') {
            const fullModelName = getWorkerAIModelId(config.model);
            console.log(`[Test AI] Using Worker AI model: ${fullModelName}`);
            result = await executeWorkerAI(env, fullModelName, [
                { role: "user", content: testPrompt },
            ]);
        } else {
            result = await executeExternalAI({
                provider: config.provider,
                model: config.model,
                api_key: config.api_key || '',
                api_url: config.api_url || '',
            }, [
                { role: "user", content: testPrompt },
            ]);
        }

        if (result) {
            return { 
                success: true, 
                response: result,
            };
        } else {
            return { 
                success: false, 
                error: 'Empty response from AI' 
            };
        }
    } catch (error: any) {
        return processAIError(error, config.model, config.provider);
    }
}

/**
 * Generate AI summary for article content
 */
export async function generateAISummary(
    env: Env, 
    serverConfig: ConfigReader,
    content: string
): Promise<string | null> {
    const result = await generateAISummaryResult(env, serverConfig, content);
    return result.summary;
}

export async function generateAISummaryResult(
    env: Env,
    serverConfig: ConfigReader,
    content: string
): Promise<{ summary: string | null; skipped: boolean; error?: string }> {
    const config = await getAIConfig(serverConfig);

    if (!config.enabled) {
        return { summary: null, skipped: true };
    }

    const { provider, model } = config;
    const maxContentLength = 8000;
    const truncatedContent = content.length > maxContentLength
        ? content.slice(0, maxContentLength) + "..."
        : content;
    const summaryPrompt = (config.prompt_summary && config.prompt_summary.trim().length > 0)
        ? config.prompt_summary.trim()
        : (config.system_prompt && config.system_prompt.trim().length > 0)
            ? config.system_prompt.trim()
            : AI_SUMMARY_SYSTEM_PROMPT;

    const summaryMessages = [
        { role: "system" as const, content: summaryPrompt },
        { role: "user" as const, content: truncatedContent },
    ];

    try {
        let result: string | null;

        if (provider === 'worker-ai') {
            const fullModelName = getWorkerAIModelId(model);
            result = await executeWorkerAI(
                env,
                fullModelName,
                summaryMessages,
            );
        } else {
            result = await executeExternalAI(config, summaryMessages);
        }

        if (!result || !result.trim()) {
            return {
                summary: null,
                skipped: false,
                error: `Empty response from AI provider "${provider}" using model "${model}"`,
            };
        }

        const cleaned = stripReasoningTags(result);
        if (!cleaned.trim()) {
            return {
                summary: null,
                skipped: false,
                error: `AI response contained only reasoning tags with no final answer (provider "${provider}", model "${model}")`,
            };
        }

        return { summary: cleaned, skipped: false };
    } catch (error) {
        console.error("[AI Summary] Failed to generate summary:", error);
        return {
            summary: null,
            skipped: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Execute multi-turn AI Chat conversation for the writing assistant drawer
 */
export async function executeAIChat(
    env: Env,
    serverConfig: ConfigReader,
    messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<{ success: boolean; reply: string; error?: string }> {
    const config = await getAIConfig(serverConfig);
    if (!config.enabled) {
        return { success: false, reply: "", error: "AI 服务尚未开启，请先在后台 AI 助手开启并配置" };
    }

    const { provider, model } = config;
    try {
        let result: string | null = null;
        if (provider === "worker-ai") {
            const fullModelName = getWorkerAIModelId(model);
            result = await executeWorkerAI(env, fullModelName, messages);
        } else {
            result = await executeExternalAI(config, messages);
        }
        if (!result || !result.trim()) {
            return { success: false, reply: "", error: "AI 服务返回为空" };
        }
        const cleaned = stripReasoningTags(result);
        return { success: true, reply: cleaned.trim() };
    } catch (err: any) {
        const processed = processAIError(err, model, provider);
        return {
            success: false,
            reply: "",
            error: `${processed.error}: ${processed.details || err.message || String(err)}`,
        };
    }
}

/**
 * Execute a single prompt call with the configured AI provider
 */
async function callAIOnce(
    env: Env,
    config: AIConfig,
    systemPrompt: string,
    userText: string
): Promise<string | null> {
    const { provider, model } = config;
    const maxContentLength = 8000;
    const truncatedContent = userText.length > maxContentLength
        ? userText.slice(0, maxContentLength) + "..."
        : userText;
    const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: truncatedContent },
    ];
    let result: string | null = null;
    if (provider === "worker-ai") {
        const fullModelName = getWorkerAIModelId(model);
        result = await executeWorkerAI(env, fullModelName, messages);
    } else {
        result = await executeExternalAI(config, messages);
    }
    if (!result) return null;
    const cleaned = stripReasoningTags(result);
    return cleaned.trim() || null;
}

/**
 * Run multi-stage AI Pipeline process on article content
 * Stages in order: 1. tech -> 2. format -> 3. summary
 */
export async function runAIPipelineProcess(
    env: Env,
    serverConfig: ConfigReader,
    content: string,
    requestedStages?: string[]
): Promise<{ success: boolean; result: string; summary?: string; error?: string }> {
    const config = await getAIConfig(serverConfig);
    if (!config.enabled) {
        return { success: false, result: content, error: "AI 服务尚未开启，请先在后台 AI 助手开启并配置" };
    }

    const stages = requestedStages && requestedStages.length > 0
        ? requestedStages
        : (config.pipeline_stages || "tech,format,summary").split(",").map((s) => s.trim()).filter(Boolean);

    let processedContent = content;
    let summaryText = "";

    try {
        // 阶段 1: 技术教程与命令提炼
        if (stages.includes("tech")) {
            const prompt = (config.prompt_tech && config.prompt_tech.trim().length > 0)
                ? config.prompt_tech.trim()
                : (DEFAULT_PROMPT_TECH as string);
            const res = await callAIOnce(env, config, prompt, processedContent);
            if (res) processedContent = res;
        }

        // 阶段 2: 文章内容直接排版整理
        if (stages.includes("format")) {
            const prompt = (config.prompt_format && config.prompt_format.trim().length > 0)
                ? config.prompt_format.trim()
                : (DEFAULT_PROMPT_FORMAT as string);
            const res = await callAIOnce(env, config, prompt, processedContent);
            if (res) processedContent = res;
        }

        // 阶段 3: 精炼置顶摘要生成（生成纯净摘要文本，供系统 AI Summary 卡片展示，正文保持纯净，绝不强插重复内容）
        if (stages.includes("summary")) {
            const prompt = (config.prompt_summary && config.prompt_summary.trim().length > 0)
                ? config.prompt_summary.trim()
                : (config.system_prompt && config.system_prompt.trim().length > 0)
                    ? config.system_prompt.trim()
                    : (DEFAULT_PROMPT_SUMMARY as string);
            const res = await callAIOnce(env, config, prompt, processedContent);
            if (res) {
                summaryText = res.trim();
            }
        }
    } catch (err: any) {
        const processed = processAIError(err, config.model, config.provider);
        return {
            success: false,
            result: content,
            error: `${processed.error}: ${processed.details || err.message || String(err)}`,
        };
    }

    // 清理掉之前可能残留在正文顶部的任何硬插标记，确保正文纯净不与系统卡片冲突
    processedContent = processedContent.replace(/^>\s*\[!NOTE\]\s*\n>\s*\*\*(?:AI\s*摘要|导读)\*\*：[^\n]*\n+/g, "").trimStart();

    return {
        success: true,
        result: processedContent,
        summary: summaryText,
    };
}

export function stripReasoningTags(text: string): string {
    if (!text) return "";

    let out = text;
    out = out.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think\s*>/gi, "");
    out = out.replace(/<think(?:\s[^>]*)?>[\s\S]*$/gi, "");
    out = out.replace(/<thinking(?:\s[^>]*)?>[\s\S]*?<\/thinking\s*>/gi, "");
    out = out.replace(/<thinking(?:\s[^>]*)?>[\s\S]*$/gi, "");
    out = out.replace(/<reasoning(?:\s[^>]*)?>[\s\S]*?<\/reasoning\s*>/gi, "");
    out = out.replace(/<reasoning(?:\s[^>]*)?>[\s\S]*$/gi, "");

    return out.trim();
}

/**
 * Process AI error and return user-friendly message
 */
function processAIError(
    error: any, 
    model: string, 
    provider: string
): { success: false; error: string; details?: string } {
    const originalMessage = error.message || 'Unknown error';
    console.error('[AI] Error:', error);

    let errorMessage = originalMessage;
    let errorDetails = '';

    if (originalMessage.includes('User location is not supported') || originalMessage.includes('FAILED_PRECONDITION')) {
        errorMessage = 'Google Gemini 地区限制 (User location is not supported)';
        errorDetails = 'Google Gemini 官方接口在当前网络区域不可用。解决办法：1. 在后台【AI 助手】中将 API URL 改为反向代理/中转网关地址；或 2. 切换为 DeepSeek、OpenAI 或内置免费的 Cloudflare Worker AI 模型。';
    } else if (originalMessage.includes('fetch failed') || originalMessage.includes('NetworkError')) {
        errorMessage = 'Network error: Unable to connect to AI service';
        errorDetails = 'Please check your API URL and network connection.';
    } else if (originalMessage.includes('Workers AI binding is not configured')) {
        errorMessage = 'Workers AI is not configured';
        errorDetails = 'Add the Cloudflare Workers AI binding before testing the worker-ai provider.';
    } else if (originalMessage.includes('401') || originalMessage.includes('Unauthorized')) {
        errorMessage = 'Authentication failed: Invalid API key';
        errorDetails = 'Please check your API key is correct and not expired.';
    } else if (originalMessage.includes('429')) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'Too many requests. Please wait a moment.';
    } else if (originalMessage.includes('404')) {
        errorMessage = 'Model not found';
        errorDetails = `Model "${model}" not found for provider "${provider}".`;
    } else if (originalMessage.includes('500') || originalMessage.includes('503')) {
        errorMessage = 'AI service temporarily unavailable';
        errorDetails = 'Service is experiencing issues. Please try again later.';
    } else if (originalMessage.includes('Invalid')) {
        errorMessage = `AI model error: ${originalMessage}`;
        errorDetails = `Model "${model}" may not be supported. Please verify the model ID.`;
    }

    return { 
        success: false, 
        error: errorMessage,
        details: errorDetails || `Original: ${originalMessage}`
    };
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(provider: string): string[] {
    if (provider === 'worker-ai') {
        return Object.keys(WORKER_AI_MODELS);
    }
    return [];
}

/**
 * Check if provider requires API key
 */
export function requiresApiKey(provider: string): boolean {
    return provider !== 'worker-ai';
}

/**
 * Fetch remote model list from OpenAI-compatible /models endpoint
 */
export async function fetchExternalAIModels(
    provider: string,
    apiUrl?: string,
    apiKey?: string
): Promise<string[]> {
    if (provider === "worker-ai") {
        return Object.keys(WORKER_AI_MODELS);
    }

    const cleanApiKey = (apiKey || "").trim().replace(/^["']|["']$/g, "");
    if (!cleanApiKey) {
        throw new Error("请先填写 API Key");
    }

    const effectiveUrl = (apiUrl || AI_PROVIDER_URLS[provider] || AI_PROVIDER_URLS.openai).trim();
    const endpoint = normalizeModelsEndpoint(provider, effectiveUrl);
    const useAnthropicHeaders = isAnthropicNativeEndpoint(provider, effectiveUrl);
    const useGeminiNativeHeaders = isGeminiNativeEndpoint(provider, effectiveUrl);

    const headers: Record<string, string> = useAnthropicHeaders
        ? {
            "x-api-key": cleanApiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        }
        : useGeminiNativeHeaders
            ? {
                "x-goog-api-key": cleanApiKey,
                "Content-Type": "application/json",
            }
            : {
                Authorization: `Bearer ${cleanApiKey}`,
                "Content-Type": "application/json",
            };

    let res = await fetch(endpoint, {
        headers,
        signal: AbortSignal.timeout(15000),
    });

    // Clean fallback for custom Claude relays that speak OpenAI-style Bearer on /models
    if (
        !res.ok &&
        useAnthropicHeaders &&
        !effectiveUrl.toLowerCase().includes("anthropic.com") &&
        (res.status === 400 || res.status === 401 || res.status === 403)
    ) {
        res = await fetch(endpoint, {
            headers: {
                Authorization: `Bearer ${cleanApiKey}`,
                "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(15000),
        });
    }

    // Fallback for Gemini OpenAI-compat URL -> native v1beta/models with x-goog-api-key
    let usedGeminiNativeFallback = false;
    if (
        !res.ok &&
        provider === "gemini" &&
        !useGeminiNativeHeaders &&
        effectiveUrl.toLowerCase().includes("generativelanguage.googleapis.com") &&
        (res.status === 400 || res.status === 401 || res.status === 404)
    ) {
        const nativeRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
            headers: {
                "x-goog-api-key": cleanApiKey,
                "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(15000),
        });
        if (nativeRes.ok) {
            res = nativeRes;
            usedGeminiNativeFallback = true;
        }
    }

    if (!res.ok) {
        const text = await res.text();
        if (/Please pass a valid API key|API_KEY_INVALID|invalid_api_key/i.test(text) || res.status === 401) {
            throw new Error(`HTTP ${res.status}: API Key 无效或与当前服务商不匹配，请在「API 密钥」框重新输入有效密钥后再拉取`);
        }
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 150)}`);
    }

    const json = (await res.json()) as any;
    const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];
    const models = rawList
        .map((item: any) => {
            const rawId = typeof item === "string" ? item : item.id || item.name;
            if (typeof rawId !== "string") return "";
            return (useGeminiNativeHeaders || usedGeminiNativeFallback) ? rawId.replace(/^models\//, "") : rawId;
        })
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b));

    if (models.length === 0) {
        throw new Error("接口未返回任何可用模型");
    }

    return models;
}
