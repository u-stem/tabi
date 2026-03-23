import { createFeedbackSchema } from "@sugara/shared";
import { Hono } from "hono";
import { ERROR_MSG, RATE_LIMIT_FEEDBACK } from "../lib/constants";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { rateLimitByIp } from "../middleware/rate-limit";

const TITLE_MAX_LENGTH = 50;
const REPO_FORMAT = /^[\w.-]+\/[\w.-]+$/;

const feedbackRateLimit = rateLimitByIp(RATE_LIMIT_FEEDBACK);

export const feedbackRoutes = new Hono();

feedbackRoutes.post("/feedback", requireAuth, feedbackRateLimit, async (c) => {
  const json = await c.req.json();
  const parsed = createFeedbackSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { body } = parsed.data;

  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_FEEDBACK_REPO;
  if (!token || !repo || !REPO_FORMAT.test(repo)) {
    return c.json({ error: ERROR_MSG.GITHUB_NOT_CONFIGURED }, 500);
  }

  // Sanitize to prevent @mention spam and markdown injection
  const sanitized = body
    .replace(/@/g, "@ ")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/gi, (_match, text, url) => {
      // Decode HTML numeric entities to detect obfuscated protocols
      const decoded = url
        .replace(/&#x([\da-f]+);?/gi, (_: string, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        )
        .replace(/&#(\d+);?/g, (_: string, dec: string) =>
          String.fromCharCode(Number.parseInt(dec, 10)),
        );
      if (/^\s*(javascript|data|vbscript)\s*:/i.test(decoded)) {
        return `[${text}]()`;
      }
      return `[${text}](${url})`;
    });
  const title =
    sanitized.length > TITLE_MAX_LENGTH ? `${sanitized.slice(0, TITLE_MAX_LENGTH)}...` : sanitized;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body: sanitized,
      labels: ["feedback"],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch((err) => {
      logger.debug({ err }, "Failed to parse GitHub error response");
      return {};
    });
    logger.error({ status: res.status, errorBody }, "GitHub API error");
    return c.json({ error: ERROR_MSG.GITHUB_API_FAILED }, 502);
  }

  const data = await res.json().catch((err) => {
    logger.error({ err }, "Failed to parse GitHub success response");
    return null;
  });
  if (!data?.html_url) {
    return c.json({ error: ERROR_MSG.GITHUB_API_FAILED }, 502);
  }
  return c.json({ url: data.html_url }, 201);
});
