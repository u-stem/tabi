import type { Env } from "hono";
import { Hono } from "hono";

export const TEST_USER = { id: "user-1", name: "Test User", email: "test@example.com" };

export function createTestApp<E extends Env>(routes: Hono<E>, prefix: string) {
  const app = new Hono();
  app.route(prefix, routes);
  return app;
}
