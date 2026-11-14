/**
 * 🌸 画廊随想 · 全局视觉原子设计变量系统 (Design System Tokens)
 * 核心哲学：样式白盒化，把“形成什么视觉效果”的最终决定权彻底归还给用户。
 */

export type MaterialVariant = "polaroid" | "glassmorphism" | "brutalist" | "minimal";
export type DensityVariant = "dense" | "comfortable" | "editorial";
export type MotionVariant = "breathing_glow" | "subtle_tilt" | "static_flat";

export interface DesignTokenManifest {
    /** 材质风格 */
    material: MaterialVariant;
    /** 排版留白密度 */
    density: DensityVariant;
    /** 动效与微光模式 */
    motion: MotionVariant;
    /** 主题色调 HEX */
    primaryColor: string;
    /** 强调氛围光 */
    accentColor?: string;
    /** 全局圆角级别 (如 rounded-sm, rounded-2xl, rounded-3xl) */
    radius: "none" | "small" | "medium" | "large" | "full";
}

export interface MaterialPreset {
    id: MaterialVariant;
    name: string;
    shortDesc: string;
    icon: string;
    classes: {
        container: string;
        card: string;
        badge: string;
    };
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
    {
        id: "polaroid",
        name: "拍立得拟物手账",
        shortDesc: "自然微倾角、和纸胶带拟物、居中高清主体与环境弥散暗纹",
        icon: "ri-polaroid-2-line",
        classes: {
            container: "font-sans",
            card: "bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 shadow-md hover:shadow-xl rounded-sm",
            badge: "rounded-full bg-theme/10 text-theme font-bold",
        },
    },
    {
        id: "glassmorphism",
        name: "二次元柔和微光",
        shortDesc: "拟态毛玻璃、粉白温润渐变、呼吸微光阴影与圆角流体",
        icon: "ri-sparkling-2-line",
        classes: {
            container: "font-sans",
            card: "bg-white/70 dark:bg-neutral-900/70 border border-black/5 dark:border-white/5 backdrop-blur-md shadow-sm hover:shadow-xl rounded-3xl",
            badge: "rounded-xl bg-theme/10 text-theme font-medium",
        },
    },
    {
        id: "brutalist",
        name: "极客新野兽派终端",
        shortDesc: "纯平深色终端、高反差等宽字符、清晰锐利网格与代码感",
        icon: "ri-terminal-box-line",
        classes: {
            container: "font-mono",
            card: "bg-neutral-100 dark:bg-neutral-950 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] rounded-none",
            badge: "rounded-none border border-current font-mono font-bold uppercase",
        },
    },
    {
        id: "minimal",
        name: "极简素雅纯粹",
        shortDesc: "消灭装饰阴影与冗余边框，克制极简，阅读优先",
        icon: "ri-layout-masonry-line",
        classes: {
            container: "font-sans",
            card: "bg-transparent border-b border-black/10 dark:border-white/10 rounded-none shadow-none",
            badge: "text-neutral-500 font-normal",
        },
    },
];

export interface DensityPreset {
    id: DensityVariant;
    name: string;
    shortDesc: string;
    gapClass: string;
    paddingClass: string;
}

export const DENSITY_PRESETS: DensityPreset[] = [
    {
        id: "dense",
        name: "高密单屏数据表格",
        shortDesc: "极致信息吞吐，上下紧凑无缝隙，大屏单屏尽览",
        gapClass: "gap-2 sm:gap-3",
        paddingClass: "p-2 sm:p-3",
    },
    {
        id: "comfortable",
        name: "经典舒适自适应",
        shortDesc: "黄金呼吸留白比例，兼顾信息呈现与视觉舒适度",
        gapClass: "gap-4 sm:gap-5",
        paddingClass: "p-3.5 sm:p-4",
    },
    {
        id: "editorial",
        name: "宽幅画册杂志风",
        shortDesc: "开阔留白与大型题图，适合沉浸式漫游品味",
        gapClass: "gap-6 sm:gap-8",
        paddingClass: "p-5 sm:p-6",
    },
];
