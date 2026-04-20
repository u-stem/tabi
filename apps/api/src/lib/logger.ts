import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.VITEST ? "silent" : "info"),
  // Vercel adds timestamps automatically; avoid duplication
  timestamp: false,
  formatters: {
    level: (label) => ({ level: label }),
  },
});
