function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function withDefault(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

// Use getters so tests can stub process.env and have the changes reflected
export const env = {
  get DATABASE_URL() {
    return withDefault("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
  },
  get BETTER_AUTH_BASE_URL() {
    return withDefault("BETTER_AUTH_BASE_URL", "http://localhost:3000");
  },
  get BETTER_AUTH_SECRET() {
    return required("BETTER_AUTH_SECRET");
  },
  get FRONTEND_URL() {
    return withDefault("FRONTEND_URL", "http://localhost:3000");
  },
  get GITHUB_TOKEN() {
    return process.env.GITHUB_TOKEN;
  },
  get GITHUB_FEEDBACK_REPO() {
    return process.env.GITHUB_FEEDBACK_REPO;
  },
};
