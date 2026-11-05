<div align="center">

# 🌸 画廊随想 (Gallery Blog)

> **Anime Luminescence × Serverless Edge Native × Dense DataGrid**  
> An edge-native personal gallery blog and knowledge hub powered by Cloudflare Workers, Pages, D1 Database, and R2 Object Storage.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Deploy: Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare_Workers-f38020.svg?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![Framework: React 18](https://img.shields.io/badge/React-18.x-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![Bundle Size: 131.42 kB](https://img.shields.io/badge/Bundle_Size-131.42_kB_(gzip:_38.37_kB)-brightgreen.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Size Reduction: 97.7%](https://img.shields.io/badge/Size_Drop-97.7%25-ff4d79.svg?style=flat-square)]()
[![Tests: 484 Passing](https://img.shields.io/badge/Tests-484_Passing_%7C_54_Suites-success.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![Security: CSP Zero Eval](https://img.shields.io/badge/Security-CSP_Zero_Eval_Hardened-blue.svg?style=flat-square&logo=shield)](https://developer.mozilla.org/)

[English](README.md) · [简体中文](README_zh_CN.md) · [GitHub 仓库](https://github.com/Smail-droid/Rin) · [🌸 画廊随想架构全景词典](画廊随想.md) · [更新日志 (Changelog)](CHANGELOG.md)

</div>

---

## 🌟 项目简介 (Overview)

**画廊随想 (Gallery Blog)** 是一座融合**“一页一世界”**美学哲学与现代边缘计算架构的个人画廊博客与知识库系统。全站摒弃千篇一律的单调长列表，从第一行代码起完成全方位的深度重构：

- **二次元微光美学体系**：拟态柔光毛玻璃（`backdrop-blur-md`）、拍立得自然错落手账质感（`rotate-[-1.8°]` 自然倾角）、时光长河中轴脉冲轴、Mac 极客终端三色圆点容器与海报三区空间隔离飞跃弹幕。
- **极致工程性能**：经由 Vite `manualChunks` 代码分割手术，首屏入口核心 JS 从 5.68 MB 锐减至 **131.42 kB (gzip 后 38.37 kB)**，**体积降幅达 97.7%**。Monaco 编辑器 (3.88MB)、Mermaid 引擎 (3.07MB) 及 Prism 代码高亮 (631kB) 实现 100% 动态按需懒加载。
- **高密单屏超级数据表格 (Dense DataGrid)**：全站管理后台拒绝疲劳拖拽，单屏高密容纳所有业务指标；文章管理集成封面大图预览与快捷图床置换、Pin/Sticky 置顶优先机制、多维表头排序与标准底部分页栏。
- **边缘 AI 智能流水线**：友链与导航画廊引入 URL 元数据自动嗅探、Worker AI 自动提炼与标签映射、高可用 Favicon 代理兜底及游客免登录申请审核流。
- **全栈质量保证**：54 个测试套件，484 项自动化测试 100% 绿灯全通；严格 CSP (Zero Eval) 杜绝动态 eval 注入，打造坚不可摧的边缘安全堡垒。

---

## 🚀 Quick Deployment (Multi-Platform)

### Option 1: GitHub Fork + Actions Automation Pipeline (Strongly Recommended ⭐)

Best for bloggers who prefer zero physical server maintenance while enjoying global Cloudflare edge CDN acceleration:

1. **Fork this repository** to your personal GitHub account:
   ```text
   Repository URL: https://github.com/Smail-droid/Rin
   ```
2. Create a **D1 Database** (recommended name: `rin`) and an **R2 Bucket** (recommended name: `rin`) in your Cloudflare dashboard.
3. Generate a **Cloudflare API Token** with edit permissions for Workers, Pages, D1, and R2.
4. In your forked GitHub repository, go to **Settings ➔ Secrets and variables ➔ Actions** and configure the following parameters:

#### 1. Secrets Configuration

| Secret Name | Required | Example / Recommended Value | Description |
| :--- | :---: | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | **Yes** | `Cloudflare_API_Token` | API Token with deployment permissions generated in Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | **Yes** | `32-char Account_ID` | Global 32-character Account ID from Cloudflare dashboard |
| `ADMIN_USERNAME` | **Yes** | `admin` | Superadmin username for initial blog setup |
| `ADMIN_PASSWORD` | **Yes** | `your_strong_password` | Superadmin initial login password |
| `JWT_SECRET` | No | `32+ char random string` | Secret key for signing authentication sessions and tokens |

#### 2. Variables Configuration

| Variable Name | Required | Example / Recommended Value | Description |
| :--- | :---: | :--- | :--- |
| `S3_ACCESS_HOST` | No | `https://img.example.com` | **Custom domain for R2 image acceleration (optional)**. Falls back to Worker `/api/blob/*` route if unconfigured |

5. Navigate to the **Actions** tab in your repository and manually trigger the **Deploy** workflow to automatically run TypeScript checks, frontend build, database migrations, and deploy globally.

---

### Option 2: VPS Containerized Deployment (Docker Compose)

Best for users who prefer standard Docker container workflows:

```bash
# 1. Clone repository
git clone https://github.com/Smail-droid/Rin.git
cd Rin

# 2. Build and launch in background
docker compose up -d --build
```

The service will run on `http://YOUR_SERVER_IP:11498`. All articles, settings, and database storage persist in `./data`.

---

### Option 3: Debian / Ubuntu Native Lightweight Deployment (Bun + Systemd + Nginx / Caddy)

**Best for low-spec VPS (ultra-low memory footprint)**: Compared to Docker, native Bun execution requires only **60MB ~ 120MB RAM**, running blazingly fast even on cheap 512MB or 1GB VPS instances!

#### 1. Install Essentials & Bun Runtime
```bash
sudo apt update && sudo apt install -y curl git unzip build-essential nginx certbot python3-certbot-nginx
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

#### 2. Clone & Build
```bash
cd /var/www
git clone https://github.com/Smail-droid/Rin.git
cd Rin

bun install
bun run build

# Generate local configuration and run SQLite database migration
bun run dev:setup
bun run db:migrate
```
*(Tip: You can edit `.dev.vars` to customize `ADMIN_USERNAME` and `ADMIN_PASSWORD`)*

#### 3. Setup Systemd Service
Create service file `/etc/systemd/system/rin.service`:
```ini
[Unit]
Description=Rin Gallery Blog Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/Rin
ExecStart=/root/.bun/bin/bun cli/bin/rin.ts dev --port 11498
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=11498
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now rin
```

#### 4. Configure Nginx Reverse Proxy with Auto SSL
Create `/etc/nginx/sites-available/rin.conf`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:11498;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable site and obtain free Let's Encrypt SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/rin.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

---

### Option 4: Direct CLI Edge Deployment (Without GitHub Actions)

Deploy directly to Cloudflare Pages & Workers from your local machine or Linux terminal:

```bash
export CLOUDFLARE_API_TOKEN="your_token"
export CLOUDFLARE_ACCOUNT_ID="your_account_id"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your_password"

# Directly build and deploy to Cloudflare edge network
bun run deploy
```

---

## 🛠️ 技术架构全景 (Technical Architecture)

| 架构分层 | 核心技术选型 | 特性与设计规范 |
| :--- | :--- | :--- |
| **前端框架** | React 18 / TypeScript / Vite 6 | 单页面（SPA）架构，极速 manualChunks 代码分割，首屏仅 131.42 kB |
| **设计美学** | TailwindCSS / RemixIcon | 二次元微光毛玻璃、拍立得和纸胶带、高密单屏超级数据表格 (Dense DataGrid) |
| **内容排版** | React-Markdown / Prism / Mermaid | 30+ 语言多色语法高亮、Mac 终端代码容器、运行时 DOM 图表异步嗅探 |
| **边缘服务** | Cloudflare Workers (`workerd`) | 全球边缘无服务器分布式运行架构，全冷启动耗时低于 15ms |
| **持久数据库** | Cloudflare D1 (SQLite) | 分布式边缘轻量关系型数据库，事务安全，读写延迟低至毫秒级 |
| **对象存储** | Cloudflare R2 (S3 API) | 兼容 S3 协议的高性能静态资源存储，永久 $0 出站流量费用 |
| **任务队列** | Cloudflare Task Queue | 边缘异步任务分发总线，驱动大模型 AI 摘要异步生成与错误自愈 |
| **工程测试** | Bun Native Test Runner (`bun:test`)| 54 个测试套件，484 项自动化测试全部通过（100% Green） |

---

## 📄 开源协议与致谢 (License & Acknowledgements)

- 本项目基于 [MIT License](LICENSE) 协议开源。
- 感谢官方上游项目 [openRin/Rin](https://github.com/openRin/Rin) 带来的优秀架构启发与开源生态贡献。
