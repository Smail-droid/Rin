import { describe, it, expect } from "bun:test";
import { parseFriendCategory, formatFriendDesc, PRESET_CATEGORIES } from "../friends";

describe("Friends page helper functions", () => {
    it("should include all essential categories in PRESET_CATEGORIES", () => {
        expect(PRESET_CATEGORIES).toContain("全部");
        expect(PRESET_CATEGORIES).toContain("友友们");
        expect(PRESET_CATEGORIES).toContain("VPS/基础设施");
        expect(PRESET_CATEGORIES).toContain("测速/探针监控");
        expect(PRESET_CATEGORIES).toContain("极客常用工具");
        expect(PRESET_CATEGORIES).toContain("技术极客社区");
        expect(PRESET_CATEGORIES).toContain("其他灵感");
    });

    it("should parse category bracket correctly from desc", () => {
        const { category, cleanDesc } = parseFriendCategory("[VPS/基础设施] 某某云服务器提供商");
        expect(category).toBe("VPS/基础设施");
        expect(cleanDesc).toBe("某某云服务器提供商");
    });

    it("should fallback to heuristic category when no bracket prefix exists", () => {
        const { category, cleanDesc } = parseFriendCategory("好用的 GitHub 开源工具箱", "https://github.com/my-tool");
        expect(category).toBe("极客常用工具");
        expect(cleanDesc).toBe("好用的 GitHub 开源工具箱");
    });

    it("should infer VPS category from text and url", () => {
        const { category } = parseFriendCategory("性价比高的主机评测", "https://vpshost.com");
        expect(category).toBe("VPS/基础设施");
    });

    it("should infer probe / speedtest category", () => {
        const { category } = parseFriendCategory("哪吒探针服务器监控系统", "https://status.example.com");
        expect(category).toBe("测速/探针监控");
    });

    it("should format friend desc with category prefix", () => {
        const result = formatFriendDesc("极客常用工具", "在线 JSON 格式化与转换");
        expect(result).toBe("[极客常用工具] 在线 JSON 格式化与转换");
    });

    it("should omit prefix when category is '全部' or empty", () => {
        const result = formatFriendDesc("全部", "普通描述");
        expect(result).toBe("普通描述");
    });
});
