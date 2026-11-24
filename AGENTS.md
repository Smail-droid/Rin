# AGENTS.md - 🌸 画廊随想 (Gallery Blog) AI 工程开发章程

> **核心定位**：代码工程严谨，视觉兼具独立画廊编辑部审美（参考 DesignSpells 展览留白、BentoGrids 模块化卡片与 Refero 静谧工作台秩序）。
> **文档分工**：本文件仅约束**工程流水线、技能调度、全链路验证与安全底线**；领域词汇见 `GLOSSARY.md`，不可逆架构取舍见 `docs/adr/`，可演进的视觉原则见 `docs/AESTHETIC_CHARTER.md`。

---

## 1. 核心构建命令与基础门禁 (Core Commands & Gates)

统一使用 **Bun** 作为工程脚本与测试执行器（统一使用 `bun:test`，绝不引入 Vitest/Jest）：

```bash
bun dev              # 启动全栈开发服 (前端 Vite + 边缘后端 Wrangler 端口 11498)
bun run check        # 全局 TypeScript 严格类型检查 (必须 0 报错)
bun run test         # 运行全栈自动化测试套件 (全量测试必须 100% 绿灯全通)
bun run build        # 生产编译打包 (重型库保持按需异步分包，守住首屏轻量化)
```

---

## 2. 渐进式文档指针 (Context Pointers)

遇到对应分支时按需加载，不在任务无关时盲读堆满上下文：

- **领域概念与组件命名出现歧义或新增实体** → 先读 `GLOSSARY.md`，使用统一规范词汇（禁止混用别名）。
- **改动全局导航、主题令牌、存储解耦或前后端契约边界** → 先检索 `docs/adr/` 确认历史决策上下文；形成新的重大不可逆取舍时，补充顺序编号 ADR。
- **任何前端界面、排版、主题、特效、组件化可调性变更** → 必读 `docs/AESTHETIC_CHARTER.md`。**章程只规定架构边界、对比度红线与配置驱动原则，绝不把色号或单一版式写死为教条；站长最新美学要求永远优先于旧静态描述，并在达成一致后同步更新章程。**

---

## 3. 长青工程设计准则 (Evergreen Engineering Guardrails)

1. **按需分包底线**：重型编辑/渲染库（Monaco Editor、Mermaid、SyntaxHighlighter 等）一律动态 `import()` 异步加载，严禁静默打包进首屏主入口。
2. **真·配置驱动视图 (True Config-Driven Presentation)**：所有对外呈现的样式、主题方案、字体字阶、标题效果、导航布局与页面密度都必须由**真实生效的 CSS 语义令牌与配置项**驱动；严禁造出“有按钮/有预设名但实际渲染无变化”的空壳假预设，也严禁在业务代码里硬编码截断用户内容或写死不可配置的外观常量。
3. **非阻塞反馈原则 (Non-Blocking Feedback)**：常规保存、复制与轻量操作直接在按钮原地反馈状态（如 `保存中…` → `✓ 已保存`）或使用非阻塞式轻量 Toast；**阻塞式确认弹窗（Alert Modal）仅在发生真实报错或不可逆删除二次确认（Confirm）时触发**。
4. **适材适所的界面密度**：设置面板、概览与媒体墙优先采用 **Bento Grid 模块化卡片**与**画廊留白布局**，避免强行把所有设置和卡片压成“单行长条”或“超级密度表格”；仅在批量多列记录场景（如任务队列、曲目明细表）按需使用高密数据表格。
5. **显式布尔三元防漏 0**：SQLite 返回的整型布尔值（`top`、`accepted`、`approved` 的 `0` 和 `1`）必须使用显式布尔三元运算渲染：`{isTop ? <Badge /> : null}`，杜绝短路求值将数字 `0` 漏出界面。
6. **资产存储与展示队列彻底解耦**：播放列表仅为展示队列（Playback Queue），清库或移出歌单仅改播放器配置，绝不触碰 Cloudflare R2 真实媒体文件；物理删除严格收拢在管理员专属资产视图并附二次确认。
7. **友链资产与完整简介保护**：严禁使用已被反爬拦截的公共代理抓取友链数据；图片抓取兼容二进制与原生 `<svg>`；更正逻辑严格保护用户手动填写的站名与完整简介，非占位符绝不覆盖或人为截断。
8. **数据驱动与动态检索**：曲库、歌手、流派、AI 模型与搜索统一由边缘服务端接口动态驱动，不在前端堆砌脆弱静态字典。

