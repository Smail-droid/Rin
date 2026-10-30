import { describe, it, expect } from "bun:test";
import { isAllowedOrigin, getSafeCallbackUrl, isValidHttpUrl, sanitizeHttpUrl } from "../security";

describe("security utils", () => {
  const envWithFrontend = { FRONTEND_URL: "https://myblog.com" };
  const envEmpty = {};

  describe("isAllowedOrigin", () => {
    it("allows same origin as request", () => {
      expect(isAllowedOrigin("https://api.myblog.com", envEmpty, "https://api.myblog.com")).toBe(true);
    });

    it("allows configured FRONTEND_URL", () => {
      expect(isAllowedOrigin("https://myblog.com", envWithFrontend, "https://api.myblog.com")).toBe(true);
      expect(isAllowedOrigin("https://myblog.com/path", envWithFrontend, "https://api.myblog.com")).toBe(true);
    });

    it("allows localhost origins for local development", () => {
      expect(isAllowedOrigin("http://localhost:5173", envEmpty, "http://localhost:11498")).toBe(true);
      expect(isAllowedOrigin("http://127.0.0.1:3000", envEmpty, "http://localhost:11498")).toBe(true);
    });

    it("rejects untrusted external domains", () => {
      expect(isAllowedOrigin("https://evil.com", envWithFrontend, "https://api.myblog.com")).toBe(false);
      expect(isAllowedOrigin("https://attacker.org", envEmpty, "https://api.myblog.com")).toBe(false);
      expect(isAllowedOrigin("javascript:alert(1)", envEmpty, "https://api.myblog.com")).toBe(false);
    });
  });

  describe("getSafeCallbackUrl", () => {
    it("returns callback URL matching trusted referer", () => {
      const url = getSafeCallbackUrl("https://myblog.com/about", envWithFrontend, "https://api.myblog.com/user/github");
      expect(url.toString()).toBe("https://myblog.com/callback");
    });

    it("falls back to FRONTEND_URL when referer is untrusted", () => {
      const url = getSafeCallbackUrl("https://evil.com/phish", envWithFrontend, "https://api.myblog.com/user/github");
      expect(url.toString()).toBe("https://myblog.com/callback");
    });

    it("falls back to request origin when referer is untrusted and FRONTEND_URL not set", () => {
      const url = getSafeCallbackUrl("https://evil.com/phish", envEmpty, "https://api.myblog.com/user/github");
      expect(url.toString()).toBe("https://api.myblog.com/callback");
    });
  });

  describe("isValidHttpUrl and sanitizeHttpUrl", () => {
    it("validates http and https protocols", () => {
      expect(isValidHttpUrl("https://example.com")).toBe(true);
      expect(isValidHttpUrl("http://example.com/blog")).toBe(true);
      expect(isValidHttpUrl("ftp://example.com")).toBe(false);
      expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isValidHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
      expect(isValidHttpUrl("")).toBe(false);
      expect(isValidHttpUrl(null)).toBe(false);
    });

    it("sanitizes unsafe URLs to empty string", () => {
      expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeHttpUrl("data:text/html,test")).toBe("");
      expect(sanitizeHttpUrl("https://example.com")).toBe("https://example.com");
    });
  });
});
