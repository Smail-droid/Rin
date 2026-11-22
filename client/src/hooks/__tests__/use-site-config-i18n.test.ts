import { describe, it, expect } from "bun:test";
import enTranslation from "../../../public/locales/en/translation.json";
import zhTranslation from "../../../public/locales/zh-CN/translation.json";

describe("i18n Multi-language Page Titles and Components", () => {
    it("should provide English and Chinese translations for default site and atelier titles", () => {
        expect(enTranslation.site.default_name).toBe("Gallery Blog");
        expect(zhTranslation.site.default_name).toBe("画廊随想");

        expect(enTranslation.atelier.title).toBe("Gallery Blog");
        expect(zhTranslation.atelier.title).toBe("画廊随想");

        expect(enTranslation.site.default_desc).toContain("Capturing flashes of life");
        expect(zhTranslation.site.default_desc).toContain("记录生活闪光与技术沉淀");
    });

    it("should provide English and Chinese translations for page titles and descriptions", () => {
        // Timeline
        expect(enTranslation.timeline_title).toBe("River of Time");
        expect(zhTranslation.timeline_title).toBe("时光长河");
        expect(enTranslation.timeline_desc).toContain("Time flows with gentle whispers");
        expect(zhTranslation.timeline_desc).toContain("流年有声");

        // Moments
        expect(enTranslation.moments.desc).toContain("Capturing fleeting moments");
        expect(zhTranslation.moments.desc).toContain("记录浮生闲步");
        expect(enTranslation.moments.new_moment).toBe("Record Moment");
        expect(zhTranslation.moments.new_moment).toBe("记录新灵感");
        expect(enTranslation.moments.status_casual).toBe("Casual");
        expect(zhTranslation.moments.status_casual).toBe("随笔");

        // Friends
        expect(enTranslation.friends.starry_title).toBe("Starred Friends");
        expect(zhTranslation.friends.starry_title).toBe("星标友链");
        expect(enTranslation.friends.desc).toContain("Across mountains and seas");
        expect(zhTranslation.friends.desc).toContain("山海有朋");

        // Hashtags & Common
        expect(enTranslation.hashtags_index).toBe("Tags Index");
        expect(zhTranslation.hashtags_index).toBe("标签索引");
        expect(enTranslation.back_to_gallery).toBe("Back to Gallery");
        expect(zhTranslation.back_to_gallery).toBe("返回画廊");
        expect(enTranslation.art_exhibition_hall).toBe("Art Exhibition Hall");
        expect(zhTranslation.art_exhibition_hall).toBe("艺术画廊展厅");
    });

    it("should provide English translations for ambient particle effects (Sakura, Rain, Fireflies)", () => {
        expect(enTranslation.ambience.sakura).toBe("Sakura");
        expect(zhTranslation.ambience.sakura).toBe("樱花");

        expect(enTranslation.ambience.rain).toBe("Rain");
        expect(zhTranslation.ambience.rain).toBe("细雨");

        expect(enTranslation.ambience.fireflies).toBe("Fireflies");
        expect(zhTranslation.ambience.fireflies).toBe("萤火");

        expect(enTranslation.ambience.open_mode).toBe("Turn on {{mode}} ambience");
        expect(enTranslation.ambience.close_mode).toBe("Turn off {{mode}} ambience");
    });

    it("should provide English translations for layout variants and atelier ribbons", () => {
        expect(enTranslation.variant.polaroid).toBe("Polaroid");
        expect(zhTranslation.variant.polaroid).toBe("拍立得");
        expect(enTranslation.variant.poster).toBe("Poster");
        expect(zhTranslation.variant.poster).toBe("画册");
        expect(enTranslation.variant.editorial).toBe("Editorial");
        expect(zhTranslation.variant.editorial).toBe("杂志");
        expect(enTranslation.variant.compact).toBe("Compact");
        expect(zhTranslation.variant.compact).toBe("列表");

        expect(enTranslation.palette.custom_label).toBe("Palette");
        expect(zhTranslation.palette.custom_label).toBe("调色");
        expect(enTranslation.palette.switch_title).toContain("Switch theme color");
    });

    it("should provide English translations for sticky notes on homepage", () => {
        expect(enTranslation.notes.badge).toBe("Note");
        expect(zhTranslation.notes.badge).toBe("便签");

        expect(enTranslation.notes.enter).toBe("Enter");
        expect(zhTranslation.notes.enter).toBe("进入");

        expect(enTranslation.notes.about_cta).toBe("About Me");
        expect(enTranslation.notes.timeline_cta).toBe("View Timeline");
        expect(enTranslation.notes.moments_cta).toBe("Enter Moments");
        expect(enTranslation.notes.friends_cta).toBe("Visit Friends");
        expect(enTranslation.notes.search_cta).toBe("Search Now");
        expect(enTranslation.notes.reset_order).toBe("Reset Order");
    });
});
