# AGENTS.md - 🌸 画廊随想 (Gallery Blog) AI 工程开发章程与记忆备忘录

> **核心哲学**：**代码可以规范，灵感不该被局限 (Code can be disciplined; inspiration must remain unbounded)。**  
> 本项目是一座「二次元微光美学 × Serverless 边缘原生全栈 × 高密单屏超级数据网格」的个人画廊博客与知识库系统。
> 本章程的使命是**守住工程安全与性能底线，同时为一切艺术灵感与前沿交互创意留出无限生长的空间**。所有 AI Agent 必须通读并严格履行本章程。

---

## 1. 常用开发与构建命令 (Build & Tooling Commands)

统一使用 **Bun** 作为包管理器、脚本运行器与测试执行器，通过 `cli/bin/rin.ts` 调度工程任务：

```bash
# 开发调试 (Development)
bun dev                    # 同时启动前端 (Vite + React) 与边缘后端 (Wrangler 端口 11498)
bun dev:client             # 仅启动前端开发服
bun dev:server             # 仅启动后端开发服
bun dev:cron               # 启动带 Cron Triggers 定时任务的后端服务

# 编译与类型检查 (Build & Check)
bun run build              # 编译全工作区 (Turbo) —— 检查首屏 chunk 体积与懒加载分离
bun run check              # 全局 TypeScript 严格类型检查 (Turbo)

# 数据库迁移 (Cloudflare D1 + Drizzle ORM)
bun run db:generate        # 生成 Drizzle SQL 迁移文件
bun run db:migrate         # 执行本地 D1 数据库迁移

# 代码格式化 (Formatting)
bun run format:check       # 检查代码格式
bun run format:write       # 自动修复代码格式

# 自动化测试 (Testing - 统一使用 bun:test，严禁引入 Vitest/Jest)
bun run test               # 运行全栈所有自动化测试 (全量用例必须 100% 绿灯全通)
bun run test:client        # 仅运行前端测试 (bun:test + jsdom)
bun run test:server        # 仅运行服务端测试 (bun:test)
bun run test:coverage      # 生成测试覆盖率报告

# 部署与发布 (Deployment & Release)
bun run deploy             # 部署前后端至 Cloudflare (Pages + Workers)
bun run deploy:client      # 仅部署前端 (Cloudflare Pages)
bun run deploy:server      # 仅部署后端 (Cloudflare Workers)
bun run release <version>  # 发布新版本 (patch/minor/major/x.y.z)
```

---

## 2. 🧠 长青记忆与重要对话提炼 (Living Dialogue Distillation)

本章节记录历次重构碰撞中沉淀的**核心认知与血泪教训**。后来的 Agent 必须将此作为永恒上下文，您可随时手动或指令修正本区内容：

1. **断崖式瘦身初心（永不妥协的分包线）**：
   - 曾因首屏捆绑 Monaco Editor 与 Mermaid 导致首屏高达 5.68 MB；我们将其压制到 **131.42 kB (gzip: 38.37 kB)**。任何时候严禁静态顶层 `import` 重型库，前台访客视图必须保持 0 字节无关依赖开销。
2. **核心助手标准化命名：画廊文字侍从 (Text Attendant)**：
   - 创作工坊中的 AI 助手正式定名为**「画廊文字侍从」**。它拥有就绪态指示、指针拖拽/双击复位、视口防越界、三大选项卡（咨询/预设/流水线）与光标快捷插入能力。
3. **前后台联动架构原则（绝不把样式写死）**：
   - 全站页面坚决贯彻“配置驱动视图 (Config-Driven Presentation)”：导航排布（经典/纯文本/灵动岛/底部挂件）、瀑布流列数、留白边距滑块、文章卡片变体（默认/杂志风/紧凑/画册海报）、字号滑块、18 款主题色与 12 种艺术字族，**全部由后台响应式驱动**。严禁在前台写死单一样式，必须保留可调节的弹性槽。
4. **布尔短路求值防漏 0（经典 JSX 陷阱）**：
   - SQLite 的整型布尔值（`top`、`accepted`、`approved` 的 `0` 和 `1`）严禁直接写 `{item.top && <Badge />}`，因为当值为 `0` 时 React 会把数字 `0` 作为文本节点直接渲染到标题前；必须写成显式布尔三元：`{isTop ? <Badge /> : null}`。
5. **词汇合规与工程品味**：
   - 严禁出现特定私有软路由系统或特定代理面板名称。凡紧凑表格一律称为**“高密单屏超级数据表格 (Dense DataGrid)”**，凡折叠侧栏一律称为**“极简迷你侧边栏 (Mini Sidebar)”**。

---

## 3. 🎨 界面灵感演进与轻量落地法则 (Fluid Evolution Principles)

### 3.1 拥抱发散灵感，拒绝教条局限
- **风格迁移大于死板规定**：当开发者提出一个新的发散想法或视觉构想时，Agent 的第一天职是**顺应原风格美学脉络（粉白渐变、呼吸感微光、拍立得错落倾角、极客终端）进行自然迁移**，而不是用刻板的尺寸数字去限制创意。
- **形式服务于场景**：无论是高密紧凑的数据管理，还是舒展留白的画廊漫游，都可以根据场景需要自由演进，探索更优雅的展现形式。