---

## 4. 智能体工程闭环：Plan 驱动、代码图谱寻路、子代理并行与全链路真机验真

> **严禁盲目游荡与“顾头不顾尾”**：禁止未规划开工、连续串行盲读代码，以及只顾单一页面、只看 JSDOM 红绿测试就宣布完成。

### 4.1 标准 Plan 5 步流水线 (The Plan-First Pipeline)

1. **Step 1: 结构化拆解与前置澄清 (`grill-with-docs` / `plan` / `to-spec` / `to-tickets`)**
   - 存在设计分支或审美取舍时，先触发 `grill-with-docs` 明确边界并沉淀进文档；
   - 凡涉及多步骤任务（>2 步），立即自主触发 `plan`（大型特性经 `to-spec` → `to-tickets`），调用 `todo_write` 拆解为**垂直切片 (Tracer Bullets)**，明确 **Blocking Edges** 与**就绪前沿 (Frontier)**。
2. **Step 2: 代码图谱拓扑寻路与影响面评估 (`code_explore` First)**
   - **图谱优先**：针对跨模块逻辑、共享样式/配置、类型契约或复杂故障，必须优先调用 `code_explore`（支持自然语言意图与精确符号检索），一次性锁定核心定义、读写位点（write/use sites）与上下游调用拓扑；
   - **牵一发动全身检查清单**：修改任何共享组件（`Header`、`PageHeader`、`Modal`、`ImageWithFallback`、主题令牌、配置 Schema、API 响应）时，**必须**顺藤摸瓜列出全部消费页面（首页 `/` 4 种版式、`/feed/:id`、`/timeline`、`/moments`、`/hashtags`、`/friends`、`/music`、`/gallery`、`/admin/*`）纳入本次排查与验证范围。
3. **Step 3: 子代理并行分治 (`task` Concurrency)**
   - **≥3 模块强制并发**：涉及 3 个及以上独立模块、跨页面改造或全链路排查时，主线程严禁单步串行硬扛，必须拆分为互不阻塞的并行子任务派发 `task`（`explore` 仅读调研 / `worker` 划定独立 `scope` 并行落地）；
   - **同轮并发与串行熔断**：已知多个关联目标文件时，在同一轮中并发调用 `Read` / `Edit`；主线程连续单步 `Read` 不得超过 2 次，超过立即熔断切换 `code_explore` 或并发子代理。
4. **Step 4: 接缝测试驱动落地 (`tdd` / `implement` / `implement-spec`)**
   - 在约定的公共接缝（Seams）处按 Red → Green 垂直循环编写行为测试，禁止耦合私有内部实现；
   - 组件无条件置顶 React Hooks（防 React Error #310），变更完所有关联切片后一次性做完整验证。
5. **Step 5: 双轴审查 + 关联页面契约联查 + 轻量验真 (Review & Verification Gate)**
   - 自主运行 `code-review`（Standards + Spec 双轴审查）与 `review`，执行 `bun run check`、`bun run test`、`bun run build`；
   - **轻量按需验真（严禁全站无节制暴力截图）**：杜绝每轮盲目对全站所有路由无头截图（防止触发 API 限流与巨额 Token 消耗）。日常以 TypeScript 严格类型、自动化单元测试与关键接缝行为断言为准；仅在用户显式要求视觉核验或排查特定渲染破损时，针对单一目标组件或受影响局部进行最小化轻量抽查。
   - **关联影响面自查**：修改共享组件（`Header`、`PageHeader`、`Modal`、主题令牌、配置 Schema）时，通过代码调用拓扑顺藤摸瓜核对消费页面，确认接口契约与版心对齐无异常。

### 4.2 任务分级路由
- **已知单点小改**（明确单文件文案/小样式/断言微调）：直接 `Read` → `Edit` → 对应验证，不空转派发子代理。
- **跨模块功能、全栈缺陷、系统美化重构**：严格执行上述 **Plan 5 步流水线**。

---

## 5. 全生命周期技能自动调度矩阵 (Autonomous Skill Orchestration)

环境中已挂载专业技能库。Agent 应依据当前所处阶段与用户意图**主动感知并调用对应技能**，无需用户手工逐个敲斜杠命令：

