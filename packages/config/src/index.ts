import type { AIConfig } from "@rin/api";

export const WEBHOOK_URL_KEY = "WEBHOOK_URL";

export const CLIENT_CONFIG_DEFAULTS = new Map(
  Object.entries({
    "cache.enabled": false,
    "counter.enabled": true,
    "friend_apply_enable": true,
    "header.behavior": "fixed",
    "header.layout": "classic",
    "feed.layout": "list",
    "feed.card_variant": "default",
    "theme.color": "#fc466b",
    "theme.opacity": 100,
    "theme.preset": "sakura",
    "theme.custom_color_enabled": false,
    "atelier.about_icon": "🐾",
    "atelier.title_style": "aurora_flow",
    "atelier.timeline_icon": "⏳",
    "atelier.moments_icon": "💭",
    "atelier.friends_icon": "🌸",
    "atelier.search_icon": "🔍",
    "atelier.deck_icon": "🎴",
    "gallery.padding": 24,
    "gallery.columns": "auto",
    "gallery.align": "center",
    "gallery.card_size": "medium",
    "gallery.card_max_width": 380,
    "gallery.card_gap": 24,
    "comment.enabled": true,
    "login.enabled": true,
    "site.name": "Rin",
    "site.description": "A lightweight personal blogging system",
    "site.avatar": "",
    "site.page_size": 5,
  }),
);

export const SERVER_CONFIG_DEFAULTS = new Map(
  Object.entries({
    friend_apply_auto_accept: false,
    friend_crontab: true,
    friend_ua: "Rin-Check/0.1.0",
    "webhook.method": "POST",
    "webhook.content_type": "application/json",
    "webhook.headers": "{}",
    "webhook.body_template": "{\"content\":\"{{message}}\"}",
  }),
);

export const CLIENT_CONFIG_ENV_DEFAULTS: Record<string, string> = {
  "site.name": "NAME",
  "site.description": "DESCRIPTION",
  "site.avatar": "AVATAR",
  "site.page_size": "PAGE_SIZE",
};

export const AI_CONFIG_PREFIX = "ai_summary.";

export const DEFAULT_PROMPT_TECH =
  "你是一位资深技术架构师与教程提炼专家。请对输入的笔记或教程内容进行技术提炼：\n1. 提炼核心执行命令与配置文件（关键代码必须使用 ```bash 或对应语言代码块完整包裹）；\n2. 提炼环境依赖与关键避坑要点；\n3. 输出逻辑严密、排版规整的技术实操指南，保持原文核心语义。";

export const DEFAULT_PROMPT_FORMAT =
  "你是一位资深博客排版与内容编辑专家。请对输入文章进行内容排版与结构化梳理：\n1. 规范标题层级结构（从二级标题 ## 开始，层级清晰递进）；\n2. 规范中英文混排空格（盘古之白）、标点符号及专有名词大小写；\n3. 提炼核心技术要点，保持段落呼吸留白；\n4. 重点检查并修复所有 ```bash 或其它语言代码块的开闭包裹，杜绝溢出与未闭合；\n5. 输出格式规整、阅读体验极佳的完整 Markdown 正文。";

export const DEFAULT_AI_SYSTEM_PROMPT =
  "你是一位资深博客内容提炼助手。请用凝练、自然、通顺的中文提炼文章核心内容，严格控制在50~100字之间且仅输出单段纯文本，严禁包含标题、序号或项目符号；首句禁止出现“本文介绍了”、“作者阐述了”等套话，直接切入核心背景或问题，提炼具体方案与最终结论，严格忠于原文且不添加未提及的信息。";

export const DEFAULT_PROMPT_SUMMARY = DEFAULT_AI_SYSTEM_PROMPT;

export const DEFAULT_PIPELINE_STAGES = ["tech", "format", "summary"] as const;

export const SENSITIVE_SERVER_CONFIG_FIELDS = [`${AI_CONFIG_PREFIX}api_key`] as const;

export const AI_CONFIG_KEYS = [
  `${AI_CONFIG_PREFIX}enabled`,
  `${AI_CONFIG_PREFIX}provider`,
  `${AI_CONFIG_PREFIX}model`,
  `${AI_CONFIG_PREFIX}api_key`,
  `${AI_CONFIG_PREFIX}api_url`,
  `${AI_CONFIG_PREFIX}system_prompt`,
  `${AI_CONFIG_PREFIX}pipeline_stages`,
  `${AI_CONFIG_PREFIX}prompt_tech`,
  `${AI_CONFIG_PREFIX}prompt_format`,
  `${AI_CONFIG_PREFIX}prompt_summary`,
] as const;

export const DEFAULT_AI_PROMPT_PRESETS = [
  {
    id: "summary",
    name: "精炼摘要 (默认)",
    description: "凝练生动的核心要点摘要，适于文章卡片预览",
    prompt: DEFAULT_AI_SYSTEM_PROMPT,
  },
  {
    id: "structure",
    name: "文章内容直接排版整理",
    description: "结构化梳理文章层次、规范中英排版、修复代码块包裹",
    prompt:
      "你是一位资深博客排版与内容编辑专家。请对输入文章进行内容排版与结构优化：\n1. 规范标题层级结构（从二级标题开始，层级清晰递进）；\n2. 规范中英文混排空格、标点符号及专有名词大小写；\n3. 提取并高亮核心技术要点，保持段落呼吸留白；\n4. 重点检查并修复所有 ```bash 或其它语言代码块的开闭包裹，杜绝溢出与未闭合；\n5. 输出格式规整、阅读体验极佳的完整 Markdown。",
  },
  {
    id: "tech_tutorial",
    name: "技术教程与命令提炼",
    description: "提炼核心命令行步骤、环境配置与避坑指南",
    prompt:
      "你是一位资深技术布道师与架构师。请将输入文章整理提炼为高质量的技术实战速查手册：\n1. 明确目标与适用环境；\n2. 提取核心操作命令与配置文件（使用 ```bash 等代码块清晰包裹）；\n3. 提炼关键避坑要点与常见报错排查步骤；\n4. 总结最终验证测试命令。",
  },
];

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  provider: "openai",
  model: "gpt-4o-mini",
  api_key: "",
  api_url: "https://api.openai.com/v1",
  system_prompt: "",
  pipeline_stages: "tech,format,summary",
  prompt_tech: DEFAULT_PROMPT_TECH,
  prompt_format: DEFAULT_PROMPT_FORMAT,
  prompt_summary: DEFAULT_PROMPT_SUMMARY,
};

export class ConfigWrapper {
  config: Record<string, unknown>;
  defaultConfig: Map<string, unknown>;

  constructor(config: Record<string, unknown>, defaultConfig: Map<string, unknown>) {
    this.config = config;
    this.defaultConfig = defaultConfig;
  }

  get<T>(key: string) {
    const value = this.config[key];
    if (value !== undefined && value !== "") {
      return value as T;
    }
    if (this.defaultConfig.has(key)) {
      return this.defaultConfig.get(key) as T;
    }
    return undefined;
  }

  default<T>(key: string) {
    return this.defaultConfig.get(key) as T;
  }

  getBoolean(key: string) {
    const value = this.get<unknown>(key);

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();

      if (normalizedValue === "true") {
        return true;
      }

      if (normalizedValue === "false") {
        return false;
      }
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return Boolean(value);
  }
}
