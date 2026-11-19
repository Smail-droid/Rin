import { describe, it, expect } from "bun:test";
import { parseFriendCategory, formatFriendDesc, PRESET_CATEGORIES, parseNodeSeekPastedText, fetchClientSideNsDetail } from "../friends";

describe("Friends page helper functions", () => {
    it("should include all essential categories in PRESET_CATEGORIES", () => {
        expect(PRESET_CATEGORIES).toContain("全部");
        expect(PRESET_CATEGORIES).toContain("友邻博客");
        expect(PRESET_CATEGORIES).toContain("主机算力");
        expect(PRESET_CATEGORIES).toContain("探针测速");
        expect(PRESET_CATEGORIES).toContain("极客工具");
        expect(PRESET_CATEGORIES).toContain("技术社区");
        expect(PRESET_CATEGORIES).toContain("漫游灵感");
    });

    it("should parse category bracket correctly and map legacy categories", () => {
        const { category, cleanDesc } = parseFriendCategory("[VPS/基础设施] 某某云服务器提供商");
        expect(category).toBe("主机算力");
        expect(cleanDesc).toBe("某某云服务器提供商");

        const legacy = parseFriendCategory("[友友们] 我的个人博客");
        expect(legacy.category).toBe("友邻博客");
    });

    it("should fallback to heuristic category when no bracket prefix exists", () => {
        const { category, cleanDesc } = parseFriendCategory("好用的 GitHub 开源工具箱", "https://github.com/my-tool");
        expect(category).toBe("极客工具");
        expect(cleanDesc).toBe("好用的 GitHub 开源工具箱");
    });

    it("should infer VPS category from text and url", () => {
        const { category } = parseFriendCategory("性价比高的主机评测", "https://vpshost.com");
        expect(category).toBe("主机算力");
    });

    it("should infer probe / speedtest category", () => {
        const { category } = parseFriendCategory("哪吒探针服务器监控系统", "https://status.example.com");
        expect(category).toBe("探针测速");
    });

    it("should format friend desc with category prefix", () => {
        const result = formatFriendDesc("极客工具", "在线 JSON 格式化与转换");
        expect(result).toBe("[极客工具] 在线 JSON 格式化与转换");
    });

    it("should omit prefix when category is '全部' or empty", () => {
        const result = formatFriendDesc("全部", "普通描述");
        expect(result).toBe("普通描述");
    });

    describe("parseNodeSeekPastedText", () => {
        it("should accurately parse multi-line webpage copy without false username", () => {
            const rawWebText = `加入天数
640
等级
6
鸡腿数目
11575
主题帖数
226
评论数目
8191`;

            const parsed = parseNodeSeekPastedText(rawWebText);
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.days).toBe(640);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
            // Must not falsely recognize "加入天数" as member name
            expect(parsed.name).toBeUndefined();
        });

        it("should parse pure API JSON response directly and cleanly", () => {
            const jsonText = `{"success": true, "detail": {"member_id": 27361, "member_name": "夜轻", "isAdmin": 0, "rank": 6, "coin": 11575, "stardust": 723, "bio": "个人签名测试", "created_at": "2025-02-18T06:42:29.000Z", "created_at_str": "639days ago", "nComment": 8191, "nPost": 226}}`;

            const parsed = parseNodeSeekPastedText(jsonText);
            expect(parsed.name).toBe("夜轻");
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
            expect(parsed.days).toBeGreaterThanOrEqual(630);
            expect(parsed.bio).toBe("个人签名测试");
        });

        it("should parse DevTools console output with key-value pairs", () => {
            const devtoolsText = `https://www.nodeseek.com/api/account/getInfo/27361?readme=1
detail
: 
{member_id: 27361, member_name: "夜轻", isAdmin: 0, rank: 6, coin: 11575, stardust: 723, bio: "",…}
bio
: 
""
coin
: 
11575
created_at_str
: 
"639days ago"
member_name
: 
"夜轻"
nComment
: 
8191
nPost
: 
226
rank
: 
6`;

            const parsed = parseNodeSeekPastedText(devtoolsText);
            expect(parsed.name).toBe("夜轻");
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
            expect(parsed.days).toBe(639);
        });

        it("should parse single-line colon-separated text", () => {
            const singleLine = "坛友: 夜轻 等级: 6 鸡腿: 11575 加入天数: 640 主题: 226 评论: 8191";
            const parsed = parseNodeSeekPastedText(singleLine);
            expect(parsed.name).toBe("夜轻");
            expect(parsed.rank).toBe(6);
            expect(parsed.coin).toBe(11575);
            expect(parsed.days).toBe(640);
            expect(parsed.posts).toBe(226);
            expect(parsed.comments).toBe(8191);
        });

        it("should safely handle empty or invalid inputs", async () => {
            expect(await fetchClientSideNsDetail("")).toBeNull();
        });
    });
});
