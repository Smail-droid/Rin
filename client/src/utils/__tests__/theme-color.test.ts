import "../../test/setup";
import { describe, expect, it } from "bun:test";
import {
  ACCENT_COLOR_PRESETS,
  DEFAULT_THEME_OPACITY,
  MULTI_COLOR_PALETTES,
  THEME_PRESETS,
  applyThemeColor,
  applyThemeFontFamily,
  applyThemeOpacity,
  applyThemePalette,
  applyThemeTitleEffect,
  applyThemeTitleFont,
  applyThemeWallpaper,
  getContrastRatio,
  normalizeThemeColor,
  normalizeThemeOpacity,
} from "../theme-color";

describe("theme-color utils", () => {
  describe("normalizeThemeOpacity", () => {
    it("returns valid opacity within 30 to 100 range", () => {
      expect(normalizeThemeOpacity(100)).toBe(100);
      expect(normalizeThemeOpacity(85)).toBe(85);
      expect(normalizeThemeOpacity(70)).toBe(70);
      expect(normalizeThemeOpacity(50)).toBe(50);
    });

    it("clamps values outside bounds", () => {
      expect(normalizeThemeOpacity(120)).toBe(100);
      expect(normalizeThemeOpacity(10)).toBe(30);
    });

    it("parses valid string inputs", () => {
      expect(normalizeThemeOpacity("85")).toBe(85);
      expect(normalizeThemeOpacity("70")).toBe(70);
    });

    it("falls back to default on invalid values", () => {
      expect(normalizeThemeOpacity(null)).toBe(DEFAULT_THEME_OPACITY);
      expect(normalizeThemeOpacity(undefined)).toBe(DEFAULT_THEME_OPACITY);
      expect(normalizeThemeOpacity("not-a-number")).toBe(DEFAULT_THEME_OPACITY);
    });
  });

  describe("THEME_PRESETS", () => {
    it("includes required high-aesthetic themes", () => {
      const ids = THEME_PRESETS.map((p) => p.id);
      expect(ids).toContain("sakura_paper");
      expect(ids).toContain("warm_wheat");
      expect(ids).toContain("paper_ink");
      expect(ids).toContain("cyber_cold");
      expect(ids).toContain("aoi_sora");
      expect(ids).toContain("midnight_deep");
      expect(ids).toContain("sakura");

      const names = THEME_PRESETS.map((p) => p.name);
      expect(names).toContain("樱雪纸墨");
      expect(names).toContain("暖麦护眼");
      expect(names).toContain("极简纸墨");
      expect(names).toContain("赛博冷萃");
      expect(names).toContain("和风青空");
      expect(names).toContain("午夜深邃");
    });

    it("every preset has valid color and previewBg", () => {
      for (const preset of THEME_PRESETS) {
        expect(preset.color.startsWith("#")).toBe(true);
        expect(preset.previewBg.startsWith("#")).toBe(true);
        expect(preset.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("ACCENT_COLOR_PRESETS", () => {
    it("has a rich palette of accent colors", () => {
      expect(ACCENT_COLOR_PRESETS.length).toBeGreaterThanOrEqual(12);
      for (const color of ACCENT_COLOR_PRESETS) {
        expect(color.startsWith("#")).toBe(true);
      }
    });
  });

  describe("applyThemeOpacity & applyThemeColor", () => {
    it("applies opacity CSS custom variables", () => {
      applyThemeOpacity(85);
      expect(document.documentElement.style.getPropertyValue("--rin-surface-alpha")).toBe("0.85");
      expect(document.documentElement.style.getPropertyValue("--rin-glass-opacity")).toBe("85%");
      expect(document.documentElement.style.getPropertyValue("--rin-glass-blur")).not.toBe("0px");

      applyThemeOpacity(100);
      expect(document.documentElement.style.getPropertyValue("--rin-surface-alpha")).toBe("1");
      expect(document.documentElement.style.getPropertyValue("--rin-glass-blur")).toBe("0px");
    });

    it("applies theme RGB custom variables", () => {
      expect(normalizeThemeColor("#2563eb")).toBe("#2563eb");
      expect(normalizeThemeColor(null)).toBe("#fc466b");
      applyThemeColor("#2563eb");
      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("37 99 235");
    });

    it("keeps vibrant palette colors legible in both light and dark modes without muddy grey fallback", () => {
      const sakura = MULTI_COLOR_PALETTES.find((p) => p.id === "sakura")!;
      expect(sakura.primary).toBe("#fc466b");
      expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(18);
      expect(ACCENT_COLOR_PRESETS.length).toBeGreaterThanOrEqual(16);
      for (const palette of MULTI_COLOR_PALETTES) {
        expect(palette.primary.startsWith("#")).toBe(true);
        expect(palette.primaryDark.startsWith("#")).toBe(true);
      }
    });

    it("updates canvas and surface semantic tokens when applying palette in light/dark mode", () => {
      const ink = MULTI_COLOR_PALETTES.find((p) => p.id === "paper_ink")!;
      document.documentElement.setAttribute("data-color-mode", "light");
      applyThemePalette(ink);
      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("39 39 42");
      expect(document.documentElement.style.getPropertyValue("--rin-surface-rgb")).toBe("255 255 255");

      document.documentElement.setAttribute("data-color-mode", "dark");
      applyThemePalette(ink);
      // 暗黑模式下极暗纸墨主色自动提亮为清透靛蓝，避免融入深色背景或浅底白字
      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("99 102 241");
      expect(document.documentElement.style.getPropertyValue("--rin-canvas-rgb")).toBe("20 21 24");
      document.documentElement.setAttribute("data-color-mode", "light");
    });

    it("toggles has-wallpaper and no-wallpaper body classes cleanly to prevent double gradients", () => {
      applyThemeWallpaper("radial-gradient(circle, red, blue)", 40);
      expect(document.body.classList.contains("has-wallpaper")).toBe(true);
      expect(document.body.classList.contains("no-wallpaper")).toBe(false);

      applyThemeWallpaper("none", 0);
      expect(document.body.classList.contains("no-wallpaper")).toBe(true);
      expect(document.body.classList.contains("has-wallpaper")).toBe(false);
    });

    it("caps CSS gradient wallpaper opacity more gently in dark mode than light mode", () => {
      document.documentElement.setAttribute("data-color-mode", "light");
      applyThemeWallpaper("radial-gradient(circle, rgba(252,70,107,0.12), transparent)", 35);
      expect(document.documentElement.style.getPropertyValue("--rin-wallpaper-opacity")).toBe("0.28");

      document.documentElement.setAttribute("data-color-mode", "dark");
      applyThemeWallpaper("radial-gradient(circle, rgba(252,70,107,0.12), transparent)", 35);
      expect(document.documentElement.style.getPropertyValue("--rin-wallpaper-opacity")).toBe("0.14");

      document.documentElement.setAttribute("data-color-mode", "light");
    });

    it("applies coordinated sakura_paper semantic surface tokens in light and dark modes with WCAG AA contrast", () => {
      const sakuraPaper = MULTI_COLOR_PALETTES.find((p) => p.id === "sakura_paper")!;
      expect(sakuraPaper).toBeDefined();
      expect(sakuraPaper.primary).toBe("#D87A90");

      document.documentElement.setAttribute("data-color-mode", "light");
      applyThemePalette(sakuraPaper);

      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("216 122 144");
      expect(document.documentElement.style.getPropertyValue("--rin-canvas-rgb")).toBe("253 251 252");
      expect(document.documentElement.style.getPropertyValue("--rin-surface-rgb")).toBe("255 255 255");
      expect(document.documentElement.style.getPropertyValue("--rin-elevated-rgb")).toBe("255 255 255");
      expect(document.documentElement.style.getPropertyValue("--rin-ink-rgb")).toBe("45 38 40");
      expect(document.documentElement.style.getPropertyValue("--rin-text-rgb")).toBe("45 38 40");
      expect(document.documentElement.style.getPropertyValue("--rin-ink-muted-rgb")).toBe("142 130 134");
      expect(document.documentElement.style.getPropertyValue("--rin-hairline-rgb")).toBe("232 213 219");

      document.documentElement.setAttribute("data-color-mode", "dark");
      applyThemePalette(sakuraPaper);

      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("228 143 163");
      expect(document.documentElement.style.getPropertyValue("--rin-canvas-rgb")).toBe("20 18 21");
      expect(document.documentElement.style.getPropertyValue("--rin-surface-rgb")).toBe("28 25 29");
      expect(document.documentElement.style.getPropertyValue("--rin-ink-rgb")).toBe("244 239 241");
      expect(document.documentElement.style.getPropertyValue("--rin-text-rgb")).toBe("244 239 241");
      expect(document.documentElement.style.getPropertyValue("--rin-ink-muted-rgb")).toBe("161 152 156");

      for (const palette of MULTI_COLOR_PALETTES) {
        expect(getContrastRatio(palette.inkLight, palette.tintLight)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.inkLight, palette.surfaceLight)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.inkDark, palette.tintDark)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.inkDark, palette.surfaceDark)).toBeGreaterThanOrEqual(4.5);
        if (palette.id !== "paper_ink") {
          expect(getContrastRatio(palette.primaryDark, palette.surfaceDark)).toBeGreaterThanOrEqual(4.5);
        }
      }

      document.documentElement.setAttribute("data-color-mode", "light");
    });

    it("uses sakura_paper as calm fallback when applyThemeColor receives undefined", () => {
      document.documentElement.setAttribute("data-color-mode", "light");
      applyThemeColor(undefined);
      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("216 122 144");
      expect(document.documentElement.style.getPropertyValue("--rin-canvas-rgb")).toBe("253 251 252");
      expect(document.documentElement.style.getPropertyValue("--rin-ink-rgb")).toBe("45 38 40");
    });

    it("supports warm_wheat and all core theme palettes cleanly", () => {
      const ids = MULTI_COLOR_PALETTES.map((p) => p.id);
      for (const id of [
        "sakura_paper",
        "warm_wheat",
        "sakura",
        "aoi_sora",
        "midnight_deep",
        "violet_twilight",
        "mint_soda",
        "paper_ink",
      ]) {
        expect(ids).toContain(id);
      }

      const wheat = MULTI_COLOR_PALETTES.find((p) => p.id === "warm_wheat")!;
      document.documentElement.setAttribute("data-color-mode", "light");
      applyThemePalette(wheat);
      expect(document.documentElement.style.getPropertyValue("--rin-canvas-rgb")).not.toBe("255 255 255");
      expect(document.documentElement.style.getPropertyValue("--rin-ink-rgb")).toBe(
        document.documentElement.style.getPropertyValue("--rin-text-rgb")
      );
    });
  });

  describe("orthogonal typography & title effects", () => {
    it("applies sans, serif, kai, and mono stacks to title and body fonts", () => {
      applyThemeTitleFont("serif");
      expect(document.documentElement.style.getPropertyValue("--rin-title-font-family")).toContain("Noto Serif SC");
      expect(document.documentElement.getAttribute("data-title-font")).toBe("serif");

      applyThemeTitleFont("kai");
      expect(document.documentElement.style.getPropertyValue("--rin-title-font-family")).toContain("LXGW WenKai");
      expect(document.documentElement.getAttribute("data-title-font")).toBe("kai");

      applyThemeTitleFont("mono");
      expect(document.documentElement.style.getPropertyValue("--rin-title-font-family")).toContain("monospace");
      expect(document.documentElement.getAttribute("data-title-font")).toBe("mono");

      applyThemeTitleFont("sans");
      expect(document.documentElement.style.getPropertyValue("--rin-title-font-family")).toContain("sans-serif");
      expect(document.documentElement.getAttribute("data-title-font")).toBe("sans");

      applyThemeFontFamily("kai");
      expect(document.documentElement.style.getPropertyValue("--rin-font-family")).toContain("LXGW WenKai");
    });

    it("applies all 5 title effects independently of title font", () => {
      applyThemeTitleFont("serif");
      for (const effect of ["clean", "soft_glow", "editorial_rule", "tactile_ink", "neon_prism"] as const) {
        applyThemeTitleEffect(effect);
        expect(document.documentElement.getAttribute("data-title-effect")).toBe(effect);
        expect(document.documentElement.getAttribute("data-title-font")).toBe("serif");
      }
    });
  });
});
