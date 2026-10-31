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
};

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

export const AI_SUMMARY_SYSTEM_PROMPT =
    "你是一位资深博客内容提炼助手。请用凝练、自然、通顺的中文提炼文章核心内容，严格控制在50~100字之间且仅输出单段纯文本，严禁包含标题、序号或项目符号；首句禁止出现“本文介绍了”、“作者阐述了”等套话，直接切入核心背景或问题，提炼具体方案与最终结论，严格忠于原文且不添加未提及的信息。";

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
        .replace(/\/chat\/completions$/i, "");
}

export function buildExternalAIChatCompletionsUrl(
    provider: string,
    apiUrl: string,
): string {
    const normalizedApiUrl = normalizeExternalAIBaseUrl(apiUrl || AI_PROVIDER_URLS[provider] || "");
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

/**
 * Execute external AI API request
 */
async function executeExternalAI(
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
            max_tokens: 500,
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

    // 清理掉之前可能残留在正文顶部的任何硬插标记，确保正文纯净不与系统卡片冲突
    processedContent = processedContent.replace(/^>\s*\[!NOTE\]\s*\n>\s*\*\*AI\s*摘要\*\*：[^\n]*\n+/g, "").trimStart();

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

    if (originalMessage.includes('fetch failed') || originalMessage.includes('NetworkError')) {
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
