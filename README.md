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

## 🚀 快速部署 (Quick Deployment)

### 方案一：GitHub Fork + Actions 自动化流水线（推荐）

1. **Fork 本仓库**到你的 GitHub 个人账号：
   ```text
   仓库主地址: https://github.com/Smail-droid/Rin
   ```
2. 在 Cloudflare 控制台创建 **D1 数据库**（名称推荐 `rin`）与 **R2 存储桶**（名称推荐 `rin`）。
3. 在 Cloudflare 个人账户生成具备 Workers、Pages、D1 与 R2 读写管理权限的 **Cloudflare API Token**。
4. 在你 Fork 后的 GitHub 仓库进入 **Settings ➔ Secrets and variables ➔ Actions**，配置如下参数：

#### 1. Secrets（机密凭证配置表）

| 参数名称 (Secret Name) | 必填 | 推荐填写值 / 示例 | 说明 |
| :--- | :---: | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | **是** | `Cloudflare_API_Token` | 在 Cloudflare 生成的具备 Workers / Pages 部署权限的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | **是** | `32位Account_ID` | Cloudflare 控制台右下角获取的 32 位全局账户 ID |
| `ADMIN_USERNAME` | **是** | `admin` | 博客首次初始化的博主超级管理员用户名 |
| `ADMIN_PASSWORD` | **是** | `你的管理员强密码` | 博客博主超级管理员登录初始密码 |
| `JWT_SECRET` | 否 | `32位以上随机字符串` | 用户会话与认证 Cookie 的加固签名密钥（留空将自动生成） |

#### 2. Variables（常规环境变量配置表）

| 变量名称 (Variable Name) | 必填 | 推荐填写值 / 示例 | 说明 |
| :--- | :---: | :--- | :--- |
| `S3_ACCESS_HOST` | 否 | `https://img.example.com` | **R2 自定义图床加速域名（选填）**。未配置时默认走 Worker 内置 `/api/blob/*` 存储路由 |

5. 进入 GitHub 仓库的 **Actions** 选项卡，手动触发一次 **Deploy** 流水线，系统将全自动完成 TypeScript 类型检查、前端静态编译、边缘数据库迁移与全网发布上线。

---

### 方案二：VPS 容器化部署（Docker Compose）

```bash
# 1. 克隆代码仓库
git clone https://github.com/your-username/Rin.git
cd Rin

# 2. 一键构建并后台启动
docker compose up -d --build
```

服务启动后将运行在 `http://YOUR_SERVER_IP:11498`，所有文章数据与媒体配置将持久化保存在本地 `./data` 挂载目录中。

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
