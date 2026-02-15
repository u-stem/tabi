import { createFeedbackSchema } from "@sugara/shared";
import { Hono } from "hono";
import { ERROR_MSG } from "../lib/constants";
import { env } from "../lib/env";
import { requireAuth } from "../middleware/auth";

const TITLE_MAX_LENGTH = 50;
const REPO_FORMAT = /^[\w.-]+\/[\w.-]+$/;

export const feedbackRoutes = new Hono();

feedbackRoutes.post("/feedback", requireAuth, async (c) => {
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

  const title = body.length > TITLE_MAX_LENGTH ? `${body.slice(0, TITLE_MAX_LENGTH)}...` : body;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
      labels: ["feedback"],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    console.error("GitHub API error:", res.status, errorBody);
    return c.json({ error: ERROR_MSG.GITHUB_API_FAILED }, 502);
  }

  const data = await res.json().catch(() => null);
  if (!data?.html_url) {
    return c.json({ error: ERROR_MSG.GITHUB_API_FAILED }, 502);
  }
  return c.json({ url: data.html_url }, 201);
});
