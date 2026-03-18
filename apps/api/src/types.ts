import type { Session } from "better-auth";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  isAnonymous: boolean;
  guestExpiresAt?: Date | string | null;
};

export type AppEnv = {
  Variables: {
    user: AuthUser;
    session: Session;
    tripRole: import("@sugara/shared").MemberRole;
    requestId: string;
  };
};

// For routes using optionalAuth where user may not be present
export type OptionalAuthEnv = {
  Variables: {
    user?: AuthUser;
    session?: Session;
  };
};
