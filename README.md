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

[在线演示](https://blog.170705.xyz) · [快速部署](#-快速部署) · [VPS 部署指南](#-vps-系统独立部署指南) · [架构文档](#-技术架构) · [更新日志](./更新日志.md) · [提交反馈](https://github.com/Smail-droid/Rin/issues)

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

本项目提供 **4 种灵活可行的部署方式**，无论是初学者还是资深运维，都能找到最适合自己的方案：

### 方案一：GitHub Fork + Actions 自动化流水线（初学者最推荐 ⭐⭐⭐⭐⭐）

这是**最简单、完全免费且免运维**的发布方案。你只需将本仓库 Fork 到你自己的 GitHub 账号下，后续每次在 GitHub 网页上修改文章或提交代码，GitHub Actions 都会全自动构建并秒级部署至 Cloudflare！

#### 1. Fork 本仓库
点击本页面右上角 **Fork** 按钮，复制一份仓库到你的 GitHub 个人账号。

#### 2. 在 Cloudflare 控制台创建 API Token 与资源
1. 注册并登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **My Profile（我的个人资料）** ➔ **API Tokens** ➔ **Create Token**。
3. 选择 **Edit Cloudflare Workers** 模板（权限需包含 Workers Scripts、Account Settings、D1、R2 等读写权限）。
4. 记录生成的 `API Token` 与你的 Cloudflare `Account ID`（在任意域名 Overview 页面右下角可查）。
5. 在 Cloudflare 控制台 **D1** 中创建一个名为 `rin` 的数据库；在 **R2** 中创建一个名为 `rin` 的存储桶。

#### 3. 配置 GitHub 仓库 Secrets
在你自己 Fork 的 GitHub 仓库中，点击 **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **New repository secret**，添加如下变量：

| Secret 名称 | 必填 | 描述 |
| :--- | :---: | :--- |
| `CLOUDFLARE_API_TOKEN` | 是 | 刚刚生成的 Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | 你的 Cloudflare Account ID（32位字符） |
| `ADMIN_USERNAME` | 是 | 你的博客管理员登录用户名 |
| `ADMIN_PASSWORD` | 是 | 你的博客管理员登录初始密码 |
| `JWT_SECRET` | 否 | 任意随机长字符串（用于 Session 加密，建议填写） |

*(可选环境变量 Variables)*：可以在 `Variables` 选项卡添加 `S3_ACCESS_HOST`（你的 R2 自定义域名，如 `https://img.yourdomain.com`）。

#### 4. 触发全自动发布
进入 GitHub 仓库的 **Actions** 选项卡，手动触发一次 `Build` 工作流，或者向 `main` 分支提交一次修改，GitHub Actions 将会自动执行类型检查、前端编译、D1 表结构迁移并推送上线！

---

### 方案二：本地 Rin CLI 一键极速部署（开发者推荐）

本地拥有 [Bun](https://bun.sh/)（v1.2+）与 Node.js 18+ 环境：

```bash
# 1. 克隆你的 Fork 仓库
git clone https://github.com/Smail-droid/Rin.git
cd Rin

# 2. 安装项目依赖
bun install

# 3. 登录 Cloudflare 授权
bun x wrangler login

# 4. 生成并执行数据库迁移
bun run db:generate
bun run db:migrate

# 5. 一键全自动编译并部署到 Cloudflare
bun run deploy
```

---

### 方案三：VPS 系统独立部署指南（Docker 或原生运行）

如果你希望将整个博客部署在自己的 Linux VPS 云服务器（Ubuntu / Debian / CentOS / 腾讯云 / 阿里云）上，不再依赖 Cloudflare Workers：

#### 选项 A：Docker Compose 一键容器化部署（最稳妥隔离）
确保你的 VPS 已安装 Docker 与 Docker Compose：

```bash
# 1. 克隆代码到 VPS
git clone https://github.com/Smail-droid/Rin.git
cd Rin

# 2. 一键构建并启动后台容器
docker compose up -d --build

# 3. 查看容器运行状态
docker compose ps
docker compose logs -f
```
启动后，全栈服务将运行在 `http://你的服务器IP:11498`。

#### 选项 B：原生 Bun + Nginx 反向代理与 Systemd 守护
```bash
# 1. VPS 上安装 Bun 运行时
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 2. 克隆项目并构建
git clone https://github.com/Smail-droid/Rin.git && cd Rin
bun install
bun run build

# 3. 启动后台全栈服务（默认端口 11498）
bun cli/bin/rin.ts dev &
```

配合 Nginx 反向代理配置（`/etc/nginx/conf.d/rin.conf`）：
```nginx
server {
    listen 80;
    server_name blog.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:11498;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 方案四：Cloudflare R2 自定义域 + CDN 边缘缓存防刷量最佳实践

如果你开启了 R2 图床，为了避免恶意流量反复请求图片消耗 Worker 免费额度和 R2 Class B 调用，**强烈建议配置 R2 自定义域名并开启 CDN 边缘缓存**：

1. **绑定自定义域名**：
   - 进入 Cloudflare 控制台 ➔ **R2** ➔ 点击你的存储桶 `rin` ➔ **Settings** ➔ **Custom Domains** ➔ 连接你的二级域名（例如 `img.yourdomain.com`）。
2. **设置忽略查询参数的边缘缓存规则（防御刷量）**：
   - 进入主域名 ➔ **Caching（缓存）** ➔ **Cache Rules（缓存规则）** ➔ 创建规则：
     - 条件：`Hostname == img.yourdomain.com`
     - 动作：符合缓存条件（Eligible for cache）、Edge TTL 设为 1 个月、Browser TTL 设为 1 个月、**Query String 设置为 Ignore query string（忽略查询字符串）**。
   - **效果**：攻击者即使使用带有随机参数的脚本（`?rand=123`）试图刷穿缓存，边缘 CDN 节点也会直接返回缓存中的图片，**0 次穿透到 R2，0 次计入 Class B 费用，出站流量完全 $0 免费**！
3. **在环境变量中注入加速域名**：
   - 在 `wrangler.toml` 或 GitHub Secret/Variable 中设置 `S3_ACCESS_HOST = "https://img.yourdomain.com"`。

---

## ⚙️ 核心配置说明 (Configuration)

| 变量名称 | 必填 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `DB` | 是 | `rin` | 绑定的 Cloudflare D1 数据库实例 |
| `AI` | 否 | - | 绑定的 Cloudflare Worker AI 实例 |
| `S3_FOLDER` | 否 | `images/` | R2 图床存储根目录 |
| `S3_ACCESS_HOST`| 否 | - | 自定义 CDN 加速域名（如 `https://img.yourdomain.com`） |
| `CACHE_STORAGE_MODE` | 否 | `database`| 缓存驱动模式（`database` 或 `s3`） |

---

## 🧪 自动化测试验证 (Testing)

本项目拥有极高覆盖率的单元与集成测试，覆盖身份认证、防 SSRF 保护、Webhook 通知、API 契约等全链路：

```bash
# 运行全栈测试 (54 个套件，484 项测试全部通过)
bun run test

# 检查 TypeScript 类型定义
bun run check
```

---

## 📄 开源协议与致谢 (License & Acknowledgements)

- 本项目基于 [MIT License](LICENSE) 协议开源。
- 感谢官方上游项目 [openRin/Rin](https://github.com/openRin/Rin) 带来的优秀架构启发。
- 欢迎 Star 🌟、Fork 并在其上定制专属你自己的二次元极客画廊小天地！