| 工程阶段 / 触发场景 | 必须自动联动调用的技能 | 核心职责与输出标准 |
| :--- | :--- | :--- |
| **构想发散 / 美学与架构重构前** | `grill-with-docs`（内含 `grilling` + `domain-modeling`） / 遇歧义用 `wait-what` | 逐轮收敛模糊决策、消除文档与现状冲突、维护 `GLOSSARY.md` 与 `docs/adr/` |
| **需求整理与工单拓扑拆解** | `to-spec` → `to-tickets` → `plan` | 提炼可测 Seams 与垂直切片，用 `todo_write` 追踪就绪前沿并协调并行分治 |
| **系统架构、深模块与解耦演进** | `codebase-design` + `improve-codebase-architecture` | 把复杂度收拢到深模块（Deep Module）接缝后，拒绝脆弱补丁与重复壳子 |
| **前端美学、色彩系统与排版重塑** | `frontend-design` + `ui-ux-pro-max` + `tailwind-design-system` | 建立差异化设计令牌（画布/表面/墨色/描边/暗黑映射）、字阶与高审美组件 |
| **像素验收、无障碍与弹性微动效** | `web-design-guidelines` + `web-accessibility` + `ui-animation` | 审查留白、对齐、WCAG 对比度、键盘可达性与平滑动效 |
| **后端接口与边缘服务设计** | `api` | 规范 Hono 路由、协议兼容（如多 AI 厂商适配）、边缘流控与类型契约 |
| **代码精炼与去噪** | `clean` | 消除死代码、扁平化嵌套、清除无效多余胶囊与重复包装 |
| **疑难故障与浏览器真实调试** | `diagnosing-bugs` + `debug` + Chrome/Puppeteer 实测脚本 | 构建可红可绿最小复现闭环，排查 Worker 限制、异步竞态、DOM/网络瀑布与真机截图 |
| **测试驱动与特性实现** | `tdd` + `implement` / `implement-spec` | 仅在公共 Seams 写外部行为测试，多子代理按 Frontier 并发推进 |
| **双轴审查与工程环境进化** | `code-review` + `review` → `retro` + `writing-for-agents` | 规范轴 + 规格轴并发独立审 diff；复盘将高频错误转化为自动化门禁与精炼文档 |

> **重要纠偏**：`.jeikcode/skills/ui` 中早期硬编码色号（如 `#ff4d79` 等）仅作历史参考，不再作为强制样式标准；所有现代视觉实现以本矩阵技能、`docs/AESTHETIC_CHARTER.md` 与站点实时配置为准。

---

## 6. 不可逾越的安全与工程底线 (Non-negotiable Baseline)

1. **严格 CSP (Zero Eval 沙盒)**：全站禁用 `'unsafe-eval'`，严禁 `eval()`、`new Function()` 或字符串参数 `setTimeout`/`setInterval`。
2. **密码学安全随机源**：通行证、Token 及哈希校验统一使用 `crypto.getRandomValues()`，严禁 `Math.random()`。
3. **React Portal 解决遮挡**：大图灯箱、顶层弹窗与下拉浮层统一使用 `createPortal` 挂载至 `document.body` 并提权至 `z-[9999]`。
4. **暗黑模式控件隔离**：禁止对表单 `<input>` / `<textarea>` 套用带重阴影和毛玻璃模糊的容器类；下拉弹层需适配暗黑防白底。
5. **时区标准化与路由回顶**：SQLite 无时区时间字符串统一补齐 UTC 标准化解析；跨页面跳转保持视口归零回顶。
6. **风控与防泄漏**：友链探测 4 秒熔断并支持无代理兜底；访客留言含外链转待审（`approved = 0`）；严禁将私钥、Token、`.env` 提交至仓库。
7. **React Hooks 铁律（严防 Error #310）**：所有 Hooks 必须无条件置于组件最顶层，严禁放在任何提前 `return`、条件分支或循环之后。

---

## 7. 交付与提交前门禁 (Delivery & Pre-Commit Checklist)

1. [ ] `bun run check` 0 报错，`bun run test` 全量绿灯全通，`bun run build` 重型库保持独立异步分包。
2. [ ] 已用 `code_explore` / 关联检查核对**全部受影响页面**，确认未因改一处而破另一处（无顾头不顾尾）。
3. [ ] 关联受影响页面契约与布局对齐已核对，非阻塞反馈与权限隔离验证无误（杜绝盲目全站重复截图消耗额度与触发限流）。
4. [ ] 严格遵守提交范围纪律，仅提交本次实际修改的关联文件；若触发 `commit` / `push`，确保干净推送到远程仓库。
