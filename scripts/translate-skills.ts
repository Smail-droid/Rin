import fs from "fs";
import path from "path";

const skillsDir = "C:/Users/Administrator/.jeikcode/skills";

// 1. 核心中文映射表 (前 80 个核心技能 + 常用设计技能)
const translations: Record<string, string> = {
  "api-and-interface-design": "⚡【接口契约】稳定 API 与接口架构设计：规范 REST 端点、严格类型安全与前后端数据契约。",
  "ask-matt": "🧭【技能推荐】根据当前场景智能推荐最适合的工程技能与开发流程。",
  "brainstorming": "💡【灵感共创】创意构思与头脑风暴：在动手编写代码前发散设计灵感，梳理最优方案。",
  "browser-testing-with-devtools": "🌐【浏览器测试】通过 Chrome DevTools 检查真实 DOM 结构、网络瀑布流与前端报错。",
  "chief-of-staff": "👔【长程调度】多代理协同长程目标调度：跨模块推进复杂宏大任务。",
  "ci-cd-and-automation": "🚀【持续集成】自动化 CI/CD 流水线构建：配置 GitHub Actions 测试门禁与生产发布流程。",
  "claude-handoff": "🤝【会话交接】将会话平滑交接给全新的后台代理，零上下文断裂。",
  "code-review": "🧐【代码审查】双轴代码差异审查：核查是否符合仓库编码规范与需求规格说明。",
  "code-review-and-quality": "🛡️【代码审计】多维度深度代码审查：在合并前严格核查代码规范、潜在 Bug 与架构坏味道。",
  "code-simplification": "🧹【代码精炼】在不改变功能的前提下简化多层嵌套，清除废弃死代码与多余复杂度。",
  "codebase-design": "🏛️【系统架构】深度模块与代码库解耦设计：提升接口内聚度、降低系统耦合与增强可测试性。",
  "constraint-driven-development": "📏【质量红线】约束驱动开发：将分包体积、测试覆盖率与质量规范确立为不可逾越的硬契约。",
  "context-engineering": "🧠【上下文工程】优化 Agent 规则配置与上下文负载，保持高信噪比对话记忆。",
  "debugging-and-error-recovery": "🔍【排错调试】系统化定位全栈 Bug 根因，严查日志调用栈，杜绝盲猜，排查构建与运行时报错。",
  "deprecation-and-migration": "🔄【平滑迁移】安全废弃旧系统与接口，数据库无缝迁移，零停机架构演进。",
  "diagnosing-bugs": "🔎【故障诊断】收集日志、调用栈与异常快照，系统化缩小 Bug 排查范围。",
  "diagnosing-superpowers": "🔬【进阶诊断】深度环境探针诊断与极端边界条件推演。",
  "dispatching-parallel-agents": "⚡【并发调度】多子代理并行派发：多线程并行推进探索与独立子任务。",
  "documentation-and-adrs": "📑【架构决策】编写架构决策记录 (ADR) 与工程设计文档，沉淀技术选型。",
  "domain-modeling": "🧩【领域建模】梳理核心实体、值对象与业务状态机流转逻辑。",
  "doubt-driven-development": "❓【防御推演】质疑驱动开发：主动推演网络中断、空数据、超大文件与脏数据入侵边界。",
  "executing-plans": "🎯【计划推进】严格依循既定清单按序交付，实时同步原子任务推进状态。",
  "finishing-a-development-branch": "🏁【分支收尾】完成开发分支收尾、自检门禁运行与 PR 准备。",
  "frontend-ui-engineering": "🎨【前端工程】构建高颜值、无障碍、响应式的二次元微光与现代化 Web 用户界面。",
  "git-guardrails-claude-code": "🔒【安全门禁】Git 提交防护门禁：严格拦截密钥、Token 与个人隐私文件泄露。",
  "git-workflow-and-versioning": "🌿【版本管理】语义化版本控制 (SemVer) 与 Git 分支发布工作流规范。",
  "grill-me": "🔥【方案质疑】对当前技术方案展开高强度挑刺与压力测试，找出隐藏缺陷。",
  "grill-with-docs": "📖【文档质询】结合项目现有文档对架构设计展开严格质询与推演。",
  "grilling": "💬【深度盘问】针对架构决策与边界情况展开全方位推演盘问。",
  "handoff": "🤝【任务交接】整理当前任务进度并交接给后续 Agent。",
  "idea-refine": "✨【创意打磨】将模糊的发散灵感深化提炼为清晰可落地的工程技术规格。",
  "implement": "💻【功能实现】专注高效落地具体功能代码。",
  "implement-spec": "📋【规范实现】根据技术规范规格说明书精确落地代码。",
  "improve-codebase-architecture": "🏗️【架构重构】针对混乱耦合的代码库展开系统化解耦与架构演进。",
  "incremental-implementation": "🪜【增量迭代】微步前进，每一步都保证测试绿灯的小步增量实现法。",
  "interview-me": "🎙️【需求访谈】通过提问引导挖掘真实业务诉求与隐性边界条件。",
  "karpathy-guidelines": "📐【工程准则】遵循极简主义与纯粹可靠的一线代码工程规范。",
  "loop-me": "🔄【自循环执行】在后台自驱动迭代完成长任务循环。",
  "migrate-to-shoehorn": "📦【脚手架迁移】项目工程结构标准化迁移。",
  "observability-and-instrumentation": "📊【监控埋点】全栈可观测性建设：注入性能探针、日志埋点与健康度监控。",
  "performance-optimization": "⚡【性能优化】排查全栈性能瓶颈、内存泄漏、首屏加载体积与渲染卡顿。",
  "planning-and-task-breakdown": "📝【任务拆解】将复杂宏大目标拆解为原子化、易验证的清晰执行清单。",
  "pr": "🔀【Pull Request】编写规范详实、条理清晰的代码合并请求说明。",
  "prototype": "🧪【快速原型】极速搭建功能概念验证原型 (POC)。",
  "receiving-code-review": "📥【评审消化】分析审查反馈，区分建设性意见并落地改进。",
  "requesting-code-review": "📤【发起审查】整理改动脉络与验证证据，向上发起代码审查。",
  "research": "🔬【技术调研】针对新技术或棘手问题展开深度技术调研与对比。",
  "retro": "☕【团队复盘】项目复盘与工程迭代总结，沉淀长青经验。",
  "scaffold-exercises": "🛠️【脚手架搭建】快速搭建工程实验沙箱与测试用例模板。",
  "security-and-hardening": "🛡️【安全加固】排查注入漏洞、CSP 安全防护、鉴权加固与权限边界。",
  "setup-matt-pocock-skills": "⚙️【技能配置】初始化配置 Matt Pocock 推荐的开发者工具链。",
  "setup-pre-commit": "⚓【提交钩子】配置 Git Pre-commit 静态检查与格式化门禁。",
  "setup-ts-deep-modules": "🟦【TS模块化】配置严格 TypeScript 模块拓扑与路径别名。",
  "shipping-and-launch": "🚢【发版交付】产品发版全流程核验：产物体积、测试绿灯与上线检查。",
  "software-factory": "🏭【软件流水线】标准化代码工厂流水线推进规范。",
  "source-driven-development": "📜【源码驱动】基于第一手权威源码与底层定义驱动开发。",
  "spec-driven-development": "📐【规范驱动】先立技术规格说明，再行代码实现的研发模式。",
  "subagent-driven-development": "🤖【多代理协作】父代理规划监督、子代理隔离编码的协作开发模式。",
  "superpowers-test-driven-development": "🧪【超级TDD】深度集成自动化测试断言的测试驱动开发流。",
  "systematic-debugging": "🔍【系统排错】严谨的系统级根因调试：重现缺陷、假设验证与根治防复发。",
  "tdd": "🧪【测试驱动】经典 Red-Green-Refactor 测试驱动开发实践。",
  "teach": "🎓【技术讲解】通俗透彻地拆解复杂技术原理与代码逻辑。",
  "test-driven-development": "🧪【测试驱动开发】先写失败测试断言，再行实现代码，保卫全绿灯。",
  "to-questionnaire": "📋【问卷提炼】将发散沟通整理为结构化选择/问答清单。",
  "to-spec": "📄【规格提炼】将业务构想整理为严谨的技术实现规格书。",
  "to-tickets": "🎫【工单拆分】将功能模块拆解为敏捷开发 Issue/工单。",
  "triage": "🏥【缺陷分流】对新上报的 Bug 进行紧急程度评级与责任归类。",
  "using-agent-skills": "🧭【技能使用指南】如何最高效地联动与调度各类专业技能。",
  "using-git-worktrees": "🌲【Git工作区】使用 Git Worktrees 并行隔离开发多个特性分支。",
  "using-superpowers": "⚡【超能开发指南】激活全套高级代码工程方法论。",
  "verification-before-completion": "✅【终验门禁】在声称完成前执行全量类型检查与自动化测试。",
  "wait-what": "🛑【困惑求证】遇到歧义或矛盾逻辑时主动停下求证消除歧义。",
  "wayfinder": "🗺️【代码寻路】在陌生复杂代码库中快速定位关键逻辑与调用链。",
  "wizard": "🧙【向导流程】多步骤交互式配置向导推进流。",
  "writing-beats": "🎵【节奏编排】撰写引人入胜的叙事节奏与技术说明。",
  "writing-for-agents": "🤖【代理提示词】撰写高完成度、低幻觉的 AI 提示词与系统指令。",
  "writing-fragments": "🧩【片段写作】撰写高内聚、易组合的微型文本与组件文档。",
  "writing-plans": "📝【方案编写】撰写详尽完备的技术方案白皮书与执行步骤。",
  "writing-shape": "📐【行文结构】构建条理清晰、层次分明的技术写作框架。",
  "writing-skills": "✍️【技能编写】创建高质量标准化 JeikCode 技能规范指南。",

  // 设计类常用模板精粹
  "design-web-prototype": "🎨【前端美学】交互式 Web 网页原型设计：快速搭建高质量组件布局与响应式页面骨架。",
  "design-web-prototype-taste-soft": "🎨【前端美学】二次元柔和微光美学原型：日系微光圆角、粉白温润渐变与呼吸感卡片。",
  "design-web-prototype-taste-editorial": "🎨【前端美学】优雅杂志社论排版原型：精致衬线字体与图文阅读版面。",
  "design-web-prototype-taste-brutalist": "🎨【前端美学】极客新野兽派网页原型：粗线条边框与高对比终端质感。",
  "design-dashboard": "📊【数据大盘】现代化后台仪表盘设计：高密单屏数据大盘与统计图表网格。",
  "design-live-dashboard": "📊【实时大盘】动态实时数据监控大盘：微波动实时折线与指标状态胶囊。",
  "design-kanban-board": "📋【看板设计】现代化任务看板与工作台：流式状态卡片排布与交互式任务流转。",
  "design-mobile-app": "📱【移动界面】移动端界面设计：专为智能手机小屏幕触控优化的日系响应式布局。",
  "design-mobile-onboarding": "📱【移动引导】移动端开屏引导与配置向导界面。",
  "design-saas-landing": "✨【产品官网】SaaS 产品与服务落地页设计：高转化率视觉引导流。",
  "design-social-carousel": "🖼️【画廊轮播】相册与文章画廊轮播卡片流设计。",
  "design-motion-frames": "🎬【动效编排】CSS/Framer 关键帧微动效与平滑过渡动画编排。",
  "design-webgl-experience": "🌌【3D交互】WebGL 与 3D 粒子光影场景交互体验设计。",
  "design-audio-jingle": "🎵【音频音效】背景音乐、系统提示音与音频片段生成调度。",
  "design-critique": "🧐【设计评审】设计 5 维度深度评审：从哲学、视觉层级、细节、功能与创新 5 维度审计打分。",
  "design-tweaks": "🖌️【视觉精修】界面视觉微调精修：快速优化间距、配色饱和度与拟态细节。",
  "design-blog-post": "📝【长文排版】博文与长篇深度文章排版设计：标题、题图、引言与图文混排。",
  "design-contact-widget": "💬【联系挂件】独立悬浮客服/联系挂件与微光留言输入框。",
  "design-pricing-page": "💳【价格方案】服务定价方案对比卡片网格与功能勾选矩阵。",
  "design-dating-web": "🌸【社交画廊】二次元/现代社交画廊展示卡片与资料卡设计。",
  "design-docs-page": "📚【文档页面】现代化开发文档排版：侧边导航、正文锚点与代码块混排。",
  "design-email-marketing": "📧【邮件模版】自适应营销邮件与系统通知模板设计。",
  "design-eng-runbook": "📖【运维手册】工程运行手册与应急演练操作规范指南卡片。",
  "design-finance-report": "📈【财务报表】数据报表排版：收支平衡表与财务预测仪表板。",
  "design-gamified-app": "🎮【游戏化UI】游戏化应用界面：经验条、成就勋章与升级动效卡片。",
  "design-github-dashboard": "🐙【GitHub大盘】开源项目指标面板：Star 增长曲线与活跃 Issue 列表。",
  "design-invoice": "🧾【账单收据】极简商务账单与发票明细排版模板。",
  "design-meeting-notes": "📝【会议纪要】结构化会议记录卡片：议题、结论与待办分配。",
  "design-team-okrs": "🎯【团队OKR】目标与关键结果 (OKR) 跟踪看板与进度条排布。",
  "design-video-shortform": "📹【短视频卡片】短视频流展示容器、弹幕轨道与点赞交互原型。",
  "design-waitlist-page": "⏳【等候名单】内测预约排队页：倒计时、邮箱收集与特权卡片。",
  "design-weekly-update": "📅【周报展示】优雅周报排版：本周里程碑、阻碍项与下周计划。",
  "design-sprite-animation": "🕹️【逐帧动画】CSS/Canvas 精灵图逐帧动画编排组件。",
};

