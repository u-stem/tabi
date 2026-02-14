import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins/username";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { env } from "./env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_BASE_URL,
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    storage: "memory",
    customRules: {
      "/api/auth/sign-in/*": { window: 60, max: 5 },
      "/api/auth/sign-up/*": { window: 60, max: 3 },
      "/api/auth/change-password": { window: 60, max: 3 },
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 20 })],
  trustedOrigins: [env.FRONTEND_URL],
});
