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
 * 经典高质开发手记深度智库（消灭空洞占位符，每一篇均为真实硬核架构手记）
 */
function buildFallbackChronicleMarkdown(options: ChronicleRequestOptions): string {
    const { slug, pageTitle, description } = options;

    if (slug === "friends") {
        return `> “万物互联的喧嚣之下，独立博客是数字荒原中最珍贵的篝火。” —— 星标画廊诞生手记

---

### 一、 诞生初衷：重拾独立博客圈的温度

在当下算法信息流与平台孤岛割裂的互联网生态中，独立个人博客正逐渐沦为一座座彼此隔绝的孤岛。构建「星标画廊 · 友链罗盘」的核心初衷，并非做一个死板堆砌域名的友情链接列表，而是打造一座基于边缘原生的去中心化技术圈集结港湾。

我们希望打破传统友链“站名 + 链接 + 占位图”的乏味范式，将每一个友邻站点视为一个鲜活的数字化身，融合社区认证、资产勋章与拟物美学，构建一个既有温度又有硬核技术支撑的画廊漫游世界。

---

### 二、 核心架构破局与工程挑战

在构建友链罗盘的过程中，我们遭遇并攻克了三大典型全栈架构瓶颈：

1. **防盗链与公共代理失效破局**：
   社区早期引入外部公共图像代理（如 weserv）用于跨域加载坛友头像，然而随着源站对公共代理的防盗链与 403 封锁加剧，外部代理出现大面积崩溃。我们果断重构数据链路：彻底拔除失效的第三方中间代理，回归官方纯净直连，并在前端通过 \`referrerPolicy="no-referrer"\` 彻底解决浏览器防盗链拦截问题。
2. **矢量 SVG 与二进制图片魔数嗅探**：
   NodeSeek 社区头像虽然以后缀 \`.png\` 结尾，但部分用户头像在底层返回的实际上是原生 \`<svg>\` 矢量图形。传统的二进制图片魔数校验（如检索 PNG、JPEG 头字节）会将合法 SVG 误杀拦截。我们在服务端实装了 \`isValidImageBuffer\` 双轨嗅探引擎：既识别二进制图像头，又精准解析合法 SVG XML 结构，安全无损转存至 Cloudflare R2 对象存储中。
3. **保护用户心血的防篡改法则**：
   一键批量更正与同步机制必须保持对用户自主配置的绝对敬畏。我们建立了严格的内容保护屏障：凡是博主手动修改定制过的站名与简介（非系统占位符），更正逻辑 100% 坚固保留，仅对等级、鸡腿、天数等动态资产进行增量更新，杜绝任何数据覆盖事故。

---

### 三、 界面美学演进：拍立得手账与超级数据表格的双模平衡

形式永远服务于场景。为了满足不同终端与阅读心境的诉求，画廊提供了双重视角：
- **拍立得拟物手账 (Polaroid Notes)**：采用自然微倾角、和纸胶带与环境弥散微光暗纹，居中呈现高清无损头像，将勋章（UID、等级、鸡腿数、加入天数）紧凑规整排布，留白得体自然；
- **高密单屏超级表格 (Dense DataGrid)**：针对站长管理与极客浏览，提供单行单屏高吞吐列表，支持序号直接跳位调序与快捷分类流转。

*(本篇纪事由会话设计中枢与自动化灵感管线于 ${new Date().toISOString().slice(0, 10)} 自动编织沉淀)*
`;
    }

    if (slug === "music") {
        return `> “代码编织秩序，音符安顿灵魂。” —— 云端音廊架构手记

---

### 一、 诞生初衷：无服务器时代的自托管私有音乐母舰

市面上的流媒体平台充斥着版权下架、算法推荐绑架与繁杂的广告推送。构建「边缘音廊」的初衷，是为了给自己的心仪曲库打造一个完全由自己掌控的云端高保真避难所。依托 Cloudflare 边缘计算与全球低成本 R2 对象存储，实现零服务器运维负担、全端随时随地畅听的纯粹私有音乐空间。

---

### 二、 架构演进：攻克 40MB 大文件与 10KB 独立索引架构

在将大体积无损音频（如 FLAC、WAV）直接接入 Worker 边缘运行时时，我们遭遇了边缘计算最经典的瓶颈：
- **大文件出站超时与内存膨胀**：早期的逻辑尝试在修改歌曲封面或元数据时，对数十兆的完整音频文件进行重新上传或流式写入，直接触发了 Cloudflare Worker 的 CPU 执行时间上限与网络中断，导致频繁丢失修改；
- **10KB 独立索引架构 (\`music/metadata.json\`) 诞生**：我们展开了颠覆性的架构解耦，在 R2 存储桶中设立专用的极轻量元数据索引。修改歌名、封面、分组或歌手信息，无需重传 40MB 真实音频，仅耗时 15ms 更新轻量 JSON 索引。强制刷新 (\`Ctrl + F5\`) 封面与标题 100% 永久留存；
- **资产存储与播放队列彻底解耦**：前台播放器列表仅为展示视窗，全选清空或单曲移出播放列表仅变更播放器歌单配置，绝不触碰真实媒体文件；物理文件删除必须严格收拢在音廊专属资产视图的显式确认操作中。

---

### 三、 视觉美学：手绘日系双音符纯矢量微动效

播放器彻底摒弃了生硬的 Emoji 字符与笨重实体背景卡片：
- 采用纯手绘日系双音符矢量 SVG，播放时伴随轻柔呼吸粉光缓慢顺时针旋转，暂停时静止；
- 浮空歌词无框悬浮于按键上方，内嵌 2px 极细粉色播放进度条，奶油磨砂控制栏支持点击音符平滑收折展开。

*(本篇纪事由会话设计中枢与自动化灵感管线于 ${new Date().toISOString().slice(0, 10)} 自动编织沉淀)*
`;
    }

    if (slug === "storage") {
        return `> “图像定格时间，数据沉淀记忆。” —— R2 图床漫游手记

---

### 一、 诞生初衷：全球高可用无冷启动媒体资产中枢

独立全栈系统必须具备自主闭环的媒体资产分发能力。「R2 图床 · 记忆画廊」的构思，旨在彻底摆脱第三方公共图床的随时可能暴雷跑路或防盗链反爬风险，依托 Cloudflare R2 对象存储在全球边缘节点就近缓存与零出站流量费（Zero Egress Fee）的天然优势，建立属于博主自己的永久媒体资产库。

---

### 二、 核心架构与生产力工程

1. **React Portal 解决全屏画廊灯箱样式裁切**：
   全屏大图预览灯箱（Lightbox）如果挂载在局部的卡片容器内，极易受到父级容器 \`overflow: hidden\`、CSS 变换（Transform）或层级堆叠上下文（Stacking Context）的裁切遮挡。我们严格规范所有画廊大图预览灯箱一律通过 React Portal 挂载至 \`document.body\` 顶层并提权至 \`z-[9999]\`，杜绝局部裁切。
2. **多格式即拷生产力工具流**：
   在图库管理中，支持一张图片一键直接复制 Markdown、HTML、BBCode 以及原始直链 4 种规格，剪贴板自动抓取与拖拽即传，让写文与贴图体验丝滑畅快。
3. **OpenList 边缘多源网盘目录挂载整合**：
   不到一屏绝不独占全局路由。我们将 OpenList Worker 边缘多网盘目录索引以紧凑折叠条无缝嵌入图床视图中，兼顾多源网盘挂载与本地 R2 存储的双重管理。

*(本篇纪事由会话设计中枢与自动化灵感管线于 ${new Date().toISOString().slice(0, 10)} 自动编织沉淀)*
`;
    }

    if (slug === "hashtags") {
        return `> “打破死板分类，让标签成为穿越灵感时空的智能传送门。” —— 标签星云架构手记

---

### 一、 诞生初衷：打破千篇一律标签分类的沉闷范式

在传统博客系统中，标签往往沦为一个冷冰冰的“数据库多对多关系表展示”。读者点进去，看到的是千篇一律的列表页，毫无交互趣味。
「标签星云」的重塑初衷，是让标签从“静态分类标签”演进为“动态时空传送门与功能动作载体”。

---

### 二、 核心架构突破

1. **单篇独家标签智能直达传送门 (Smart Direct Hop)**：
   若某个标签全站仅关联了 1 篇独家文章，读者点击该标签的本意是看那篇文章。系统自动识别这一场景，点击该标签直接穿透至文章阅读页，彻底消灭中间只有一个孤零零卡片的尴尬过渡页；
2. **前台站长一键物理清理孤儿空标签**：
   在边缘数据库中，随着文章的修改与删减，极易残留关联文章数为 0 的死标签。在前台星云页为管理员提供了秒级清理接口（\`DELETE /api/tag/unlinked\`），一键物理清除无文章关联的空标签；
3. **标签栏附加功能按钮解耦**：
   文章顶底的标签栏打破传统死板边界，在常规文章标签末尾自然融入同规格、同质感的功能动作胶囊（\`上一篇\`、\`下一篇\`、\`换一篇\`），既杜绝了在每个标签屁股后面堆砌重复开关图标的视觉杂乱，又赋予了读者随时探索灵感的便捷通道。

*(本篇纪事由会话设计中枢与自动化灵感管线于 ${new Date().toISOString().slice(0, 10)} 自动编织沉淀)*
`;
    }

    return `> **“一页一世界”** —— 画廊博客不仅仅是一座阅读站点，更是所有自托管边缘微服务的观察站与集结母舰。

---

### 一、 诞生初衷与设计哲学

在构建「${pageTitle}」这一模块之初，我们的核心愿景是：**每一个页面都是一个独立自洽的“小世界”**。
${description || `围绕 ${pageTitle} 展开的自托管实践，旨在探索个人云原生环境下的自由表达。`}

---

### 二、 核心架构与工程亮点

- **边缘自托管与解耦**：基于 Cloudflare Serverless 与 D1/R2 原生生态，零服务器运维负担；
- **数据持久化契约**：依托结构化数据模型与轻量缓存机制，实现毫秒级即时响应；
- **配置驱动呈现**：核心排版、密度、动效完全由配置中枢动态解耦，让代码回归纯粹；
- **自闭环测试防御**：遵守严谨的类型契约与自动化测试门禁，保障长青稳定。

---

### 三、 踩坑复盘与架构护栏

在模块的推进过程中，我们沉淀下了不可动摇的工程守则：
1. **拒绝伪自动化**：杜绝盲目修改代码后把开发者当成人肉测试员，必须在后台建立端到端验证闭环；
2. **严防隐性耦合**：严禁子模块擅自跨边界侵入主核心实现细节，保持接口干净透明；
3. **保护用户心血**：用户手动定制的个性化数据（简介、标题、排版偏好）具有最高权威，任何更正机制绝不可覆盖。

---

### 四、 展望：微世界的未来生长

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
            isAi: false,
        };
    }

    let markdownBody = "";
    let isAi = false;

    // 尝试调用 AI 执行高情商、深度工程思考的纪事生成 (设 12 秒快速熔断兜底，杜绝无限悬挂)
    try {
        const aiPrompt = [
            `模块标识: ${options.slug}`,
            `模块名称: ${options.pageTitle}`,
            `模块定位: ${options.description || "个人边缘自托管服务与画廊微世界"}`,
            options.highlights ? `技术亮点:\n${options.highlights.map(h => `- ${h}`).join("\n")}` : "",
        ].filter(Boolean).join("\n\n");

        const aiPromise = executeAIChat(env, serverConfig, [
            {
                role: "system",
                content: `你是一个顶级技术架构师与二次元微光美学的画廊博客主。请为该模块撰写一篇富有真实技术洞见、深层架构思考与踩坑复盘的【开发手记 / 诞生初衷】Markdown 深度长文（字数 1000~1600 字）。
要求结构包含：
1. 一句话引言与诞生初衷（阐述为什么我们需要这个独立世界，拒绝套话，直击痛点）；
2. 架构选型与解耦思考（Cloudflare Serverless、边缘原生、D1 数据库与 R2 对象存储、可拆卸卡带）；
3. 关键挑战与踩坑突破（坚守原则、杜绝紧耦合、防盗链与真实排错心路）；
4. 视觉与交互调优（二次元柔和美学与高密单屏超级表格的平衡）；
5. 结语与未来延伸。
排版精致，使用规范 Markdown 标题、引用与项目列表，不要输出任何非正文的前后缀废话。`
            },
            {
                role: "user",
                content: aiPrompt
            }
        ]);

        const timeoutPromise = new Promise<{ success: false; reply: string }>((resolve) => {
            setTimeout(() => resolve({ success: false, reply: "" }), 12000);
        });

        const aiRes = await Promise.race([aiPromise, timeoutPromise]);

        if (aiRes.success && aiRes.reply && aiRes.reply.length > 300) {
            markdownBody = aiRes.reply.trim();
            isAi = true;
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
        isAi,
    };
}
