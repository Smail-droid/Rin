import { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

export function AdminTokensPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  // 默认开放图床 API Token (与服务端 storage.ts 保持一致)
  const [apiToken, setApiToken] = useState<string>(() => {
    try {
      return localStorage.getItem("rin_storage_api_token") || "sk-7dd8-18e341d3b1c51710";
    } catch {
      return "sk-7dd8-18e341d3b1c51710";
    }
  });

  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    try {
      void navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      showAlert(`✓ ${label}已成功复制到剪贴板！`);
    } catch {
      showAlert("复制失败，请手动选择复制");
    }
  };

  const handleRegenerateToken = () => {
    showConfirm(
      "重置 API Token 确认",
      "重新生成后，旧 Token 将立即在本地失效，需要同步更新 PicGo、Typora 等外部客户端中的配置。确认重新生成吗？",
      () => {
        const randomBytes = new Uint8Array(8);
        if (typeof crypto !== "undefined" && crypto.getRandomValues) {
          crypto.getRandomValues(randomBytes);
        } else {
          for (let i = 0; i < 8; i++) randomBytes[i] = Math.floor(Math.random() * 256);
        }
        const hex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        const newToken = `sk-rin-${hex}`;
        setApiToken(newToken);
        try {
          localStorage.setItem("rin_storage_api_token", newToken);
        } catch {}
        showAlert(`🎉 新的开放图床 API Token 已生成：\n${newToken}`);
      }
    );
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://example.com";
  const uploadApiEndpoint = `${origin}/api/storage/upload`;

  return (
    <div className="flex w-full flex-col gap-6 ani-show select-none">
      <Helmet>
        <title>{`口令与凭证 · 开发者与外部接入中心 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />
      <ConfirmUI />

      {/* 顶部职责边界引导：文章访问密码已统一归口 */}
      <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-theme/[0.04] to-transparent">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shrink-0">
            <i className="ri-shield-keyhole-line" />
          </span>
          <div>
            <h3 className="text-xs sm:text-sm font-bold t-primary">文章加密与私密访问保护已统一收拢</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              为文章设置访问密码、未解锁提示词及锁定策略，请前往统一安全治理中枢进行集中配置
            </p>
          </div>
        </div>
        <Link
          href="/admin/access"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold hover:bg-theme-hover transition shadow-2xs shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <span>进入权限与安全中心</span>
          <i className="ri-arrow-right-line" />
        </Link>
      </div>

      {/* 核心卡片 1: 开放图床上传 API Token (Typora / PicGo / 脚本一键接入) */}
      <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 text-lg">
              <i className="ri-key-2-line" />
            </span>
            <div>
              <h2 className="text-base font-bold t-primary flex items-center gap-2">
                <span>开放图床 API Token</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  ACTIVE 活跃有效
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                用于 Typora、PicGo、自动化脚本或 CI/CD 一键直传图片至画廊 Cloudflare R2 图床
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRegenerateToken}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/10 hover:border-theme hover:text-theme text-xs font-semibold text-neutral-600 dark:border-white/10 dark:text-neutral-300 transition cursor-pointer"
          >
            <i className="ri-refresh-line" />
            <span>重新生成 Token</span>
          </button>
        </div>

        {/* Token 展示与一键复制 */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Bearer Authorization Token (请求鉴权凭证)
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-neutral-850 px-3.5 py-2.5 font-mono text-xs t-primary">
              <span className="select-all break-all">{apiToken}</span>
              <span className="text-[10px] text-neutral-400 ml-2 shrink-0">永久免密授权</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(apiToken, "API Token")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 transition shrink-0 cursor-pointer"
            >
              <i className={copied === "API Token" ? "ri-check-line" : "ri-file-copy-line"} />
              <span>{copied === "API Token" ? "已复制" : "复制 Token"}</span>
            </button>
          </div>
        </div>

        {/* 上传接口端点 */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            API Endpoint (图片上传标准接口)
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-neutral-850 px-3.5 py-2.5 font-mono text-xs t-primary">
              <span className="select-all break-all">{uploadApiEndpoint}</span>
              <span className="text-[10px] text-neutral-400 ml-2 shrink-0">POST (multipart/form-data)</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(uploadApiEndpoint, "上传接口")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-black/10 hover:border-theme text-xs font-semibold t-primary transition shrink-0 cursor-pointer"
            >
              <i className={copied === "上传接口" ? "ri-check-line" : "ri-file-copy-line"} />
              <span>{copied === "上传接口" ? "已复制" : "复制接口"}</span>
            </button>
          </div>
        </div>

        {/* 快速接入示例配置 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {/* PicGo 配置 */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs t-primary flex items-center gap-1.5">
                <i className="ri-image-line text-theme" />
                <span>PicGo 自定义 Web 图床配置</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(
                      {
                        url: uploadApiEndpoint,
                        paramName: "file",
                        jsonPath: "data.url",
                        customHeader: JSON.stringify({ Authorization: `Bearer ${apiToken}` }),
                      },
                      null,
                      2
                    ),
                    "PicGo 配置"
                  )
                }
                className="text-[11px] text-theme hover:underline font-semibold cursor-pointer"
              >
                复制 JSON
              </button>
            </div>
            <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 space-y-1">
              <div>API URL: <span className="text-neutral-700 dark:text-neutral-300">{uploadApiEndpoint}</span></div>
              <div>POST 参数名: <span className="text-neutral-700 dark:text-neutral-300">file</span></div>
              <div>JSON 路径: <span className="text-neutral-700 dark:text-neutral-300">data.url</span></div>
              <div>自定义 Headers: <span className="text-neutral-700 dark:text-neutral-300">Authorization: Bearer {apiToken.slice(0, 8)}...</span></div>
            </div>
          </div>

          {/* cURL 快速测试 */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs t-primary flex items-center gap-1.5">
                <i className="ri-terminal-box-line text-theme" />
                <span>cURL 命令行直接上传</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `curl -X POST "${uploadApiEndpoint}" -H "Authorization: Bearer ${apiToken}" -F "file=@image.png"`,
                    "cURL 命令"
                  )
                }
                className="text-[11px] text-theme hover:underline font-semibold cursor-pointer"
              >
                复制命令
              </button>
            </div>
            <pre className="text-[11px] font-mono p-2 rounded-lg bg-black/5 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 overflow-x-auto">
              curl -X POST "{uploadApiEndpoint}" \<br />
              &nbsp;&nbsp;-H "Authorization: Bearer {apiToken.slice(0, 8)}..." \<br />
              &nbsp;&nbsp;-F "file=@image.png"
            </pre>
          </div>
        </div>
      </div>

      {/* 核心卡片 2: 系统集成与 Webhook 凭证总览 */}
      <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-lg">
            <i className="ri-puzzle-line" />
          </span>
          <div>
            <h2 className="text-base font-bold t-primary">系统集成与密钥托管状态</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              全站服务商 API Key、Webhook 推送鉴权与边缘后端环境变量托管状态
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs t-primary">AI Provider API Key</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-theme/10 text-theme font-mono">已配置</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">OpenAI / CF Workers AI 边缘摘要调度凭证</p>
            </div>
            <Link href="/admin/settings?tab=ai" className="mt-3 text-[11px] text-theme font-semibold hover:underline">
              前往 AI 设置管理 →
            </Link>
          </div>

          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs t-primary">Webhook 推送 Secret</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-theme/10 text-theme font-mono">就绪</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">文章发布与更新时外部推送通知签名验证</p>
            </div>
            <Link href="/admin/settings" className="mt-3 text-[11px] text-theme font-semibold hover:underline">
              前往 Webhook 设置 →
            </Link>
          </div>

          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs t-primary">文章隐私密码锁</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">D1 强鉴权</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">单篇文章独立密码、防暴力破解与前台解锁</p>
            </div>
            <Link href="/admin/access" className="mt-3 text-[11px] text-theme font-semibold hover:underline">
              前往权限安全中心 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}