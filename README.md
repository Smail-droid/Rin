<div align="center">

# 画廊博客 (Gallery Blog)

> An edge-native personal gallery blog and knowledge base powered by Cloudflare Workers, Pages, D1 Database, and R2 Object Storage.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare_Workers-f38020.svg?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![React 18](https://img.shields.io/badge/React-18.x-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/Tests-484_Passing-brightgreen.svg?style=flat-square)]()
[![Bundle Size](https://img.shields.io/badge/Bundle_Size-131KB-purple.svg?style=flat-square)]()

[English](README.md) · [简体中文](README_zh_CN.md) · [Live Demo](https://demo.example.com) · [Manual](ATELIER_MANUAL.md) · [Changelog](CHANGELOG.md)

</div>

---

## 项目简介

全站无传统物理服务器依赖，后端深度集成 Cloudflare 全栈能力（Workers、Pages、D1、R2），全球边缘节点毫秒级冷启动。前台采用路由级代码分割技术，首屏核心 JS 依赖从 5.68MB 压缩至 131 kB（gzip 后 38 kB），实现秒开访问体验。

<div align="center">
  <img src="https://img.example.com/images/preview-banner.png" alt="Gallery Preview Banner" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);" />
</div>

---

## 快速部署

### 方案一：GitHub Fork + Actions 自动化流水线（推荐）

1. **Fork 本仓库**到你的 GitHub 个人账号。
2. 在 Cloudflare 控制台创建 **D1 数据库** `rin` 与 **R2 存储桶** `rin`。
3. 创建具备 Workers、Pages、D1 与 R2 编辑权限的 Cloudflare API Token。
4. 在 Fork 后的 GitHub 仓库（**Settings ➔ Secrets and variables ➔ Actions**）配置如下参数表格：

#### 1. Secrets（机密凭证配置表）

| 参数名称 (Secret Name) | 必填 | 推荐填写值 / 示例 | 说明 |
| :--- | :---: | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | 是 | `Cloudflare_API_Token` | 在 Cloudflare 生成的具备 Workers 权限的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | `32位Account_ID` | Cloudflare 控制台获取的 32 位全局账户 ID |
| `ADMIN_USERNAME` | 是 | `admin` | 博客首次初始化的博主超级管理员用户名 |
| `ADMIN_PASSWORD` | 是 | `你的管理员强密码` | 博客博主超级管理员登录初始密码 |
| `JWT_SECRET` | 否 | `32位以上随机字符串` | 用户会话与认证 Cookie 的加固签名密钥 |

#### 2. Variables（常规环境变量配置表）

| 变量名称 (Variable Name) | 必填 | 推荐填写值 / 示例 | 说明 |
| :--- | :---: | :--- | :--- |
| `S3_ACCESS_HOST` | 是 | `https://img.example.com` | **R2 自定义图床域名**（必须带协议头，末尾不加斜杠） |

5. 进入 GitHub 仓库的 **Actions** 选项卡，手动触发一次 **Build** 工作流，系统将自动执行类型检查、前端编译、数据库迁移并发布上线。

---

### 方案二：VPS 容器化部署（Docker Compose）

```bash
# 1. 克隆代码仓库
git clone https://github.com/your-username/Rin.git
cd Rin

# 2. 一键构建并后台启动
docker compose up -d --build
```

服务将运行在 `http://YOUR_SERVER_IP:11498`，数据持久化保存在本地 `./data` 目录下。

---

## 技术架构

| 层次 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端应用** | React 18 / TypeScript / Vite 6 | 单页面（SPA）架构，前台极致按需懒加载代码分割 |
| **样式与图标** | TailwindCSS / RemixIcon | 响应式布局、动态主题变量、系统浅色/深色模式 |
| **富文本排版** | React-Markdown / Prism / Mermaid | GFM 语法支持、代码语法高亮、运行时 DOM 图表嗅探 |
| **边缘服务端** | Cloudflare Workers (workerd) | 全球边缘无服务器运行环境，毫秒级冷启动 |
| **持久数据库** | Cloudflare D1 (SQLite) | 分布式边缘轻量关系型数据库，读写事务安全 |
| **对象存储** | Cloudflare R2 | S3 兼容对象存储，直链强缓存托管，出站流量永久 $0 |
| **自动化测试** | Bun Native Test Runner (`bun:test`) | 54 个测试套件，484 项测试全部通过 |

---

## 开源协议与致谢

- 本项目基于 [MIT License](LICENSE) 协议开源。
- 感谢官方上游项目 [openRin/Rin](https://github.com/openRin/Rin) 带来的优秀架构启发。
