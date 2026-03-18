import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger";
import type { AppEnv } from "../types";

export function requestLogger(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;

    if (path === "/health") return;

    const log = status >= 500 ? logger.error : status >= 400 ? logger.warn : logger.info;
    log.call(logger, { requestId, method, path, status, duration, userId: c.get("user")?.id });
  };
}
