import { isValidAvatarUrl } from "@sugara/shared";
import { betterAuth } from "better-auth";
import nodemailer from "nodemailer";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { username } from "better-auth/plugins/username";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import * as schema from "../db/schema";
import {
  GUEST_EMAIL_DOMAIN,
  SEVEN_DAYS_MS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "./constants";
import { env } from "./env";

const isProduction = process.env.NODE_ENV === "production";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

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
    sendResetPassword: async ({ user, url }) => {
      await transporter.sendMail({
        from: `"sugara" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: "【sugara】パスワードのリセット",
        html: `
          <p>パスワードリセットのリクエストを受け付けました。</p>
          <p><a href="${url}">こちらをクリックしてパスワードをリセットしてください</a></p>
          <p>このリンクは1時間有効です。リクエストに心当たりがない場合は無視してください。</p>
        `,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await transporter.sendMail({
        from: `"sugara" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: "【sugara】メールアドレスの確認",
        html: `
          <p>メールアドレスの確認リクエストを受け付けました。</p>
          <p><a href="${url}">こちらをクリックしてメールアドレスを確認してください</a></p>
          <p>このリンクは1時間有効です。</p>
        `,
      });
    },
  },
  user: {
    additionalFields: {
      guestExpiresAt: {
        type: "date",
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Set guestExpiresAt BEFORE insert so the session created right after includes it
        before: async (user) => {
          if (user.isAnonymous) {
            return {
              data: {
                ...user,
                guestExpiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
              },
            };
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
      emailDomainName: GUEST_EMAIL_DOMAIN,
      generateName: () => "ゲストユーザー",
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

          // Guests currently can't create bookmarks, but transfer defensively
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
    username({ minUsernameLength: USERNAME_MIN_LENGTH, maxUsernameLength: USERNAME_MAX_LENGTH }),
  ],
  trustedOrigins: [env.FRONTEND_URL],
});