// 自动补全设计类 PPT / 模板的通用描述
function getFallbackChineseDesc(name: string): string {
  if (translations[name]) return translations[name];
  if (name.startsWith("design-html-ppt-zhangzara-")) {
    const sub = name.replace("design-html-ppt-zhangzara-", "");
    return `🎨【演示演示】zhangzara 精品幻灯片模板 [${sub}]：高审美艺术排版，支持长海报与全屏演讲。`;
  }
  if (name.startsWith("design-html-ppt-")) {
    const sub = name.replace("design-html-ppt-", "");
    return `🎨【演示演示】网页版 HTML PPT 演示文稿 [${sub}]：无重型依赖，原生响应式演讲幻灯。`;
  }
  if (name.startsWith("design-orbit-")) {
    const sub = name.replace("design-orbit-", "");
    return `🪐【微件集成】Orbit 微型卡片交互组件 [${sub}]：单屏紧凑集成方案。`;
  }
  if (name.startsWith("design-wireframe-")) {
    const sub = name.replace("design-wireframe-", "");
    return `📐【线框原型】低保真交互线框图 [${sub}]：快速推演页面信息架构与操作流。`;
  }
  if (name.startsWith("design-")) {
    const sub = name.replace("design-", "");
    return `🎨【前端设计】专业视觉与交互模板 [${sub}]：原生轻量响应式实现。`;
  }
  return `🛠️【工程工具】${name} 专业开发辅助技能。`;
}

