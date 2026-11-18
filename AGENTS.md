# AGENTS.md - 🌸 画廊随想 (Gallery Blog) AI 工程开发章程

> **核心原则**：代码规范严谨，界面兼具现代画廊编辑部审美与高密单屏超级数据表格质感。
> 守住工程安全与首屏性能底线，坚持去模板化与清晰克制的设计语言。所有 Agent 必须遵照履行。

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

## 2. 长青工程设计准则 (Living Dialogue Distillation)

历次架构重构沉淀的工程经验，所有会话无条件继承：

1. **极致分包底线**：
   - 首屏重型库（Monaco Editor、Mermaid 等）一律使用动态 `import()` 按需异步加载；前台访客首屏主入口保持在 **~131 kB (gzip ~38 kB)**，访客首屏 0 冗余依赖开销。
2. **配置驱动视图 (Config-Driven Presentation)**：
   - 导航排布、瀑布流列数、留白边距、卡片变体（默认/杂志风/紧凑/画册海报/拍立得）、字号滑块、主题色与艺术字族全部由后台配置响应式驱动。
3. **显式布尔三元防漏 0**：
   - SQLite 返回的整型布尔值（`top`、`accepted`、`approved` 的 `0` 和 `1`）必须使用显式布尔三元运算渲染：`{isTop ? <Badge /> : null}`，杜绝短路求值将数字 `0` 作为文本节点漏出到界面。
4. **规范工程词汇**：
   - 紧凑表格一律称为**“高密单屏超级数据表格 (Dense DataGrid)”**，折叠侧栏一律称为**“极简迷你侧边栏 (Mini Sidebar)”**。
5. **资产存储与展示队列彻底解耦**：
   - 播放列表仅为展示队列，全选清空或单曲移出播放列表仅变更播放器歌单配置，绝不触碰 Cloudflare R2 存储桶中的真实媒体文件；物理文件删除必须严格收拢在专属资产视图的显式确认操作中。
6. **友链资产与简介保护**：
   - 更正社区坛友数据时，严禁使用已被反爬拦截的外部公共代理（如 weserv）；图片抓取必须精准兼容二进制与原生 `<svg>` 矢量图形；更正逻辑必须严格保护用户手动填写的站名与简介，非系统占位符绝不覆盖。
7. **数据驱动与动态检索**：
   - 曲库、歌手、流派与搜索统一由边缘服务端接口动态检索驱动，不在前端堆砌静态硬编码字典。

---

## 3. 界面美学与轻量复用规范 (UI Primitives & Guidelines)

### 3.1 现代 Tailwind 设计令牌与风格演进
- **语义表面层级**：严格区分画布底色、轻透卡片与 1px 清晰描边控件，禁止对 `<input>` / `<textarea>` 等表单元素套用带强阴影和毛玻璃模糊的 `.bg-w` 容器类。
- **多色联动而非单色堆砌**：主题配色采用三色语义令牌（主强调色 `--theme-rgb`、辅呼应色 `--theme-secondary-rgb`、画布柔光 `--theme-canvas-tint-rgb`），拒绝纯黑大块按钮（`bg-neutral-900`）与脏灰重度模糊。
- **真抽屉与直白命名**：前台定制与站长配置采用紧凑侧滑检查器抽屉（宽度约 `420px`，保留左侧主画布实时预览），所有按钮、风格与导航名称坚持“所见即所得”的直白表达，杜绝词不达意的玄学文案。
- **结构级差异化**：不同卡片/风格预设必须在版式结构、图文比例与信息密度上具备清晰差异，拒绝同一模板换色微调。

### 3.2 原子积木组合
- 优先复用与灵活组合既有原语，避免随意增生一次性孤岛组件：
  - **基础 UI 原语**：`@rin/ui` (`Modal`, `SearchableSelect`, `Spinner`, `SettingsBadge`)；
  - **视觉与交互原语**：Tailwind 语义工具类、清晰 1px 描边 (`border-neutral-200/80 dark:border-white/10`)、`ImageWithFallback`、React Portal 顶层传送门 (`createPortal`)。

---

## 4. 技能自适应协同机制与架构守护者铁律 (Autonomous Skills & Guardian Guardrails)

环境中已挂载标准专业技能库，**Agent 应根据开发者的意图和当前场景主动感知并自动调用对应技能，无需开发者每次手工输入斜杠指令**：