### 3.2 不随意增生组件，重在现有原子积木的巧思组合
- 严禁为了细微功能生造大量一次性、难以维护的孤岛组件。
- **优先复用与灵活组合既有原语**：
  - 基础组件原语：`@rin/ui` (`Modal`, `SearchableSelect`, `Spinner`, `SettingsBadge`)；
  - 布局与视觉原语：Tailwind 工具类、CSS 渐变与动态变量、拟态毛玻璃 (`backdrop-blur-md`)、`ImageWithFallback`；
  - 交互原语：React Portal 顶层传送门（解决大图灯箱裁切）、可拖拽指令浮窗、标准底部分页控制器（总数/PageSize/翻页/前往跳转）；
- 通过组合现有原语、配置状态驱动与插槽扩展（Slots），以极简代码优雅实现复杂灵感。

---

## 4. 🛡️ 底线防线：不可逾越的工程安全基线 (Non-negotiable Baseline)

创意可以自由发散，但以下底层安全性与鲁棒性底线绝不可触碰：

1. **严格 CSP (Zero Eval 沙盒)**：全站坚决禁用 `'unsafe-eval'`，严禁使用 `eval()`、`new Function()` 或字符串形式的 `setTimeout`/`setInterval`。
2. **密码学安全随机源**：通行证、Token 及哈希校验统一使用 Web Crypto API 的 `crypto.getRandomValues()`，严禁使用 `Math.random()`。
3. **React Portal 解决遮挡与溢出**：全屏大图预览灯箱及顶层弹窗必须挂载至 `document.body` 并提权至 `z-[9999]`，杜绝局部 `overflow: hidden` 裁切。
4. **暗黑模式磨砂下拉防白底**：避免使用原生 `<select>` 产生的暗黑模式白底白字缺陷，统一使用 `GlassDropdown` 或 `SearchableSelect`，弹层配置 `z-[999]` 与父级防遮挡。
5. **时区与平滑体验**：SQLite 无时区字符串前端统一标准化补齐，防止月末文章时区丢失；跨页面路由跳转保持视口自动归零回顶。
6. **自动化风控与兜底**：友链嗅探维持 4 秒超时熔断与三级 Favicon 代理兜底；留言含外链自动转入待审（`approved = 0`）。

---

## 5. 📁 架构分层与工程边界 (Architecture Boundaries)

```text
rin/
├── client/          # React 18 + Vite 6 + TailwindCSS 前端 SPA 应用
│   └── src/
│       ├── components/  # 灵活可复用的业务组件（遵守 Portal / 侍从拖拽 / 微光美学）
│       ├── page/        # 页面级视图与 14 大后台管理模块
│       ├── api/         # 类型安全的客户端 API 请求封装 (HttpClient)
│       └── utils/       # 时区处理、格式转换、安全校验工具
├── server/          # Cloudflare Workers (`workerd`) 边缘服务端
│   └── src/
│       ├── services/    # 路由业务 Handler (按功能模块装配 Router)
│       ├── db/          # Drizzle ORM + Cloudflare D1 数据库 Schema (snake_case)
│       ├── core/        # Hono 风格轻量路由器、中间件、上下文与环境类型
│       └── utils/       # 缓存 (CacheImpl)、Web Crypto、Webhook、AI 提炼工具
├── packages/
│   ├── api/         # @rin/api 前后端共享请求/响应契约与类型定义
│   ├── ui/          # @rin/ui 基础通用 UI 原语 (Modal, SettingsBadge, Spinner, SearchableSelect)
│   └── config/      # @rin/config 共享配置模型、默认键名与解析工具
└── cli/             # 工程构建、数据库迁移、发布与部署 CLI (`cli/bin/rin.ts`)
```

- **架构原则**：保持扁平清晰的产品架构，**严禁盲目重命名 `client/` 或 `server/` 为 `apps/*`**，严禁引入空壳抽象。

---

## 6. 🚀 提交前自检门禁与复盘汇报纪律 (Pre-Commit & Reporting)

### 6.1 自动化质量门禁 (Checklist)
在提交代码前，Agent 必须在终端完成自检：
1. [ ] `bun run check` 全局 TypeScript 严格类型检查 0 报错。
2. [ ] `bun run test` 全量自动化测试套件 100% 绿灯全通（严禁私自删改测试断言掩盖错误）。
3. [ ] 若涉及依赖或组件变动，`bun run build` 后主入口 `index.js` 依然维持在 ~131 kB 量级，三大重型库保持动态按需加载。
4. [ ] 遵守词汇审查红线，无违规名称残留；JSX 布尔值严格三元运算，无漏出数字 `0/1`。

### 6.2 门禁后文字复盘汇报纪律 (Post-Checklist Report)
完成自检后，Agent **必须在回复中以文字形式向开发者明确汇报以下维度**，确保沟通透明且富有建设性：
1. **灵感落地路径**：如何理解并基于现有风格底蕴迁移实现了开发者的发散想法；
2. **轻量复用分析**：复用了哪些已有原子积木（避免了盲目新增组件），代码如何保持精炼；
3. **前后台联动设计**：提供了哪些配置槽或动态参数，前台如何响应感知；
4. **工程底线与测试确认**：明确汇报类型检查与全栈测试的执行结果。
