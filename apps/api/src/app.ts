import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
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
    return c.json({ error: "Invalid JSON" }, 400);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/", authRoutes);
app.route("/api/trips", tripRoutes);
app.route("/api/trips", patternRoutes);
app.route("/api/trips", spotRoutes);
app.route("/api/trips", memberRoutes);
app.route("/", shareRoutes);

export { app };
