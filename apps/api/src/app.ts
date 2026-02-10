import { Hono } from "hono";
import { cors } from "hono/cors";
import { ERROR_MSG } from "./lib/constants";
import { authRoutes } from "./routes/auth";
import { candidateRoutes } from "./routes/candidates";
import { memberRoutes } from "./routes/members";
import { patternRoutes } from "./routes/patterns";
import { shareRoutes } from "./routes/share";
import { spotRoutes } from "./routes/spots";
import { tripRoutes } from "./routes/trips";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ error: ERROR_MSG.INVALID_JSON }, 400);
  }
  console.error(err);
  return c.json({ error: ERROR_MSG.INTERNAL_ERROR }, 500);
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/", authRoutes);
app.route("/api/trips", tripRoutes);
app.route("/api/trips", patternRoutes);
app.route("/api/trips", spotRoutes);
app.route("/api/trips", candidateRoutes);
app.route("/api/trips", memberRoutes);
app.route("/", shareRoutes);

export { app };
