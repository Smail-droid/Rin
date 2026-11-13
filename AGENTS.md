# AGENTS.md - 🌸 画廊随想 (Gallery Blog) AI 工程开发章程与长青记忆

> **核心哲学**：**代码可以规范，灵感不该被局限 (Code can be disciplined; inspiration must remain unbounded)。**  
> 本项目是一座「二次元微光美学 × Serverless 边缘原生全栈 × 高密单屏超级数据网格」的个人画廊博客与知识库系统。
> 守住工程安全与性能底线，同时为一切艺术灵感与前沿交互创意留出无限生长的空间。所有 Agent 必须遵照履行。

---

## 1. 核心构建命令与测试门禁 (Core Commands & Gates)

统一使用 **Bun** 作为工程脚本运行器与测试执行器（统一使用 `bun:test`，绝不引入 Vitest/Jest）：

```bash
bun dev              # 启动全栈开发服 (前端 Vite + 边缘后端 Wrangler 端口 11498)
bun run check        # 全局 TypeScript 严格类型检查 (必须 0 报错)
bun run test         # 运行全栈自动化测试套件 (全量测试必须 100% 绿灯全通)
bun run build        # 生产编译打包 (严格监控主入口 chunk 维持在 ~131 kB 量级)
```

---

## 2. 🧠 长青记忆与工程底蕴 (Living Dialogue Distillation)

历次重构碰撞中沉淀的永恒经验，所有 Agent 会话必须无条件继承：

1. **断崖式瘦身初心（极致分包线）**：
   - 首屏重型库（Monaco Editor、Mermaid 等）一律采用动态 `import()` 按需异步加载；前台访客首屏主入口保持在 **~131 kB (gzip ~38 kB)**，访客首屏 0 冗余依赖开销。
2. **配置驱动视图 (Config-Driven Presentation)**：
   - 导航排布（经典/纯文本/灵动岛/底部挂件）、瀑布流列数、留白边距、卡片变体（默认/杂志风/紧凑/画册海报）、字号滑块、18 款主题色与 12 种艺术字族，全部由后台配置响应式驱动，保留弹性插槽与自适应槽位。
3. **显式布尔三元防漏 0（经典 JSX 陷阱）**：
   - SQLite 返回的整型布尔值（`top`、`accepted`、`approved` 的 `0` 和 `1`）必须使用显式布尔三元运算渲染：`{isTop ? <Badge /> : null}`，杜绝短路求值将数字 `0` 作为文本节点漏出到界面。
4. **规范工程词汇**：
   - 紧凑表格一律称为**“高密单屏超级数据表格 (Dense DataGrid)”**，折叠侧栏一律称为**“极简迷你侧边栏 (Mini Sidebar)”**。
5. **双轨制公私分流记忆 (Privacy & Secret Sanitization)**：
   - 本文件仅沉淀公开通用的工程设计与防坑模式，真实密钥、私有 Token、私有 IP 严禁入库；本地个人偏好与内部参数统一存放于被 `.gitignore` 忽略的 `.jeikcode.user.md`，公开示例统一使用 `<YOUR_API_KEY>` 等标准占位符。
6. **资产存储与展示队列彻底解耦 (Decoupled Storage & Playback Queue)**：
   - 前台播放列表仅为展示队列，全选清空或单曲移出播放列表仅变更播放器歌单配置，绝不触碰 Cloudflare R2 存储桶中的真实媒体文件；物理文件删除必须严格收拢在音廊专属资产视图的显式确认操作中。
7. **数据驱动与动态检索 (Dynamic & Config-Driven over Static Dictionaries)**：
   - 曲库、歌手、流派与搜索统一由边缘服务端接口动态检索驱动，告别在前端堆砌死板的静态硬编码字典，保持界面的敏捷生长。

---

## 3. 🎨 界面灵感演进与轻量落地法则 (Fluid Evolution Principles)

### 3.1 拥抱发散灵感，优先风格迁移
- 顺应原风格美学脉络（二次元微光、粉白柔和渐变、呼吸感阴影、极客终端）进行自然迁移，而不是用刻板尺寸限制创意；形式服务于场景，数据密集与留白漫游皆可自由演进。

### 3.2 现有原子积木的巧思组合
- 优先复用与灵活组合既有原语，避免随意增生一次性孤岛组件：
  - **基础 UI 原语**：`@rin/ui` (`Modal`, `SearchableSelect`, `Spinner`, `SettingsBadge`)；
  - **视觉与交互原语**：Tailwind 工具类、拟态毛玻璃 (`backdrop-blur-md`)、`ImageWithFallback`、React Portal 顶层传送门 (`createPortal`)；