- **架构守护与偏航拦截**：自主触发 `codebase-design` / `improve-codebase-architecture`。当任何修改可能破坏“微世界插槽解耦”或引入全局硬编码依赖时，Agent **必须主动叫停并提供接缝隔离方案**，拒绝无原则地打局部防御性补丁；
- **拒绝肉体测试员与自主验真**：界面、样式与数据接口更正后，Agent 应尽可能结合自动化测试、Chrome DevTools 或 Puppeteer 无头浏览器自测 DOM 渲染、视口留白与网络瀑布流，**严禁将开发者当成排错的人肉测试机**；
- **系统排错与网络超时**：自主触发 `debug` / `diagnosing-bugs`，建立最小可复现闭环，拒绝无依据盲猜；
- **接口契约与后端设计**：自主触发 `api`，规范 Hono 路由、类型安全与 Cloudflare Worker 边界；
- **代码精炼与去油去杂**：自主触发 `clean`，简化多层嵌套，清除冗余死代码，保持代码与文档纯粹专业；
- **现代前端美学与 Tailwind 工程（替换旧自研视觉技能）**：
  - 视觉方向与去模板化重构：自主触发 `frontend-design`；
  - 多色配色体系、字阶规划与反模式排查：自主触发 `ui-ux-pro-max`；
  - Tailwind 语义令牌、组件变体与暗黑模式适配：自主触发 `tailwind-design-system`；
  - 留白、间距、对比度与像素级交互验收：自主触发 `web-design-guidelines`；
  - 弹性交互微动效：自主触发 `ui-animation`；
- **任务拆解与复杂规划**：自主触发 `plan`，多步骤任务主动创建并实时维护 todo 清单；
- **开发纪事自动编织**：自主触发 `writing-shape` / `to-spec`，将复杂特性的推演过程与设计初衷提炼为开发纪事，解除人工整理文章的心智负担；
- **代码质量与提交审计**：自主触发 `review` / `code-review`，执行规范与需求双轴自检。

---

## 5. 不可逾越的安全工程底线 (Non-negotiable Baseline)

1. **严格 CSP (Zero Eval 沙盒)**：全站禁用 `'unsafe-eval'`，严禁使用 `eval()`、`new Function()` 或字符串形式的 `setTimeout`/`setInterval`。
2. **密码学安全随机源**：通行证、Token 及哈希校验统一使用 Web Crypto API 的 `crypto.getRandomValues()`，严禁使用 `Math.random()`。
3. **React Portal 解决遮挡与溢出**：全屏大图预览灯箱、顶层弹窗与下拉浮层一律通过 `createPortal` 挂载至 `document.body` 并提权至 `z-[9999]`，杜绝局部容器 `overflow: hidden` 裁切。
4. **暗黑模式下拉防白底**：下拉选择统一使用 `GlassDropdown` 或 `SearchableSelect`，弹层配置安全层级防遮挡。
5. **时区平滑标准化**：SQLite 无时区字符串前端统一补齐标准化转换，防止月末文章时区偏移；跨页面路由跳转保持视口自动归零回顶。
6. **自动化风控与兜底**：友链嗅探维持 4 秒超时熔断与 Favicon 代理兜底；留言含外链自动转入待审（`approved = 0`）。
7. **敏感信息与密钥防泄漏**：Git 提交前严格审查 `git diff`，严禁将包含真实私钥、Token、`.env` 的敏感变动推送至远程仓库。
8. **React Hooks 铁律（严防 React Error #310）**：所有 React Hooks（`useState`、`useEffect`、`useMemo`、`useCallback`、`useContext`、`useRef` 及自定义 Hooks）**必须无条件置于组件函数最顶层**；严禁在任何提前 `return`、条件判断、权限分支、路由判断或循环之后调用 Hooks，确保组件在权限加载、路由切换或弹窗开关时每次渲染的 Hook 调用次数与顺序严格一致。

---

## 6. 架构分层与工程边界 (Architecture Boundaries)

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

## 7. 提交前自检门禁与交付纪律 (Pre-Commit & Delivery)

### 7.1 自动化质量门禁 (Checklist)
在提交代码前，必须在终端完成自检并满足以下完备判据：
1. [ ] `bun run check` 全局 TypeScript 严格类型检查 0 报错。
2. [ ] `bun run test` 全量自动化测试套件 100% 绿灯全通（严禁私自删改测试断言掩盖错误）。
3. [ ] 若涉及依赖或组件变动，`bun run build` 后主入口 `index.js` 依然维持在 ~131 kB 量级，三大重型库保持动态按需加载。
4. [ ] 遵守词汇审查红线，无违规名称残留；JSX 布尔值严格三元运算，无漏出数字 `0/1`；所有变更组件无条件置顶声明 React Hooks，杜绝 React Error #310。
5. [ ] 严格执行隐私脱敏审查，无真实密钥、生产私有 IP 或个人隐私泄露风险。

### 7.2 交付纪律
- 任务执行完毕后，必须明确汇报灵感落地路径、轻量复用分析、前后台联动设计与工程底线测试结果。
- 最终代码必须完整提交（commit）并推送（push）到 GitHub 远程仓库，确保部署流程无缝衔接。
