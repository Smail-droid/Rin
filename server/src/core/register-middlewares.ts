import { cors } from "hono/cors";
import { timing } from "hono/timing";
import { authMiddleware, initContainerMiddleware } from "./hono-middleware";
import type { RinApp } from "./app-types";
import { isAllowedOrigin } from "../utils/security";

export function registerMiddlewares(app: RinApp) {
  app.use(
    "*",
    cors({
      origin: (origin, c) => {
        if (!origin) return origin;
        try {
          const requestOrigin = new URL(c.req.url).origin;
          if (isAllowedOrigin(origin, c.env, requestOrigin)) {
            return origin;
          }
        } catch {
          // If URL parsing fails, reject
        }
        return null;
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowHeaders: ["content-type", "authorization", "x-csrf-token"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use("*", timing({ totalDescription: "" }));
  app.use("*", initContainerMiddleware);
  app.use("*", authMiddleware);
}