- 通过组合现有原语、配置状态驱动与插槽扩展（Slots），以精炼代码优雅实现复杂交互。

### 3.3 专业技能联动与方法论协同 (Skills Synergy)
- 环境中已挂载标准专业技能库，按需调取相应技能驱动工程链路：
  - **复杂问题根因定位**：调用 `diagnosing-bugs`，建立最小可复现闭环，拒绝无依据盲猜；
  - **架构设计与模块解耦**：调用 `codebase-design` 与 `improve-codebase-architecture`，设计深模块与清晰接缝；
  - **代码审查与提交前审计**：调用 `code-review`，执行规范（Standards）与需求（Spec）双轴评审；
  - **开发环境与章程复盘**：调用 `retro` 与 `writing-for-agents`，持续打磨环境与提示词。

---

## 4. 🛡️ 底线防线：不可逾越的工程安全基线 (Non-negotiable Baseline)

1. **严格 CSP (Zero Eval 沙盒)**：全站禁用 `'unsafe-eval'`，严禁使用 `eval()`、`new Function()` 或字符串形式的 `setTimeout`/`setInterval`。
2. **密码学安全随机源**：通行证、Token 及哈希校验统一使用 Web Crypto API 的 `crypto.getRandomValues()`，严禁使用 `Math.random()`。
3. **React Portal 解决遮挡与溢出**：全屏大图预览灯箱、顶层弹窗与下拉浮层一律通过 `createPortal` 挂载至 `document.body` 并提权至 `z-[9999]`，杜绝局部容器 `overflow: hidden` 裁切。
4. **暗黑模式下拉防白底**：下拉选择统一使用 `GlassDropdown` 或 `SearchableSelect`，弹层配置安全层级防遮挡。
5. **时区平滑标准化**：SQLite 无时区字符串前端统一补齐标准化转换，防止月末文章时区偏移；跨页面路由跳转保持视口自动归零回顶。
6. **自动化风控与兜底**：友链嗅探维持 4 秒超时熔断与 Favicon 代理兜底；留言含外链自动转入待审（`approved = 0`）。
7. **敏感信息与密钥防泄漏**：Git 提交前严格审查 `git diff`，严禁将包含真实私钥、Token、`.env` 的敏感变动推送至远程仓库。

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
│       └── utils/       # 缓存 (CacheImpl)、Web Crypto、原生音频封面提取工具
├── packages/
│   ├── api/         # @rin/api 前后端共享请求/响应契约与类型定义
│   ├── ui/          # @rin/ui 基础通用 UI 原语 (Modal, SettingsBadge, Spinner, SearchableSelect)
│   └── config/      # @rin/config 共享配置模型、默认键名与解析工具
└── cli/             # 工程构建、数据库迁移、发布与部署 CLI (`cli/bin/rin.ts`)
```

- **架构原则**：保持扁平清晰的工程架构，严禁盲目重命名核心目录或引入空壳抽象。

---

## 6. 🚀 提交前自检门禁与复盘汇报纪律 (Pre-Commit & Reporting)

### 6.1 自动化质量门禁 (Checklist)
在提交代码前，Agent 必须在终端完成自检并满足以下完备判据：
1. [ ] `bun run check` 全局 TypeScript 严格类型检查 0 报错。
2. [ ] `bun run test` 全量自动化测试套件 100% 绿灯全通（严禁私自删改测试断言掩盖错误）。
3. [ ] 若涉及依赖或组件变动，`bun run build` 后主入口 `index.js` 依然维持在 ~131 kB 量级，三大重型库保持动态按需加载。
4. [ ] 遵守词汇审查红线，无违规名称残留；JSX 布尔值严格三元运算，无漏出数字 `0/1`。
5. [ ] 严格执行隐私脱敏审查，无真实密钥、生产私有 IP 或个人隐私泄露风险。

### 6.2 门禁后文字复盘汇报纪律 (Post-Checklist Report)
完成自检后，Agent **必须在回复中以文字形式向开发者明确汇报以下维度**：
1. **灵感落地路径**：如何理解并基于现有风格底蕴迁移实现了开发者的发散想法；
2. **轻量复用分析**：复用了哪些已有原子积木（避免了盲目新增孤岛组件），代码如何保持精炼；
3. **前后台联动设计**：提供了哪些配置槽或动态参数，前台如何响应感知；
4. **工程底线与测试确认**：明确汇报类型检查与全栈测试的执行结果。
