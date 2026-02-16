import { Hono } from "hono";
import { cors } from "hono/cors";
import { ERROR_MSG } from "./lib/constants";
import { env } from "./lib/env";
import { accountRoutes } from "./routes/account";
import { activityLogRoutes } from "./routes/activity-logs";
import { authRoutes } from "./routes/auth";
import { candidateRoutes } from "./routes/candidates";
import { feedbackRoutes } from "./routes/feedback";
import { friendRoutes } from "./routes/friends";
import { memberRoutes } from "./routes/members";
import { patternRoutes } from "./routes/patterns";
import { reactionRoutes } from "./routes/reactions";
import { scheduleRoutes } from "./routes/schedules";
import { shareRoutes } from "./routes/share";
import { tripDayRoutes } from "./routes/trip-days";
import { tripRoutes } from "./routes/trips";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ error: ERROR_MSG.INVALID_JSON }, 400);
  }
  console.error("Unhandled error:", err.stack || err);
  return c.json({ error: ERROR_MSG.INTERNAL_ERROR }, 500);
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/", authRoutes);
app.route("/api/trips", tripRoutes);
app.route("/api/trips", patternRoutes);
app.route("/api/trips", scheduleRoutes);
app.route("/api/trips", candidateRoutes);
app.route("/api/trips", reactionRoutes);
app.route("/api/trips", memberRoutes);
app.route("/api/trips", tripDayRoutes);
app.route("/api/trips", activityLogRoutes);
app.route("/api/friends", friendRoutes);
app.route("/api", accountRoutes);
app.route("/api", feedbackRoutes);
app.route("/", shareRoutes);

export { app };
