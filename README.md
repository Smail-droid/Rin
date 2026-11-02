<div align="center">

# Rin - Gallery Blog & Knowledge Base

> An edge-native personal gallery blog and knowledge base powered by Cloudflare Workers, Pages, D1 Database, and R2 Object Storage.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare_Workers-f38020.svg?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![React 18](https://img.shields.io/badge/React-18.x-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df.svg?style=flat-square&logo=bun)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/Tests-484_Passing-brightgreen.svg?style=flat-square)]()
[![Bundle Size](https://img.shields.io/badge/Bundle_Size-131KB-purple.svg?style=flat-square)]()

[English](README.md) · [简体中文](README_zh_CN.md) · [Live Demo](https://blog.170705.xyz) · [Manual](ATELIER_MANUAL.md) · [Changelog](CHANGELOG.md)

</div>

---

## Overview

Rin is an edge-native Single Page Application (SPA) blog designed for writers and developers who value clean visual presentation and lightning-fast loading speeds.

Built on the Cloudflare Serverless ecosystem, the site delivers sub-100ms cold starts worldwide with zero server maintenance costs. Through aggressive frontend route code splitting, the initial entry bundle size is compressed to **131 kB** (38 kB gzip), ensuring near-instantaneous first-page visits.

<div align="center">
  <img src="https://blog.170705.xyz/api/blob/images/3015b1ab75c482ef5309ce917f0cffffff348556.png" alt="Rin Gallery Banner" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);" />
</div>

---

## Quick Deployment

### Method 1: GitHub Fork + Actions (Recommended)

1. **Fork this repository** to your GitHub account.
2. In your Cloudflare Dashboard, create a **D1 Database** named `rin` and an **R2 Bucket** named `rin`.
3. Generate a Cloudflare API Token with Workers, Pages, D1, and R2 editing permissions.
4. In your forked GitHub repository (**Settings ➔ Secrets and variables ➔ Actions**), configure:
   - **Secrets**:
     - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token
     - `CLOUDFLARE_ACCOUNT_ID`: Your 32-character Account ID
     - `ADMIN_USERNAME`: Initial administrator username
     - `ADMIN_PASSWORD`: Initial administrator password
   - **Variables**:
     - `S3_ACCESS_HOST`: Your R2 Custom Domain (e.g. `https://img.170705.xyz`)
5. Navigate to the **Actions** tab and trigger the **Build** workflow. The system will automatically run type checks, compile the frontend, migrate the database, and deploy to Cloudflare.

---

### Method 2: VPS Container Deployment (Docker Compose)

```bash
# 1. Clone repository
git clone https://github.com/Smail-droid/Rin.git
cd Rin

# 2. Build and start service in background
docker compose up -d --build
```

The service will run locally at `http://YOUR_SERVER_IP:11498`. Data is persisted under `./data`.

---

## Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 / TypeScript / Vite 6 | Single Page Application (SPA) architecture with on-demand code splitting |
| **Styling & Icons** | TailwindCSS / RemixIcon | Responsive styling, dynamic themes, and system dark/light modes |
| **Markdown Pipeline** | React-Markdown / Prism / Mermaid | GFM support, syntax highlighting, and on-demand DOM chart detection |
| **Edge Backend** | Cloudflare Workers (workerd) | Edge compute runtime with sub-100ms global startup |
| **Database** | Cloudflare D1 (SQLite) | Distributed relational database at the edge |
| **Object Storage** | Cloudflare R2 | S3-compatible image hosting with edge caching and zero egress fees |
| **Test Suite** | Bun Native Test Runner (`bun:test`) | 54 test suites with 484 unit and integration tests passing |

---

## License & Acknowledgements

- This project is open-sourced under the [MIT License](LICENSE).
- Special thanks to the original upstream project [openRin/Rin](https://github.com/openRin/Rin) for architectural inspiration.
