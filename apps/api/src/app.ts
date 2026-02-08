import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/", authRoutes);

export { app };
