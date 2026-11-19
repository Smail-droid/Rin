<div align="center">

# 🌸 画廊随想 (Gallery Blog)

> **二次元微光美学 × Serverless 边缘原生全栈 × 高密单屏超级数据网格**  
> 基于 Cloudflare Workers、Pages、D1 数据库与 R2 对象存储构建的个人画廊博客与知识库系统。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Deploy: Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare_Workers-f38020.svg?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![Framework: React 18](https://img.shields.io/badge/React-18.x-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![Tests: 505 Passing](https://img.shields.io/badge/Tests-505_Passing_%7C_56_Suites-success.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![Security: CSP Zero Eval](https://img.shields.io/badge/Security-CSP_Zero_Eval_Hardened-blue.svg?style=flat-square&logo=shield)](https://developer.mozilla.org/)
[![Code Quality: A+](https://img.shields.io/badge/Code_Quality-A%2B_%7C_100_Score-brightgreen.svg?style=flat-square)]()

[GitHub 仓库](https://github.com/Smail-droid/Rin) · [更新日志 (Changelog)](CHANGELOG.md) · [前端美化章程](docs/AESTHETIC_CHARTER.md)

</div>

---

## 🌟 项目简介

**画廊随想 (Gallery Blog)** 是一座融合“一页一世界”美学哲学与现代边缘计算架构的个人画廊博客系统。全站摒弃千篇一律的单调长列表，融合拟态柔光毛玻璃、拍立得自然手账质感、时光长河发光刻度与高密单屏超级数据网格 (Dense DataGrid)。

- **纯白清亮画布与微光美学**：浅色纯白画布，搭载拍立得瀑布流、沉浸全幅画册、图文杂志与高密列表 4 大真实版式；
- **管理中枢全面前台化**：音廊曲库、图床画廊、标签数据盘、文章密码锁全面融入前台登录态，在场一键即切；
- **自然融入式顶部微工具栏**：向访客开放独立的樱花、细雨、萤火环境氛围开关（智能规避正文区），管理员顺滑衔接版式/色盘切换与撰写/图床抽屉；
- **全宽画册音廊与断点续播**：搭载纯矢量 SVG 蜜桃粉音符悬浮播放器与 HTTP 206 Partial Content Range 字节寻道，支持任意时间点丝滑 Seek；
- **边缘 AI 智能管道与随行侍从**：友链与导航引入 URL 元数据自动嗅探、Worker AI 自动提炼与标签映射，撰写工坊搭载 Mac 终端风格 ai-pipeline 与 4 位专业文字侍从。

---

## 📊 项目健康评分与首屏体积

| 指标维度 | 当前状态与数据 | 评估说明 |
| :--- | :--- | :--- |
| **综合代码健康评分** | **A+ (100 / 100)** | 全栈严格类型安全，通过工业级质量门禁体系 |
| **自动化测试覆盖** | **505 项全通 (56 套件 / 1175 断言)** | 全量测试 100% 绿灯全通，含布局回归与色彩对比度断言 |
| **TypeScript 检查** | **0 报错 (Zero Errors)** | 全局 6 个 monorepo package `turbo check` 严格校验通过 |
| **安全沙盒门禁** | **CSP Zero Eval Hardened** | 全站禁用 `unsafe-eval`，密码学安全随机源，杜绝注入漏洞 |
| **首屏核心入口 JS** | **~187 kB (Gzip ~54 kB)** | 经过 `manualChunks` 精细切分，访客首屏 0 冗余依赖 |
| **重型组件动态分包** | **100% 异步按需懒加载** | Monaco (3.88MB)、Mermaid (3.07MB)、高亮库 (649kB) 按需挂载 |

---

## 🛠️ 核心技术栈

- **运行时与构建底座**：**Bun**（极速脚本执行器、包管理与单元测试驱动） + **Vite 6** + **Turbo**（Monorepo 多包管理）
- **前端核心框架**：**React 18** + **TypeScript 5** + **TailwindCSS** + **Wouter**（轻量客户端路由）
- **原子组件体系**：`@rin/ui` 通用原语（Modal, SearchableSelect, SettingsBadge, Spinner）、`@rin/config`、`@rin/api`
- **边缘服务端架构**：**Cloudflare Workers** (`workerd`) + **Hono** 风格轻量路由器与安全中间件 + **Drizzle ORM**
- **分布式云原生存储**：**Cloudflare D1**（全球边缘分布式 SQLite 数据库） + **Cloudflare R2**（S3 兼容对象存储）
- **重型按需异步组件**：Monaco Editor（代码与 Markdown 写作）、Mermaid/Cytoscape（知识图谱）、KaTeX（数学公式渲染）
- **自动化持续集成**：**GitHub Actions**（全自动类型检查、单元测试、D1 数据库自动迁移与全球部署流水线）

---

## 🚀 部署指南：GitHub Fork + Actions 自动化流水线

适合不想维护物理服务器、享受全球 Cloudflare 边缘 CDN 毫秒级加速的博主：

1. **Fork 本仓库**到你的 GitHub 个人账号：
   ```text
   仓库主地址: https://github.com/Smail-droid/Rin
   ```
2. 在 Cloudflare 控制台创建 **D1 数据库**（名称推荐 `rin`）与 **R2 存储桶**（名称推荐 `rin`）。
3. 在 Cloudflare 个人账户生成具备 Workers、Pages、D1 与 R2 读写管理权限的 **Cloudflare API Token**。
4. 在你 Fork 后的 GitHub 仓库进入 **Settings ➔ Secrets and variables ➔ Actions**，配置如下参数：

### 1. Secrets（机密凭证配置）

| 参数名称 (Secret Name) | 必填 | 推荐填写值 / 示例 | 说明 |
| :--- | :---: | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | **是** | `Cloudflare_API_Token` | 在 Cloudflare 生成的具备 Workers / Pages 部署权限的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | **是** | `32位 Account_ID` | Cloudflare 控制台获取的 32 位全局账户 ID |
| `ADMIN_USERNAME` | **是** | `admin` | 博客首次初始化的博主超级管理员用户名 |
| `ADMIN_PASSWORD` | **是** | `你的管理员强密码` | 博客博主超级管理员登录初始密码 |
| `JWT_SECRET` | 否 | `32位以上随机字符串` | 用户会话与认证 Cookie 的加固签名密钥（留空将自动生成） |

### 2. Variables（常规环境变量配置）

| 变量名称 (Variable Name) | 必填 | 推荐填写值 / 示例 | 说明 |
| :--- | :---: | :--- | :--- |
| `S3_ACCESS_HOST` | 否 | `https://img.example.com` | **R2 自定义图床加速域名（选填）**。未配置时默认走 Worker 内置 `/api/blob/*` 存储路由 |

5. 进入 GitHub 仓库的 **Actions** 选项卡，手动触发一次 **Deploy** 工作流，系统将全自动完成 TypeScript 类型检查、前端静态编译、边缘数据库迁移与全网发布上线。

---

## 🗺️ 开发路线图 (Roadmap)

- [x] **断崖式分包瘦身**：重型库动态懒加载，首屏 JS 缩减 97.7%；
- [x] **高密单屏超级数据表格 (Dense DataGrid)**：全站管理后台单屏高密容纳所有业务指标；
- [x] **二次元微光音符与全宽音廊**：SVG 蜜桃粉音符悬浮播放器与 R2 独立元数据持久化；
- [x] **前端美化章程落地与顶部无框微工具栏**：樱花/细雨/萤火直切、18 套明快色盘与自由取色器；
- [x] **前台抽屉式写作与媒体工坊升级**：丝滑滑入交互与 Monaco 编辑器高度链加固；
- [ ] **音廊全自动化洗版工坊**：批量扫描寻找缺失元数据的音频文件，自动向全网音乐源嗅探匹配超清封面与滚动歌词；
- [ ] **相关文章智能漫游推荐**：在正文末尾结合分类标签与语义向量智能推荐相关随想；
- [ ] **画廊相片展厅虚拟网格**：海量摄影与插画作品仅渲染可视视口内部节点，保障老旧设备 60 FPS 丝滑翻滚；
- [ ] **拍立得长图海报分享**：详情页离线 Canvas/SVG 将正文骨架渲染为带精美二维码、艺术字体的海报长图；
- [ ] **友邻 RSS 异步聚合漫游流**：利用 Cloudflare Cron Triggers 异步聚合友邻博客动态；
- [ ] **AI 智能留言风控自动化研判**：将待审队列接入大语言模型实现毫秒级垃圾内容研判。

---

## 📜 版本更新迭代说明

详细历史请参见 [CHANGELOG.md](CHANGELOG.md)。

| 版本号 | 发布日期 | 核心主题与演进亮点 |
| :---: | :---: | :--- |
| **v1.0.8** | 2026-11-19 | **管理面板全面前台化 · 音廊与图床前台主路由 · 粒子智能避让 · HTTP 206 字节寻道 · 便签虚线手账 · 撰写工坊空间与侍从升级** |
| **v1.0.7** | 2026-11-18 | **前端美化章程落地 · 顶部无框氛围栏 · 抽屉式交互全面升级 · Monaco 布局加固与 505 项全绿门禁** |
| **v1.0.6** | 2026-11-14 | **星标友链 NodeSeek 原生直连与矢量 SVG 兼容 · 历史受损链接自动脱壳自愈 · 拍立得手账美学** |
| **v1.0.5** | 2026-11-07 | **日系二次元可爱悬浮音符播放器 · 音廊全宽画册网格 · R2 云端元数据持久化 · 数字直接调序** |
| **v1.0.4** | 2026-11-05 | **文章管理高密超级数据表格 (Dense DataGrid) · 封面大图快捷置换 · Pin 置顶 · 标准分页栏** |
| **v1.0.3** | 2026-11-04 | **友链罗盘画廊 SPA 重构 · URL 元数据 AI 自动嗅探 · 高可用 Favicon 代理兜底 · 游客免登录申请流** |
| **v1.0.2** | 2026-11-03 | **多语言语法高亮 · 三区隔离海报飞跃弹幕 · SEO 全景控制中心 · 提示词多版本工坊 · 留言安全审核** |
| **v1.0.1** | 2026-11-02 | **便签阵列高密超级表格 · 首页便签自由拖拽摆放 · 便签全形态自适应** |
| **v1.0.0** | 2026-11-01 | **首屏断崖式瘦身 97.7% · 12 种 Web 现代排印字族 · 极简迷你侧边栏 · 边缘全栈正式奠基** |

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
