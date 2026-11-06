import { useContext, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { ClientConfigContext } from "../state/config";
import { client } from "../app/runtime";

interface SEOCheckItem {
  id: string;
  name: string;
  protocol: string;
  status: "active" | "manual" | "recommended";
  statusText: string;
  description: string;
  guide: string;
  actionUrl?: string;
  actionText?: string;
}

export function AdminSEOPage() {
  const siteConfig = useSiteConfig();
  const clientConfig = useContext(ClientConfigContext);
  const { showAlert, AlertUI } = useAlert();

  // 1. 首页底部 Powered by 署名与跳转链接状态
  const [byText, setByText] = useState(() => clientConfig.get<string>("footer.by_text") || "80hou");
  const [byUrl, setByUrl] = useState(() => clientConfig.get<string>("footer.by_url") || "https://www.nodeseek.com/space/39375#/general");
  const [savingFooter, setSavingFooter] = useState(false);

  // 2. 网站图标 (Favicon) 状态
  const [faviconKey, setFaviconKey] = useState(Date.now());
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFavicon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("rin_auth_token") || "";
      const resp = await fetch("/favicon", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      if (resp.ok) {
        setFaviconKey(Date.now());
        showAlert("🎉 网站图标 (Favicon) 已成功上传并更新！边缘端已自动切分生成多规格标头。");
      } else {
        const errText = await resp.text();
        showAlert(`上传失败: ${errText}`);
      }
    } catch (err: any) {
      showAlert(`上传异常: ${err.message}`);
    } finally {
      setUploadingFavicon(false);
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    }
  };

  const handleSaveFooter = async () => {
    setSavingFooter(true);
    try {
      const { error } = await client.config.update("client", {
        "footer.by_text": byText.trim(),
        "footer.by_url": byUrl.trim(),
      });
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string) || "保存失败");
      } else {
        showAlert("🎉 首页底部 By 署名与链接已成功更新！前台底部已实时生效。");
      }
    } catch (e: any) {
      showAlert(e.message || "更新失败");
    } finally {
      setSavingFooter(false);
    }
  };

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://你的域名";
  const sitemapUrl = `${siteUrl}/sitemap.xml`;
  const robotsUrl = `${siteUrl}/robots.txt`;
  const rssUrl = `${siteUrl}/rss.xml`;

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    showAlert(`🎉 已成功复制 ${label} 到剪贴板：\n${text}`);
  };

  const seoChecklist: SEOCheckItem[] = [
    {
      id: "sitemap",
      name: "Sitemap.xml 站点地图自动索引",
      protocol: "XML Sitemaps 0.9",
      status: "active",
      statusText: "自动实时生效",
      description: "自动聚合全站已发布公开文章、相册、分类标签、说说动态与独立单页，带 lastmod 时间戳",
      guide: "无需手动干预，发布或修改文章时系统在边缘端毫秒级自动同步更新并提供标准 XML",
      actionUrl: sitemapUrl,
      actionText: "在线预览地图",
    },
    {
      id: "robots",
      name: "Robots.txt 爬虫抓取安全协议",
      protocol: "RFC 9309 Robots",
      status: "active",
      statusText: "自动实时生效",
      description: "宣告允许抓取内容页面并自动指引 /sitemap.xml 位置，严格拦截 /admin/ 等私有管理路由",
      guide: "将蜘蛛爬行配额 100% 聚焦在前台公开优质画廊与文章内容，杜绝浪费爬虫预算",
      actionUrl: robotsUrl,
      actionText: "查看爬虫协议",
    },
    {
      id: "indexnow",
      name: "IndexNow 极速主动推送协议",
      protocol: "Bing & Yandex IndexNow",
      status: "manual",
      statusText: "需在CF开启",
      description: "现代搜索引擎秒级收录协议！文章发表后主动广播推送，Bing 蜘蛛几分钟至数小时内即刻上门爬取",
      guide: "在 Cloudflare 控制台 ➔ 域名 ➔ 速度 (Speed) ➔ 将【Crawler Hints (漫游器提示) / IndexNow】开关开启",
      actionUrl: "https://dash.cloudflare.com",
      actionText: "前往 CF 开启",
    },
    {
      id: "jsonld",
      name: "Schema.org 结构化富媒体微数据",
      protocol: "JSON-LD / OpenGraph",
      status: "active",
      statusText: "自动实时生效",
      description: "全站 HTML 自动注入 OpenGraph 大图卡片与 Twitter Card，Google 呈现富媒体搜索摘要",
      guide: "自动抓取文章首张大图作为封面海报，配合前 200 字摘要生成社交与搜索富卡片",
    },
    {
      id: "rss",
      name: "全格式通用订阅源广播",
      protocol: "RSS 2.0 / Atom / JSON",
      status: "active",
      statusText: "自动实时生效",
      description: "提供 /rss.xml、/atom.xml、/rss.json 三重标准订阅协议，供全球爬虫与聚合器订阅",
      guide: "自动向独立博客圈、RSS 搜索引擎与读者客户端广播最新文章更新",
      actionUrl: rssUrl,
      actionText: "查看 RSS 源",
    },
    {
      id: "backlinks",
      name: "高权重反向外链与蜘蛛引流",
      protocol: "High-Authority Backlinks",
      status: "recommended",
      statusText: "站长日常运营",
      description: "新博客权重积累的核心利器！在外部高权重网站留存博客直链，吸引各大蜘蛛顺藤摸瓜入站爬取",
      guide: "推荐留存场景：GitHub 个人主页 Profile README、V2EX / NodeSeek / Linux.do 论坛签名与博客友链圈",
      actionText: "复制博客直链",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`SEO 引擎 · 全网收录与权重治理 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      {/* 顶部运行状态切片中枢 */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-theme/10 text-theme text-2xl shadow-2xs">
            <i className="ri-search-eye-line" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold t-primary">SEO 引擎与全网收录中枢</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                收录通道就绪
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              内置全自动化 Sitemap、Robots 宣告、OpenGraph 社交卡片与 IndexNow 边缘主动推送广播
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => copyToClipboard(sitemapUrl, "Sitemap 地址")}
            className="px-3 py-1.5 rounded-xl border border-black/10 bg-w hover:border-theme text-xs font-semibold t-primary transition flex items-center gap-1.5 shadow-2xs dark:border-white/10"
          >
            <i className="ri-file-copy-line text-theme" />
            <span>复制 Sitemap 链接</span>
          </button>
          <a
            href={sitemapUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover transition flex items-center gap-1"
          >
            <i className="ri-external-link-line" />
            <span>在线验证 Sitemap</span>
          </a>
        </div>
      </div>

      {/* 隐藏的 Favicon 上传输入框 */}
      <input
        ref={faviconInputRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/x-icon,image/webp"
        onChange={handleUploadFavicon}
        className="hidden"
      />

      {/* 专属定制卡片：首页底部 By 署名配置 + 网站 Favicon 图标上传 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 卡片 1: 首页底部 Powered by 署名与跳转链接定制 */}
        <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <i className="ri-copyright-line text-theme text-base" />
              <h3 className="font-bold text-xs sm:text-sm t-primary">首页底部 Powered by 署名与跳转链接</h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-theme/10 text-theme">
              实时生效
            </span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            自定义博客首页最底端版权行 <code className="font-mono text-theme font-bold">© Powered by [名称]</code> 的展示文本与点击外链。
          </p>

          <div className="space-y-2.5 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-500">底部 By 后面显示的文字</label>
              <input
                type="text"
                value={byText}
                onChange={(e) => setByText(e.target.value)}
                placeholder="例如: 80hou"
                className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs font-bold t-primary outline-none focus:border-theme"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-500">点击署名跳转的 URL 链接</label>
              <input
                type="url"
                value={byUrl}
                onChange={(e) => setByUrl(e.target.value)}
                placeholder="例如: https://www.nodeseek.com/space/39375#/general"
                className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs font-mono t-primary outline-none focus:border-theme"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-neutral-400">
              预览: © {new Date().getFullYear()} Powered by <a href={byUrl} target="_blank" rel="noreferrer" className="text-theme font-bold hover:underline">{byText}</a>
            </span>
            <button
              type="button"
              onClick={handleSaveFooter}
              disabled={savingFooter}
              className="px-4 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1"
            >
              {savingFooter && <i className="ri-loader-4-line animate-spin" />}
              <span>{savingFooter ? "保存中..." : "保存底部配置"}</span>
            </button>
          </div>
        </div>

        {/* 卡片 2: Blog 网站图标 (Favicon) 独立上传设置与尺寸建议 */}
        <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <i className="ri-image-circle-line text-theme text-base" />
                <h3 className="font-bold text-xs sm:text-sm t-primary">Blog 网站图标 (Favicon) 设置</h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                PWA / 标签页标头
              </span>
            </div>

            <div className="flex items-start gap-4 mt-3">
              {/* 当前 Favicon 实时预览 */}
              <div className="relative h-16 w-16 shrink-0 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-center overflow-hidden shadow-inner group">
                <img
                  key={faviconKey}
                  src={`/favicon?t=${faviconKey}`}
                  alt="当前网站图标"
                  className="h-10 w-10 object-contain drop-shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div
                  onClick={() => faviconInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs cursor-pointer"
                  title="点击上传更换图标"
                >
                  <i className="ri-upload-cloud-line text-sm" />
                </div>
              </div>

              {/* 官方规范与尺寸描述建议 */}
              <div className="space-y-1 text-xs">
                <h5 className="font-bold t-primary">官方图标规范建议与处理机制：</h5>
                <ul className="text-neutral-500 dark:text-neutral-400 text-[11px] space-y-0.5 list-disc pl-3.5 leading-relaxed">
                  <li><strong>推荐尺寸</strong>：<span className="text-theme font-bold">512 × 512</span> 像素正方形（高清适配 Retina 视网膜屏与手机 PWA）。</li>
                  <li><strong>推荐格式</strong>：透明底 PNG 或矢量 SVG（体积小于 2MB）。</li>
                  <li><strong>自动切分</strong>：边缘 Worker 会自动生成 16×16、32×32、48×48 等自适应规格，浏览器标签页秒级识别。</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => faviconInputRef.current?.click()}
              disabled={uploadingFavicon}
              className="px-4 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {uploadingFavicon ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-upload-cloud-line" />}
              <span>{uploadingFavicon ? "正在处理并上传..." : "上传网站图标 (Favicon)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 切片 1: 三大主流搜索引擎站长平台直达通道 (Sitemap 一键提交) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-compass-3-line text-theme" />
            <h3 className="font-bold text-xs t-primary">三大主流搜索引擎站长平台提交指南 (一键提交，加速收录)</h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">只需首次提交一次 Sitemap 即可全量建索</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Google Search Console */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-sm t-primary flex items-center gap-1.5">
                  <i className="ri-google-fill text-blue-500 text-base" />
                  <span>Google 站长平台</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  全球权威
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                1. 登录 search.google.com<br />
                2. 点击左侧【Sitemaps (站点地图)】<br />
                3. 输入 <code className="text-theme font-mono font-bold">sitemap.xml</code> 点击提交<br />
                4. 谷歌爬虫将在 1~3 天内全量抓取建索引
              </p>
            </div>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noreferrer"
              className="w-full py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-center transition flex items-center justify-center gap-1"
            >
              <span>前往 Google Search Console</span>
              <i className="ri-arrow-right-line text-xs" />
            </a>
          </div>

          {/* Bing Webmaster Tools */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-sm t-primary flex items-center gap-1.5">
                  <i className="ri-microsoft-fill text-emerald-500 text-base" />
                  <span>Bing 必应站长平台</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  AI搜索直通
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                1. 登录 bing.com/webmasters<br />
                2. 支持一键直接导入 Google 站长数据<br />
                3. 提交 <code className="text-theme font-mono font-bold">sitemap.xml</code><br />
                4. 同步覆盖 Bing、雅虎及 Copilot AI 检索
              </p>
            </div>
            <a
              href="https://www.bing.com/webmasters"
              target="_blank"
              rel="noreferrer"
              className="w-full py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-center transition flex items-center justify-center gap-1"
            >
              <span>前往 Bing 必应站长后台</span>
              <i className="ri-arrow-right-line text-xs" />
            </a>
          </div>

          {/* 百度搜索资源平台 */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-sm t-primary flex items-center gap-1.5">
                  <i className="ri-baidu-fill text-rose-500 text-base" />
                  <span>百度搜索资源平台</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  国内主流
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                1. 登录 ziyuan.baidu.com 验证站点所有权<br />
                2. 进入【搜索服务】➔【普通收录】<br />
                3. 选择【Sitemap 提交】，填入全路径：<br />
                <code className="text-theme font-mono font-bold truncate block">{sitemapUrl}</code>
              </p>
            </div>
            <a
              href="https://ziyuan.baidu.com/"
              target="_blank"
              rel="noreferrer"
              className="w-full py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-center transition flex items-center justify-center gap-1"
            >
              <span>前往百度搜索资源平台</span>
              <i className="ri-arrow-right-line text-xs" />
            </a>
          </div>
        </div>
      </div>

      {/* 切片 2: 画廊博客自动 SEO 基础设施检测超级表格 (Dense DataGrid) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-table-line text-theme" />
            <h3 className="font-bold text-xs t-primary">SEO 自动化设施运行检测清单 (Dense DataGrid)</h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">一屏尽览 · 永久备忘</span>
        </div>

        <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-32 text-center">状态</th>
                <th className="py-2.5 px-3 w-48">SEO 项目与标准规范</th>
                <th className="py-2.5 px-3">功能描述与收录价值</th>
                <th className="py-2.5 px-3 w-64">操作与开启指南</th>
                <th className="py-2.5 px-3 w-28 text-right pr-4">快捷通道</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {seoChecklist.map((item) => (
                <tr key={item.id} className="hover:bg-theme/[0.02] transition-colors">
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                        item.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : item.status === "manual"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      }`}
                    >
                      {item.statusText}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold t-primary">{item.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{item.protocol}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                    {item.description}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 text-[11px]">
                    {item.guide}
                  </td>
                  <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                    {item.actionUrl ? (
                      <a
                        href={item.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme font-semibold text-[11px] transition"
                      >
                        <span>{item.actionText || "查看"}</span>
                        <i className="ri-arrow-right-line text-xs" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(siteUrl, "博客首页直链")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 font-semibold text-[11px] t-primary transition"
                      >
                        <i className="ri-file-copy-line text-xs" />
                        <span>复制直链</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
