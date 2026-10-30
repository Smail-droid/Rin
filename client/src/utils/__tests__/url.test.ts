import { describe, it, expect } from "bun:test";
import { safeHttpUrl } from "../url";

describe("safeHttpUrl", () => {
  it("allows valid http and https URLs", () => {
    expect(safeHttpUrl("https://example.com")).toBe("https://example.com");
    expect(safeHttpUrl("http://example.com/path?query=1")).toBe("http://example.com/path?query=1");
  });

  it("rejects javascript pseudo-protocol", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("JAVASCRIPT:alert(document.cookie)")).toBeUndefined();
  });

  it("rejects data, vbscript and relative paths", () => {
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHttpUrl("vbscript:msgbox")).toBeUndefined();
    expect(safeHttpUrl("/relative/path")).toBeUndefined();
  });

  it("handles null, undefined, empty", () => {
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});
