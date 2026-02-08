export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AppEnv = {
  Variables: {
    user: AuthUser;
    session: unknown;
  };
};
