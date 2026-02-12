// Production seed: create a single user from environment variables.
// Usage: SEED_USER_USERNAME=admin SEED_USER_PASSWORD=Admin123 bun run db:seed-user
export {};

const API_URL = process.env.API_URL || "http://localhost:3000";
const username = process.env.SEED_USER_USERNAME;
const password = process.env.SEED_USER_PASSWORD;
const name = process.env.SEED_USER_NAME || "Admin";

if (!username || !password) {
  console.error("SEED_USER_USERNAME and SEED_USER_PASSWORD are required");
  process.exit(1);
}

async function main() {
  console.log(`Creating user: ${username}`);
  console.log(`API: ${API_URL}`);

  const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      username,
      email: `${username}@sugara.local`,
      password,
    }),
    redirect: "manual",
  });

  if (res.ok || res.status === 302) {
    console.log("User created successfully");
    return;
  }

  const body = await res.text();
  if (body.includes("already") || body.includes("exist")) {
    console.log("User already exists");
    return;
  }

  throw new Error(`Signup failed (${res.status}): ${body}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
