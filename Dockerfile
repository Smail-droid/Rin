# ==============================================================================
# Rin (Fork Edition) - Production Dockerfile for VPS Deployment
# ==============================================================================
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# 安装必要的依赖构建工具
RUN apk add --no-cache libc6-compat python3 make g++

# 复制依赖描述文件并安装
COPY package.json bun.lock turbo.json ./
COPY packages/ ./packages/
COPY cli/ ./cli/
COPY server/ ./server/
COPY client/ ./client/

# 安装依赖并编译构建全栈静态资源
RUN bun install --frozen-lockfile || bun install
RUN bun run build

# 暴露服务端口
EXPOSE 11498 5173

# 设置环境变量
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# 默认启动命令 (全栈服务模式)
CMD ["bun", "cli/bin/rin.ts", "dev"]
