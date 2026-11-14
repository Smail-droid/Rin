export type CartridgeCategory = "storage" | "media" | "social" | "devops" | "inspiration";

export interface CartridgeManifest {
    /** 唯一模块卡带标识 (如 storage, music, friends, probe) */
    id: string;
    /** 微世界全称 */
    name: string;
    /** 短标题/标签 */
    shortName: string;
    /** 标识图标 (RemixIcon 类名) */
    icon: string;
    /** 前台展示路由 */
    path: string;
    /** 后台管理路由 (若有) */
    adminPath?: string;
    /** 分类分类 */
    category: CartridgeCategory;
    /** 对应诞生初衷纪事 slug */
    lensSlug: string;
    /** 架构定位与简介 */
    description: string;
    /** 语义版本号 */
    version: string;
    /** Cloudflare 边缘原生绑定与连线声明 */
    connection: {
        type: "r2" | "d1" | "worker" | "external";
        binding?: string;
        endpoint?: string;
        docUrl?: string;
    };
    /** 可插拔能力特征 */
    capabilities: {
        hasFrontendView: boolean;
        hasAdminConsole: boolean;
        hasDedicatedApi: boolean;
        hasChronicleLens: boolean;
    };
    /** 控制启用/停用的配置项键名 */
    configKey: string;
    /** 默认是否启用 */
    defaultEnabled: boolean;
}

/**
 * 官方预置微世界卡带清单 (Built-in Micro-World Cartridges)
 */
export const BUILTIN_CARTRIDGES: CartridgeManifest[] = [
    {
        id: "storage",
        name: "R2 图床 · 媒体资产",
        shortName: "图床",
        icon: "ri-image-line",
        path: "/admin/files",
        adminPath: "/admin/files",
        category: "storage",
        lensSlug: "storage",
        description: "基于 Cloudflare R2 对象存储的高可用媒体图床与沉浸式全屏画廊。",
        version: "1.0.6",
        connection: {
            type: "r2",
            binding: "R2_BUCKET",
            docUrl: "https://developers.cloudflare.com/r2/",
        },
        capabilities: {
            hasFrontendView: true,
            hasAdminConsole: true,
            hasDedicatedApi: true,
            hasChronicleLens: true,
        },
        configKey: "cartridge.storage.enabled",
        defaultEnabled: true,
    },
    {
        id: "music",
        name: "边缘音廊 · 听觉漫游",
        shortName: "音廊",
        icon: "ri-disc-line",
        path: "/admin/music",
        adminPath: "/admin/music",
        category: "media",
        lensSlug: "music",
        description: "基于 R2 存储与 10KB 独立索引架构的音频中枢与日系手绘音符悬浮播放器。",
        version: "1.0.6",
        connection: {
            type: "r2",
            binding: "R2_BUCKET",
            endpoint: "/api/blob/music/metadata.json",
        },
        capabilities: {
            hasFrontendView: true,
            hasAdminConsole: true,
            hasDedicatedApi: true,
            hasChronicleLens: true,
        },
        configKey: "cartridge.music.enabled",
        defaultEnabled: true,
    },
    {
        id: "friends",
        name: "星标画廊 · 友链罗盘",
        shortName: "星廊",
        icon: "ri-compass-3-line",
        path: "/friends",
        adminPath: "/friends",
        category: "social",
        lensSlug: "friends",
        description: "自插拔星标站点与坛友认证画廊，支持拍立得手账纸便签与高密超级表格双重呈现。",
        version: "1.0.6",
        connection: {
            type: "d1",
            binding: "DB",
        },
        capabilities: {
            hasFrontendView: true,
            hasAdminConsole: true,
            hasDedicatedApi: true,
            hasChronicleLens: true,
        },
        configKey: "cartridge.friends.enabled",
        defaultEnabled: true,
    },
    {
        id: "openlist",
        name: "OpenList · 边缘目录挂载",
        shortName: "网盘挂载",
        icon: "ri-hard-drive-2-line",
        path: "/admin/openlist",
        adminPath: "/admin/openlist",
        category: "devops",
        lensSlug: "openlist",
        description: "基于 doc.oplist.org.cn 规范的 Cloudflare Worker 多网盘多源边缘目录索引挂载。",
        version: "1.0.6",
        connection: {
            type: "worker",
            docUrl: "https://doc.oplist.org.cn",
        },
        capabilities: {
            hasFrontendView: false,
            hasAdminConsole: true,
            hasDedicatedApi: false,
            hasChronicleLens: false,
        },
        configKey: "cartridge.openlist.enabled",
        defaultEnabled: true,
    },
];

/**
 * 获取微世界卡带辅助函数
 */
export function getCartridgeById(id: string): CartridgeManifest | undefined {
    return BUILTIN_CARTRIDGES.find((c) => c.id === id);
}
