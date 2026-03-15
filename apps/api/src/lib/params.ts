import type { Context } from "hono";

/**
 * Extract a route parameter as a guaranteed string.
 * Route params defined in the path pattern (e.g. "/:tripId") always exist
 * when the handler runs, but Hono types them as `string | undefined`.
 */
export function getParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (value === undefined) {
    throw new Error(`Missing route parameter: ${name}`);
  }
  return value;
}
