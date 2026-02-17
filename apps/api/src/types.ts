export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AppEnv = {
  Variables: {
    user: AuthUser;
    session: unknown;
    tripRole: import("@sugara/shared").MemberRole;
  };
};

// For routes using optionalAuth where user may not be present
export type OptionalAuthEnv = {
  Variables: {
    user?: AuthUser;
    session?: unknown;
  };
};
