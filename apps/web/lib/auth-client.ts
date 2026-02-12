import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  plugins: [usernameClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

// Helper type: session user with username plugin fields
export type SessionUser = NonNullable<ReturnType<typeof useSession>["data"]>["user"];
