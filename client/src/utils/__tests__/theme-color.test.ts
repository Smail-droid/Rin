import "../../test/setup";
import { describe, expect, it } from "bun:test";
import {
  ACCENT_COLOR_PRESETS,
  DEFAULT_THEME_OPACITY,
  MULTI_COLOR_PALETTES,
  THEME_PRESETS,
  applyThemeColor,
  applyThemeOpacity,
  applyThemePalette,
  applyThemeWallpaper,
  getContrastRatioWithWhite,
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
      expect(ids).toContain("paper_ink");
      expect(ids).toContain("cyber_cold");
      expect(ids).toContain("aoi_sora");
      expect(ids).toContain("midnight_deep");
      expect(ids).toContain("sakura");

      const names = THEME_PRESETS.map((p) => p.name);
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

    it("enforces WCAG AA contrast (>= 4.5) for all curated palettes in both light and dark modes", () => {
      for (const palette of MULTI_COLOR_PALETTES) {
        expect(getContrastRatioWithWhite(palette.primary)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatioWithWhite(palette.primaryDark)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("updates canvas and surface semantic tokens when applying palette in light/dark mode", () => {
      const kyoto = MULTI_COLOR_PALETTES.find((p) => p.id === "kyoto_ink")!;
      document.documentElement.setAttribute("data-color-mode", "light");
      applyThemePalette(kyoto);
      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("51 65 85");
      expect(document.documentElement.style.getPropertyValue("--rin-surface-rgb")).toBe("255 255 255");

      document.documentElement.setAttribute("data-color-mode", "dark");
      applyThemePalette(kyoto);
      // 暗黑模式必须使用高对比印章朱而非浅灰 (#cbd5e1)，严防浅底白字
      expect(document.documentElement.style.getPropertyValue("--theme-rgb")).toBe("194 65 12");
      expect(document.documentElement.style.getPropertyValue("--rin-canvas-rgb")).toBe("19 21 24");
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
  });
});