// 执行全量 195 个技能描述的替换
let updatedCount = 0;
const entries = fs.readdirSync(skillsDir);

for (const skillName of entries) {
  const filePath = path.join(skillsDir, skillName, "SKILL.md");
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, "utf-8");
  const newDesc = getFallbackChineseDesc(skillName);

  // 解析并重构 YAML Frontmatter
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) continue;

  const frontmatter = match[1];
  const body = content.slice(match[0].length);

  // 替换其中的 description 字段
  let newFrontmatter = frontmatter;
  if (/description:\s*(\|[\s\S]*?(?=\r?\n[a-zA-Z0-9_\-]+:|$))/m.test(newFrontmatter)) {
    newFrontmatter = newFrontmatter.replace(
      /description:\s*(\|[\s\S]*?(?=\r?\n[a-zA-Z0-9_\-]+:|$))/m,
      `description: "${newDesc}"`
    );
  } else if (/description:\s*[^\r\n]*/.test(newFrontmatter)) {
    newFrontmatter = newFrontmatter.replace(
      /description:\s*[^\r\n]*/,
      `description: "${newDesc}"`
    );
  } else {
    newFrontmatter += `\ndescription: "${newDesc}"`;
  }

  const finalContent = `---\n${newFrontmatter.trim()}\n---${body}`;
  fs.writeFileSync(filePath, finalContent, "utf-8");
  updatedCount++;
}

