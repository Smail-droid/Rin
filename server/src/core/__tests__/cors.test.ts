import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { registerMiddlewares } from "../register-middlewares";
import type { Variables } from "../hono-types";

describe("CORS security middleware", () => {
  const env: Env = {
    FRONTEND_URL: "https://myblog.com",
    JWT_SECRET: "mock_jwt_secret_at_least_32_bits",
  } as any;

  function createTestApp() {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    registerMiddlewares(app as any);
    app.get("/api/test", (c) => c.text("ok"));
    return app;
  }

  it("allows trusted configured frontend origin", async () => {
    const app = createTestApp();
    const res = await app.request("/api/test", {
      headers: {
        Origin: "https://myblog.com",
      },
    }, env);

    expect(res.headers.get("access-control-allow-origin")).toBe("https://myblog.com");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("allows localhost origins for development", async () => {
    const app = createTestApp();
    const res = await app.request("/api/test", {
      headers: {
        Origin: "http://localhost:5173",
      },
    }, env);

    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("blocks untrusted third-party origins", async () => {
    const app = createTestApp();
    const res = await app.request("/api/test", {
      headers: {
        Origin: "https://malicious-site.com",
      },
    }, env);

    // Untrusted origins should NOT receive access-control-allow-origin
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
