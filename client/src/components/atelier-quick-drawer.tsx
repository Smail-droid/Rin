import { useState } from "react";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useAlert } from "./dialog";

const ATELIER_TITLE_STYLES = [
  { id: "aurora_flow", name: "彩虹极光流光" },
  { id: "glass_glow", name: "琉璃晶透微光" },
  { id: "cyber_neon", name: "赛博电光霓虹" },
  { id: "ink_calligraphy", name: "水墨宣纸书卷" },
  { id: "golden_sunset", name: "落日熔金流光" },
  { id: "emboss_3d", name: "现代立体浮雕" },
  { id: "classic_clean", name: "经典纯净黑体" },
  { id: "pixel_arcade", name: "复古像素街机" },
  { id: "candy_dream", name: "二次元梦幻软糖" },
  { id: "gothic_metal", name: "暗夜哥特金属" },
  { id: "vaporwave_80s", name: "蒸汽波复古浪潮" },
  { id: "starlight_cosmic", name: "星空极夜璀璨" },
];

export function AtelierQuickDrawer({
  isOpen,
  onClose,
  siteConfig,
}: {
  isOpen: boolean;
  onClose: () => void;
  siteConfig: any;
}) {
  const { showAlert, AlertUI } = useAlert();
  const [saving, setSaving] = useState(false);

  const [notesLayout, setNotesLayout] = useState<string>(
    siteConfig.atelierNotesLayout || "grid"
  );
  const [titleStyle, setTitleStyle] = useState<string>(
    siteConfig.atelierTitleStyle || "aurora_flow"
  );
  const [columns, setColumns] = useState<string>(
    siteConfig.galleryColumns || "auto"
  );
  const [gap, setGap] = useState<number>(siteConfig.galleryCardGap ?? 24);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.config.update("client", {
        "atelier.notes_layout": notesLayout,
        "atelier.title_style": titleStyle,
        "gallery.columns": columns,
        "gallery.card_gap": String(gap),
      });
      showAlert("✨ 画廊就地配置已生效！正在无缝更新...");
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err: any) {
      showAlert(`保存失败: ${err.message || "网络异常"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden ani-show">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-md bg-w/98 shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between backdrop-blur-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm">
                <i className="ri-settings-4-line" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base t-primary">
                  画廊就地配置抽屉
                </h3>
                <p className="text-[11px] text-neutral-400">
                  免进后台 · 首页所见即所得快速调整
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200 transition"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {/* Body Settings */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
            {/* 1. 便签排布分布模式 */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-theme">
                1. 便签排布模式 (仅限首屏)
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: "grid",
                    label: "🔲 九宫格自然均衡分布",
                    desc: "左上、居中、右下黄金分割穿插于首屏，美观平衡",
                  },
                  {
                    id: "random",
                    label: "🎲 智能随机穿插",
                    desc: "在首屏文章之间随机洗牌错落分布，常看常新",
                  },
                  {
                    id: "fixed",
                    label: "📋 经典固定顺序",
                    desc: "关于我 ➔ 岁月 ➔ 随想 ➔ 友链 ➔ 搜索依次排列",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNotesLayout(item.id)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition select-none ${
                      notesLayout === item.id
                        ? "border-theme bg-theme/5 ring-1 ring-theme"
                        : "border-black/10 bg-w hover:border-black/20 dark:border-white/10 dark:bg-white/[0.02]"
                    }`}
                  >
                    <span className="text-xs font-bold t-primary">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 画廊列数 */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-theme">
                2. 画廊列数 (Columns)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: "2", label: "2 列" },
                  { id: "3", label: "3 列" },
                  { id: "4", label: "4 列" },
                  { id: "5", label: "5 列" },
                  { id: "auto", label: "自适应" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setColumns(item.id)}
                    className={`py-2 rounded-xl text-xs font-bold transition select-none ${
                      columns === item.id
                        ? "bg-theme text-white shadow-2xs"
                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 卡片间距 */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-theme">
                3. 画廊卡片间距 ({gap}px)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 12, label: "紧凑 (12px)" },
                  { val: 24, label: "舒适 (24px)" },
                  { val: 36, label: "宽松 (36px)" },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setGap(item.val)}
                    className={`py-2 rounded-xl text-xs font-bold transition select-none ${
                      gap === item.val
                        ? "bg-theme text-white shadow-2xs"
                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. 12 种艺术字效即时切换 */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-theme">
                4. 艺术主标题效果 (12种)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ATELIER_TITLE_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setTitleStyle(st.id)}
                    className={`p-2.5 rounded-xl border text-left transition select-none ${
                      titleStyle === st.id
                        ? "border-theme bg-theme/5 ring-1 ring-theme"
                        : "border-black/10 bg-w hover:border-black/20 dark:border-white/10 dark:bg-white/[0.02]"
                    }`}
                  >
                    <span className={`text-xs font-bold art-title-${st.id} block truncate`}>
                      {st.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 跳转后台详细设置链接 */}
            <div className="pt-2">
              <Link
                href="/admin/settings?tab=atelier"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-xs text-neutral-500 hover:text-theme hover:border-theme transition"
              >
                <span>进入完整后台高级设置 ➔</span>
              </Link>
            </div>
          </div>

          {/* Footer Save Actions */}
          <div className="p-4 border-t border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015] flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300 transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-theme text-white shadow-md hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
            >
              {saving ? "保存中..." : "保存并应用"}
            </button>
          </div>
        </aside>
      </div>

      <AlertUI />
    </div>
  );
}