console.log(`成功将 ${updatedCount} 个技能的 description 全量替换为中文分类描述！`);

// 2. 在 skillsDir 中建立常用的 ui-* 技能别名目录，方便用户输入 /ui 时直接聚拢选择
const uiShortcuts: { name: string; target: string; desc: string }[] = [
  {
    name: "ui",
    target: "frontend-ui-engineering",
    desc: "🌸【前端美学】画廊博客二次元微光与高密单屏超级表格 (Dense DataGrid) 综合工程",
  },
  {
    name: "ui-soft",
    target: "design-web-prototype-taste-soft",
    desc: "🎨【前端美学】二次元柔和微光美学原型：日系微光圆角、粉白温润渐变与呼吸感卡片",
  },
  {
    name: "ui-dashboard",
    target: "design-dashboard",
    desc: "📊【前端美学】现代化后台仪表盘设计：高密单屏超级数据大盘与统计图表网格",
  },
  {
    name: "ui-prototype",
    target: "design-web-prototype",
    desc: "🎨【前端美学】交互式 Web 网页原型快速搭建：组件布局与响应式页面骨架",
  },
  {
    name: "ui-kanban",
    target: "design-kanban-board",
    desc: "📋【前端美学】现代化任务看板与工作台：流式状态卡片排布与交互式流转",
  },
  {
    name: "ui-mobile",
    target: "design-mobile-app",
    desc: "📱【前端美学】智能手机小屏幕触控与日系响应式界面设计",
  },
  {
    name: "ui-critique",
    target: "design-critique",
    desc: "🧐【前端美学】设计 5 维度深度评审：从哲学、视觉层级、细节、功能与创新 5 维度审计打分",
  },
  {
    name: "ui-motion",
    target: "design-motion-frames",
    desc: "🎬【前端美学】CSS/Framer 关键帧微动效与平滑过渡动画编排",
  },
  {
    name: "ui-editorial",
    target: "design-web-prototype-taste-editorial",
    desc: "📝【前端美学】优雅杂志社论排版：精致衬线字体与图文阅读版面设计",
  },
  {
    name: "debug",
    target: "debugging-and-error-recovery",
    desc: "🔍【排错调试】全栈系统化根因排错：严查日志调用栈，杜绝盲猜，排查构建与运行时报错",
  },
  {
    name: "debug-browser",
    target: "browser-testing-with-devtools",
    desc: "🌐【排错调试】通过 Chrome DevTools 检查真实 DOM 结构、网络瀑布流与前端报错",
  },
  {
    name: "review",
    target: "code-review-and-quality",
    desc: "🛡️【代码审计】全方位多维度代码审查：在合并前严格核查代码规范、潜在 Bug 与架构坏味道",
  },
  {
    name: "plan",
    target: "planning-and-task-breakdown",
    desc: "📝【任务拆解】将复杂宏大目标拆解为原子化、易验证的清晰执行清单",
  },
  {
    name: "api",
    target: "api-and-interface-design",
    desc: "⚡【接口契约】稳定 API 与接口架构设计：规范 REST 端点、严格类型安全与前后端数据契约",
  },
  {
    name: "clean",
    target: "code-simplification",
    desc: "🧹【代码精炼】在不改变功能的前提下简化多层嵌套，清除废弃死代码与多余复杂度",
  },
];

let shortcutCount = 0;
for (const sc of uiShortcuts) {
  const scDir = path.join(skillsDir, sc.name);
  const targetFile = path.join(skillsDir, sc.target, "SKILL.md");

  let baseContent = "";
  if (fs.existsSync(targetFile)) {
    baseContent = fs.readFileSync(targetFile, "utf-8");
    // 清除原有 frontmatter
    baseContent = baseContent.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
  }

  if (!fs.existsSync(scDir)) {
    fs.mkdirSync(scDir, { recursive: true });
  }

  const scSkillContent = `---\nname: ${sc.name}\ndescription: "${sc.desc}"\n---\n${baseContent.trim()}`;
  fs.writeFileSync(path.join(scDir, "SKILL.md"), scSkillContent, "utf-8");
  shortcutCount++;
}

console.log(`成功在全局 ~/.jeikcode/skills 中建立了 ${shortcutCount} 个极速调取别名！`);
