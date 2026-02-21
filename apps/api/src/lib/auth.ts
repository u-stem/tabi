import { isValidAvatarUrl } from "@sugara/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { username } from "better-auth/plugins/username";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { env } from "./env";

const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_BASE_URL,
  rateLimit: {
    enabled: isProduction,
    window: 60,
    max: 30,
    storage: "memory",
    customRules: {
      "/api/auth/sign-in/anonymous": { window: 60, max: 3 },
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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.isAnonymous) {
            const expiresAt = new Date(Date.now() + GUEST_TTL_MS);
            await db
              .update(schema.users)
              .set({ guestExpiresAt: expiresAt })
              .where(eq(schema.users.id, user.id));
          }
        },
      },
      update: {
        before: async (userData) => {
          // Reject arbitrary image URLs — only DiceBear or null allowed
          if (userData.image && !isValidAvatarUrl(userData.image)) {
            return false;
          }
        },
      },
    },
  },
  plugins: [
    anonymous({
      emailDomainName: "guest.sugara.local",
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const oldUserId = anonymousUser.user.id;
        const newUserId = newUser.user.id;

        await db.transaction(async (tx) => {
          await tx
            .update(schema.trips)
            .set({ ownerId: newUserId })
            .where(eq(schema.trips.ownerId, oldUserId));

          await tx
            .update(schema.tripMembers)
            .set({ userId: newUserId })
            .where(eq(schema.tripMembers.userId, oldUserId));

          await tx
            .update(schema.bookmarkLists)
            .set({ userId: newUserId })
            .where(eq(schema.bookmarkLists.userId, oldUserId));

          await tx
            .update(schema.activityLogs)
            .set({ userId: newUserId })
            .where(eq(schema.activityLogs.userId, oldUserId));

          await tx
            .update(schema.scheduleReactions)
            .set({ userId: newUserId })
            .where(eq(schema.scheduleReactions.userId, oldUserId));

          await tx
            .update(schema.schedulePollParticipants)
            .set({ userId: newUserId })
            .where(eq(schema.schedulePollParticipants.userId, oldUserId));

          await tx
            .update(schema.expenses)
            .set({ paidByUserId: newUserId })
            .where(eq(schema.expenses.paidByUserId, oldUserId));

          await tx
            .update(schema.expenseSplits)
            .set({ userId: newUserId })
            .where(eq(schema.expenseSplits.userId, oldUserId));
        });
      },
    }),
    username({ minUsernameLength: 3, maxUsernameLength: 20 }),
  ],
  trustedOrigins: [env.FRONTEND_URL],
});
