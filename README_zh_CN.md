<div align="center">

# 🌸 [Rin (Fork 魔改增强版)](https://github.com/Smail-droid/Rin)

> **基于 Cloudflare 全栈 Serverless 架构的现代化极客画廊个人博客与知识库**  
> *Cloudflare Pages + Workers + D1 数据库 + R2 存储桶 · 杂志级画廊排版 · 二次元微光美学 · AI 写作副驾驶*

[![License: MIT](https://img.shields.io/badge/License-MIT-pink.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare_Workers-f38020.svg?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![React 18](https://img.shields.io/badge/React-18.x-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/Tests-484_Passing-brightgreen.svg?style=flat-square)]()
[![Code Splitting](https://img.shields.io/badge/Bundle_Size-131KB_(97.7%25_Off)-purple.svg?style=flat-square)]()

[在线演示](https://blog.170705.xyz) · [对比官方原版](#️-魔改增强版-vs-官方原版核心对比-comparison-with-official-rin) · [快速部署](#-快速部署-deployment-guides) · [VPS 部署指南](#方案三vps-系统独立部署指南docker-或原生运行) · [更新日志](./更新日志.md) · [提交反馈](https://github.com/Smail-droid/Rin/issues)

</div>

---

> 📌 **分支版本声明 (Fork Notice)**：  
> 本项目为基于官方开源项目 [openRin/Rin](https://github.com/openRin/Rin) 的**深度魔改增强分支**。在继承官方优秀的边缘原生 Serverless 架构基础上，进行了前台访客极致瘦身（5.68MB ➔ 131KB 代码分割）、12 种艺术字效、手风琴折叠设置卡片、画廊二次元弹幕留言板、Mac 终端 Bash 代码块风格朋友圈动态、以及可自由拖拽移动的 AI 萌娘创作伴侣等多维度重构。

---

## 📖 项目简介 (Overview)

**Rin** 借助由 Cloudflare Workers、D1 和 R2 提供支持的边缘原生架构，让写作者能够以更快的速度发布内容，全球访客毫秒级冷启动访问。

本魔改分支将博客打造为一套专为极客、写作者与二次元爱好者量身定制的沉浸式全栈单页面（SPA）画廊空间。彻底摆脱传统博客千篇一律的刻板模版，以“**一页一世界**”为视觉准则，融合拟态毛玻璃（Glassmorphism）、拍立得相框便签、岁月刻度时间轴、自适应画廊海报与流动弹幕留言墙。

全站后端采用 Cloudflare 全家桶，全球边缘边缘计算零服务器运维成本，同时兼顾传统 VPS 独立服务器部署支持。

<div align="center">
  <img src="https://blog.170705.xyz/api/blob/images/3015b1ab75c482ef5309ce917f0cffffff348556.png" alt="Rin Preview Banner" width="100%" style="border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.15);" />
</div>

---

## ⚖️ 魔改增强版 vs 官方原版核心对比 (Comparison with Official Rin)

| 核心对比维度 | 官方原版 (openRin/Rin) | 本 Fork 魔改增强版 (Smail-droid/Rin) |
| :--- | :--- | :--- |
| **首屏包体积** | 主入口单包 **> 5.68 MB** (未拆分) | **131.42 kB** (gzip 后 **38.37 kB**)，**体积骤降 97.7%** ⚡ |
| **重型依赖加载** | Monaco Editor 与 Mermaid 强捆绑主包 | **100% 按需动态懒加载**，Mermaid 运行时智能嗅探 |
| **视觉与排版** | 传统通用极简文字列表 | **沉浸式二次元艺术画廊**、拍立得相框便签、和纸胶带错落微动效 |
| **艺术字效** | 基础标题展示 | **4列 × 3行（12 种）艺术字体特效** (涵盖像素/软糖/哥特/蒸汽波等) |
| **画廊留言板** | 基础表单评论 | **免填邮箱网站** + Dicebear 动漫头像 + 5大二次元 Emoji + 纯净 Markdown 工具栏 + 弹幕飘窗 |
| **朋友圈 (说说)** | 单调白底卡片 | **Mac Traffic Light 终端 Bash 代码块边框** + 8大心情胶囊 + 轻量编辑器 |
| **便签分页隔离** | 翻页后便签可能重复混入文章流 | **首屏/第一页严格隔离**，后续翻页 100% 纯照片文章流，杜绝穿透 |
| **便签排布模式** | 仅支持固定槽位插入 | **支持九宫格黄金分割分布、智能随机洗牌、固定顺序三种模式** |
| **图床管理** | 静态跳转卡片 | **“记忆翻动”卡片支持直接拖入图片自动上传 R2 并复制直链** |
| **后台设置体验** | 3000px 超长列表，底部易被保存条遮挡 | **手风琴折叠卡片 (省 2000px) + 下拉智能防溢出翻转 + z-50 提权** |
| **就地快捷操作** | 任何设置与创作必须跳转深层后台 | **首页右下角常驻创作画笔 ✍️ + 就地抽屉配置面板 ⚙️** (即调即存) |
| **AI 创作流水线**| 单一基础摘要提取 | **3 阶段流水线 (提炼 ➔ 排版 ➔ 导读)**，支持任意组合与可拖拽 AI 萌娘伴侣 |
| **部署生态** | 仅支持 Cloudflare 部署 | **支持 Cloudflare 全家桶 + 独立 VPS Docker Compose 容器化** |
| **测试套件** | 基础单元测试 | **54 个测试套件，484 项测试全部通过 (100% Passing)** |

---

## ✨ 核心特性 (Features)

### ⚡ 极致性能：前台访客 98% 极致代码分割
- **主包体积暴降 97.7%**：首屏入口 JS 从 **5.68 MB** 骤降至 **131 kB**（gzip 后仅 **38 kB**），首屏秒开。
- **重型依赖彻底剥离**：
  - **Monaco Editor (3.88 MB)**：完全移入按需独立 Chunk，普通访客看文章/说说 0 字节开销。
  - **Mermaid & Cytoscape (3.07 MB)**：图表库运行时按需嗅探，只有文章真正含有 Mermaid 语法时才异步加载。
- **纯净构建**：优化 Rollup 分包拓扑，彻底消灭循环依赖告警。

### 🎨 沉浸式二次元画廊美学
- **自适应艺术封面画框**：采用“环境弥散光晕 + 无损居中原图”双层画框渲染，杜绝构图裁切，配备 Lightbox 全屏沉浸式画廊大图预览。
- **画廊便签留言板 & 实时弹幕飘窗**：
  - 彻底去除繁琐的邮箱与网站输入项，零门槛轻松互动；
  - 接入 **Dicebear Lorelei** 极简动漫头像 API 与 30+ 预设二次元角色昵称，配备本地 SVG 容灾防破图保护；
  - 5 大二次元专属 Emoji 萌系分类（🌸 傲娇软萌、🍵 摸鱼干饭、🎮 宅家战斗、🐾 萌宠治愈、✨ 奇迹魔法）；
  - 配备**轻量 Markdown 格式工具栏**，留言支持 Mac 终端风格代码块渲染；
  - 留言以半透明玻璃弹幕（Danmaku Stream）自适应缓缓飘过。
- **4列 × 3行（12 种）艺术字体效果**：
  - 彩虹极光、琉璃晶透、赛博霓虹、水墨宣纸、落日熔金、现代立体浮雕、经典纯黑、**复古像素街机**、**二次元梦幻软糖**、**暗夜哥特金属**、**蒸汽波复古浪潮**、**星空极夜璀璨**。
- **后台设置折叠手风琴（Collapsible Accordion）化**：
  - 便签卡片设置支持折叠手风琴展示，节省 2000px 篇幅，清爽整洁；
  - 下拉菜单智能向上/向下翻转检测，彻底消除底部浮动保存卡片遮挡选项的问题。

### 💻 极客终端风格：朋友圈（说说）动态
- **Mac Terminal Bash 代码块风格边框**：
  - 动态卡片拥有标志性 **Mac Traffic Light（红黄绿三色胶囊圆点）** 与终端路径标识，四周不再是无趣的死板留白；
  - 正文中包含的代码块渲染为专属 Mac 终端窗口；
  - 管理员发布界面升级为留言板式轻量编辑器，支持 `🐱 卖萌中`、`🍵 摸鱼中`、`☕ 随言随笔` 等 8 大心情状态快速切换与注入。

### 🤖 AI 创作副驾驶 & 萌娘伴侣
- **自由拖拽移动（Draggable Window）**：
  - 伴侣浮窗默认停靠在右侧工作区，支持在屏幕内随心拖拽放置，双击顶栏瞬间复位；
  - 搭配二次元萌娘矢量头像与玻璃拟态画廊风；
- **多模型支持与流水线**：
  - 支持 DeepSeek、OpenAI、Cloudflare Worker AI 与 Google Gemini；
  - 集成极客架构师、金牌排版润色、代码安全审查等专家预设；
  - 3 阶段智能流水线彻底过滤套话，直出核心要点。

---

## 🛠️ 技术架构 (Tech Stack)

```text
Rin Monorepo
├── client/         # React 18 + Vite + TailwindCSS + Wouter (单页面前端)
├── server/         # Cloudflare Workers (Hono 风格路由) + Drizzle ORM
├── packages/
│   ├── api/        # 前后端类型安全的共享契约与 DTO
│   ├── config/     # 统一配置中心与默认参数模型
│   └── ui/         # 共享原子 UI 组件库
└── cli/            # 工程化本地运维与部署 CLI (bun:test)
```

| 层次 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端应用** | React 18 / TypeScript / Vite | 极速响应，组件化单页面架构，极致代码分割 |
| **样式与动画** | TailwindCSS / RemixIcon / CSS Tokens | 拟态毛玻璃、动态主题变量、12 种艺术字体特效 |
| **富文本排版** | React-Markdown / Prism / KaTeX | 数学公式、Mermaid 流程图、Mac 风格终端代码块 |
| **边缘服务端** | Cloudflare Workers | 全球边缘计算，0 冷启动延迟 |
| **数据库** | Cloudflare D1 (SQLite) | 异步并发读写防锁表优化 |
| **对象存储** | Cloudflare R2 | 图床与资源强缓存直链，支持自定义域防刷量 |
| **测试套件** | Bun Native Test Runner (`bun:test`) | 54 个测试套件，484 项测试 100% 保持全绿通过 |

---

## 🚀 快速部署 (Deployment Guides)

### 方案一：GitHub Fork + Actions 自动化流水线（初学者最推荐 ⭐⭐⭐⭐⭐）

1. **Fork 本仓库**到你自己的个人 GitHub 账号；
2. 在 Cloudflare 控制台创建 D1 数据库 `rin` 与 R2 存储桶 `rin`，并生成 API Token；
3. 在 Fork 后的 GitHub 仓库配置如下机密与变量：
   - **Secrets**：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`ADMIN_USERNAME`、`ADMIN_PASSWORD`；
   - **Variables**：`S3_ACCESS_HOST`（你的图床二级域名，如 `https://img.170705.xyz`）；
4. 进入 **Actions** 选项卡点击 **Run workflow** 触发部署，自动构建并上线！

### 方案二：VPS 独立容器化部署（Docker Compose）

```bash
git clone https://github.com/Smail-droid/Rin.git && cd Rin
docker compose up -d --build
```
服务将在 `http://你的服务器IP:11498` 启动，本地数据自动持久化映射在 `./data`。

---

## 📄 开源协议与致谢 (License & Acknowledgements)

- 本项目基于 [MIT License](LICENSE) 协议开源。
- 感谢官方上游项目 [openRin/Rin](https://github.com/openRin/Rin) 带来的优秀架构启发。
