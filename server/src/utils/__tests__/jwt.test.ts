import { describe, it, expect } from "bun:test";
import { createJWT } from "../jwt";

describe("createJWT", () => {
  const secret = "test-secret-at-least-32-chars-long-secure";
  const jwt = createJWT(secret);

  it("should sign and verify payload with expiration", async () => {
    const token = await jwt.sign({ id: 123, username: "admin" });
    expect(typeof token).toBe("string");

    const payload = await jwt.verify(token);
    expect(payload).toBeTruthy();
    expect(payload.id).toBe(123);
    expect(payload.username).toBe("admin");
    expect(typeof payload.exp).toBe("number");
    expect(typeof payload.iat).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("should fail verification for tampered token", async () => {
    const token = await jwt.sign({ id: 1 });
    const tampered = token.slice(0, -5) + "abcde";
    const result = await jwt.verify(tampered);
    expect(result).toBe(false);
  });

  it("should fail verification for expired token", async () => {
    // 0s expiration
    const token = await jwt.sign({ id: 1 }, { expiresIn: "0s" });
    // Brief sleep to let it expire
    await new Promise((resolve) => setTimeout(resolve, 50));
    const result = await jwt.verify(token);
    expect(result).toBe(false);
  });

  it("should return false for empty token", async () => {
    expect(await jwt.verify("")).toBe(false);
    expect(await jwt.verify(undefined)).toBe(false);
  });

  it("should throw if secret is empty", () => {
    expect(() => createJWT("")).toThrow("Secret can't be empty");
  });
});
