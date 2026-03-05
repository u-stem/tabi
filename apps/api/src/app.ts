import { Hono } from "hono";
import { cors } from "hono/cors";
import { ERROR_MSG } from "./lib/constants";
import { env } from "./lib/env";
import { accountRoutes } from "./routes/account";
import { activityLogRoutes } from "./routes/activity-logs";
import { adminRoutes } from "./routes/admin";
import { announcementRoutes } from "./routes/announcement";
import { authRoutes } from "./routes/auth";
import { bookmarkListRoutes } from "./routes/bookmark-lists";
import { bookmarkRoutes } from "./routes/bookmarks";
import { candidateRoutes } from "./routes/candidates";
import { directionsRoutes } from "./routes/directions";
import { expenseRoutes } from "./routes/expenses";
import { faqRoutes } from "./routes/faqs";
import { feedbackRoutes } from "./routes/feedback";
import { friendRoutes } from "./routes/friends";
import { groupRoutes } from "./routes/groups";
import { memberRoutes } from "./routes/members";
import { notificationPreferenceRoutes } from "./routes/notification-preferences";
import { notificationRoutes } from "./routes/notifications";
import { patternRoutes } from "./routes/patterns";
import { pollShareRoutes } from "./routes/poll-share";
import { pollRoutes } from "./routes/polls";
import { profileRoutes } from "./routes/profile";
import { publicSettingsRoutes } from "./routes/public-settings";
import { pushSubscriptionRoutes } from "./routes/push-subscriptions";
import { quickPollShareRoutes } from "./routes/quick-poll-share";
import { quickPollRoutes } from "./routes/quick-polls";
import { reactionRoutes } from "./routes/reactions";
import { scheduleRoutes } from "./routes/schedules";
import { shareRoutes } from "./routes/share";
import { souvenirRoutes } from "./routes/souvenirs";
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
  if (err.message?.includes("invalid input syntax for type uuid")) {
    return c.json({ error: ERROR_MSG.INVALID_ID_FORMAT }, 400);
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
app.route("/api/trips", expenseRoutes);
app.route("/api/trips", souvenirRoutes);
app.route("/api/polls", pollRoutes);
app.route("/api/quick-polls", quickPollRoutes);
app.route("/api/friends", friendRoutes);
app.route("/api/groups", groupRoutes);
app.route("/api/bookmark-lists", bookmarkListRoutes);
app.route("/api/bookmark-lists", bookmarkRoutes);
app.route("/api/users", profileRoutes);
app.route("/api", accountRoutes);
app.route("/api", feedbackRoutes);
app.route("/api/directions", directionsRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/push-subscriptions", pushSubscriptionRoutes);
app.route("/api/notification-preferences", notificationPreferenceRoutes);
app.route("/", shareRoutes);
app.route("/", pollShareRoutes);
app.route("/", quickPollShareRoutes);
app.route("/", publicSettingsRoutes);
app.route("/", adminRoutes);
app.route("/", faqRoutes);
app.route("/", announcementRoutes);

export { app };
