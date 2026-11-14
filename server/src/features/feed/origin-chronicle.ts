import { eq } from "drizzle-orm";
import type { DB } from "../../core/hono-types";
import { feeds } from "../../db/schema";
import { bindTagToPost } from "../../services/tag";
import { clearFeedCollectionCaches } from "../../services/clear-feed-cache";
import { executeAIChat } from "../../utils/ai";

type ConfigReader = {
    get<T = any>(key: string): Promise<T | undefined>;
    getOrDefault<T = any>(key: string, defaultValue: T): Promise<T>;
};

export interface ChronicleRequestOptions {
    slug: string;
    pageTitle: string;
    description?: string;
    highlights?: string[];
    draft?: boolean;
    forceRegenerate?: boolean;
}

export function getChronicleAlias(slug: string): string {
    const clean = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return `origins-${clean}`;
}

export async function findChronicleBySlug(db: DB, slug: string) {
    const alias = getChronicleAlias(slug);
    return db.query.feeds.findFirst({
        where: eq(feeds.alias, alias),
        with: {
            hashtags: {
                columns: {},
                with: {
                    hashtag: { columns: { id: true, name: true } },
                },
            },
        },
    });
}

/**
 * 经典高质开发手记模版（当 AI 服务未开启或离线时的高保真自愈兜底）
 */
function buildFallbackChronicleMarkdown(options: ChronicleRequestOptions): string {
    const { slug, pageTitle, description, highlights = [] } = options;
    const highlightList = highlights.length > 0
        ? highlights.map(h => `- 💎 **${h}**`).join("\n")
        : [
            "- 💎 **边缘自托管与解耦**：彻底与主站繁重逻辑解耦，随时可拆卸、可插拔",
            "- 🌸 **二次元微光与高密平衡**：粉白温润渐变质感与单屏超级数据网格并存",
            "- ⚡ **零冷启动边缘性能**：借助 Cloudflare 边缘计算实现全栈毫秒级响应",
        ].join("\n");

    return `> **“一页一世界”** —— 画廊博客不仅仅是一座阅读站点，更是所有自托管边缘微服务的观察站与集结母舰。

---

### 🪐 1. 诞生初衷与设计哲学

在构建「${pageTitle}」这一模块之初，我们拒绝千篇一律的千站一面，更拒绝死板僵化的单体大泥球架构。
我们的核心愿景是：**每一个页面都是一个独立自洽的“小世界”**。
${description || `围绕 ${pageTitle} 展开的自托管实践，旨在探索个人云原生环境下的自由表达。`}

---

### ⚡ 2. 核心架构与工程亮点

${highlightList}

- **数据持久化契约**：依托 Cloudflare D1 边缘数据库与 R2 高性能对象存储，实现低延迟无服务器调度；
- **配置驱动呈现**：核心排版、密度、动效完全由配置中枢动态解耦，让代码回归纯粹；
- **自闭环测试防御**：遵守严谨的类型契约与自动化测试门禁，保障长青稳定。

---

### 🛡️ 3. 踩坑复盘与架构护栏

在模块的推进过程中，我们沉淀下了不可动摇的工程守则：
1. **拒绝伪自动化**：杜绝盲目修改代码后把开发者当成人肉测试员，必须在后台建立端到端验证闭环；
2. **严防隐性耦合**：严禁子模块擅自跨边界侵入主核心实现细节，保持接口干净透明；
3. **保护用户心血**：用户手动定制的个性化数据（简介、标题、排版偏好）具有最高权威，任何更正机制绝不可覆盖。

---

### 🌸 4. 展望：微世界的未来生长

「${pageTitle}」作为一个可插拔的世界卡带（Cartridge），未来将持续演进与深化。
让我们在对话与灵感的交织中，继续向前推进！

*(本篇纪事由会话设计中枢与自动化灵感管线于 ${new Date().toISOString().slice(0, 10)} 自动编织沉淀)*
`;
}

/**
 * 自动编织并持久化页面的诞生初衷开发纪事
 */
export async function synthesizeOriginChronicle(
    db: DB,
    serverConfig: ConfigReader,
    env: Env,
    cache: any,
    options: ChronicleRequestOptions,
    adminUid: number = 1
) {
    const alias = getChronicleAlias(options.slug);
    const existing = await findChronicleBySlug(db, options.slug);

    if (existing && !options.forceRegenerate) {
        return {
            created: false,
            feed: existing,
            directUrl: `/feed/${existing.alias || existing.id}`,
        };
    }

    let markdownBody = "";

    // 尝试调用 AI 执行高情商、深度工程思考的纪事生成
    try {
        const aiPrompt = [
            `模块标识: ${options.slug}`,
            `模块名称: ${options.pageTitle}`,
            `模块定位: ${options.description || "个人边缘自托管服务与画廊微世界"}`,
            options.highlights ? `技术亮点:\n${options.highlights.map(h => `- ${h}`).join("\n")}` : "",
        ].filter(Boolean).join("\n\n");

        const aiRes = await executeAIChat(env, serverConfig, [
            {
                role: "system",
                content: `你是一个充满技术洞见与二次元微光美学的全栈架构师。请为该模块撰写一篇富有极客浪漫与深层架构思考的【开发纪事 / 诞生初衷】Markdown 长文（字数 600~1200 字）。
要求结构包含：
1. 一句话引言与诞生初衷（阐述为什么我们需要这个独立世界）；
2. 架构选型与解耦思考（Cloudflare Serverless、边缘原生、可拆卸卡带）；
3. 关键挑战与踩坑突破（坚守原则、杜绝紧耦合、保护用户心血）；
4. 视觉与交互调优（二次元柔和美学与高密单屏超级表格的平衡）；
5. 结语与未来延伸。
排版精致，使用规范 Markdown 标题、引用与项目列表，不要输出多余解释。`
            },
            {
                role: "user",
                content: aiPrompt
            }
        ]);

        if (aiRes.success && aiRes.reply && aiRes.reply.length > 200) {
            markdownBody = aiRes.reply.trim();
        }
    } catch {}

    if (!markdownBody) {
        markdownBody = buildFallbackChronicleMarkdown(options);
    }

    const title = `【诞生纪事】${options.pageTitle}：一页一世界的架构演进与设计初衷`;
    const summary = options.description
        ? `画廊微世界「${options.pageTitle}」的边缘原生架构演进手记：${options.description}`
        : `画廊微世界「${options.pageTitle}」的边缘原生架构演进手记与自插拔设计初衷。`;
    const date = new Date();
    const isDraft = options.draft ? 1 : 0;

    let feedId: number;

    if (existing) {
        await db.update(feeds).set({
            title,
            summary,
            content: markdownBody,
            draft: isDraft,
            updatedAt: date,
        }).where(eq(feeds.id, existing.id));
        feedId = existing.id;
    } else {
        const [inserted] = await db.insert(feeds).values({
            title,
            summary,
            content: markdownBody,
            alias,
            ai_summary: summary,
            ai_summary_status: "idle",
            ai_summary_error: "",
            uid: adminUid,
            listed: 1,
            draft: isDraft,
            top: 0,
            createdAt: date,
            updatedAt: date,
        }).returning({ insertedId: feeds.id });
        feedId = inserted.insertedId;
    }

    // 绑定专属分类标签
    await bindTagToPost(db, feedId, ["开发纪事", "一页一世界", options.pageTitle]);

    if (cache) {
        await clearFeedCollectionCaches(cache);
    }

    const updated = await findChronicleBySlug(db, options.slug);

    return {
        created: !existing,
        feed: updated,
        directUrl: `/feed/${alias}`,
    };
}
