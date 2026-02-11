const API_URL = process.env.API_URL || "http://localhost:3001";

const DEV_USERS = [
  { name: "開発ユーザー", email: "dev@example.com", password: "password123" },
  { name: "Alice", email: "alice@example.com", password: "password123" },
  { name: "Bob", email: "bob@example.com", password: "password123" },
];

const SAMPLE_TRIP = {
  title: "京都3日間の旅",
  destination: "京都",
  startDate: "2025-04-01",
  endDate: "2025-04-03",
};

const SAMPLE_SCHEDULES = [
  {
    dayIndex: 0,
    name: "金閣寺",
    category: "sightseeing",
    startTime: "09:00",
    endTime: "10:30",
  },
  {
    dayIndex: 0,
    name: "嵐山 竹林の小径",
    category: "sightseeing",
    startTime: "11:00",
    endTime: "12:00",
  },
  {
    dayIndex: 0,
    name: "湯豆腐 嵯峨野",
    category: "restaurant",
    startTime: "12:30",
    endTime: "13:30",
  },
  {
    dayIndex: 0,
    name: "嵐山から京都駅へ移動",
    category: "transport",
    startTime: "14:00",
    endTime: "14:45",
    departurePlace: "嵐山",
    arrivalPlace: "京都駅",
    transportMethod: "train",
  },
  {
    dayIndex: 0,
    name: "京都タワーホテル",
    category: "hotel",
    startTime: "15:00",
    endTime: "10:00",
  },
  {
    dayIndex: 1,
    name: "京都駅から伏見稲荷へ移動",
    category: "transport",
    startTime: "07:30",
    endTime: "07:45",
    departurePlace: "京都駅",
    arrivalPlace: "稲荷駅",
    transportMethod: "train",
  },
  {
    dayIndex: 1,
    name: "伏見稲荷大社",
    category: "sightseeing",
    startTime: "08:00",
    endTime: "10:00",
  },
  {
    dayIndex: 1,
    name: "錦市場",
    category: "restaurant",
    startTime: "11:00",
    endTime: "12:30",
  },
  {
    dayIndex: 1,
    name: "錦市場から清水寺へ移動",
    category: "transport",
    startTime: "13:00",
    endTime: "13:30",
    departurePlace: "錦市場",
    arrivalPlace: "清水寺",
    transportMethod: "bus",
  },
  {
    dayIndex: 1,
    name: "清水寺",
    category: "sightseeing",
    startTime: "14:00",
    endTime: "16:00",
  },
  {
    dayIndex: 2,
    name: "銀閣寺",
    category: "sightseeing",
    startTime: "09:00",
    endTime: "10:30",
  },
  {
    dayIndex: 2,
    name: "哲学の道",
    category: "activity",
    startTime: "10:30",
    endTime: "11:30",
  },
];

type ApiResponse = Record<string, unknown>;

async function apiFetch<T = ApiResponse>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function signupOrLogin(user: {
  name: string;
  email: string;
  password: string;
}): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
    redirect: "manual",
  });
  let cookies = res.headers.getSetCookie?.().join("; ") ?? "";
  if (!res.ok && res.status !== 302) {
    const body = await res.text();
    if (body.includes("already") || body.includes("exist")) {
      console.log("  Already exists, logging in...");
      const loginRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: user.password }),
        redirect: "manual",
      });
      cookies = loginRes.headers.getSetCookie?.().join("; ") ?? "";
      if (!loginRes.ok && loginRes.status !== 302) {
        throw new Error(`Login failed: ${await loginRes.text()}`);
      }
    } else {
      throw new Error(`Signup failed: ${body}`);
    }
  }
  return cookies;
}

async function main() {
  console.log("Seeding database...");
  console.log(`API: ${API_URL}`);

  // 1. Create all dev users
  const cookiesMap = new Map<string, string>();
  for (const user of DEV_USERS) {
    console.log(`\nCreating user: ${user.email}`);
    try {
      const cookies = await signupOrLogin(user);
      cookiesMap.set(user.email, cookies);
      console.log("  Done");
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        console.error(`\nError: API server is not running at ${API_URL}`);
        console.error("Run 'bun run dev' first, then try again.\n");
        process.exit(1);
      }
      throw err;
    }
  }

  const ownerCookies = cookiesMap.get(DEV_USERS[0].email);
  if (!ownerCookies) throw new Error(`Cookie not found for ${DEV_USERS[0].email}`);

  // 2. Create sample trip
  console.log(`\nCreating trip: ${SAMPLE_TRIP.title}`);
  const trip = await apiFetch<{ id: string; days?: { id: string; dayNumber: number }[] }>(
    "/api/trips",
    { method: "POST", body: JSON.stringify(SAMPLE_TRIP), headers: { cookie: ownerCookies } },
  );
  console.log(`  Trip ID: ${trip.id}`);

  // 3. Fetch trip details to get day IDs and default pattern IDs
  const tripDetail = await apiFetch<{
    days: { id: string; dayNumber: number; patterns: { id: string; isDefault: boolean }[] }[];
  }>(`/api/trips/${trip.id}`, { headers: { cookie: ownerCookies } });
  const days = tripDetail.days.sort((a, b) => a.dayNumber - b.dayNumber);

  // 4. Create schedules via pattern-scoped URLs
  console.log(`\nCreating ${SAMPLE_SCHEDULES.length} schedules...`);
  for (const schedule of SAMPLE_SCHEDULES) {
    const day = days[schedule.dayIndex];
    if (!day) continue;
    const defaultPattern = day.patterns.find((v) => v.isDefault) ?? day.patterns[0];
    if (!defaultPattern) continue;
    const { dayIndex: _, ...scheduleData } = schedule;
    await apiFetch(`/api/trips/${trip.id}/days/${day.id}/patterns/${defaultPattern.id}/schedules`, {
      method: "POST",
      body: JSON.stringify(scheduleData),
      headers: { cookie: ownerCookies },
    });
    console.log(`  ${day.dayNumber}日目: ${schedule.name}`);
  }

  // 5. Add other users as trip members
  const memberRoles = ["editor", "viewer"] as const;
  for (let i = 1; i < DEV_USERS.length; i++) {
    const user = DEV_USERS[i];
    const role = memberRoles[i - 1] ?? "editor";
    console.log(`\nAdding member: ${user.email} (${role})`);
    await apiFetch(`/api/trips/${trip.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: user.email, role }),
      headers: { cookie: ownerCookies },
    });
    console.log("  Done");
  }

  console.log("\n--- Seed complete ---");
  console.log("\nTest accounts:");
  for (let i = 0; i < DEV_USERS.length; i++) {
    const user = DEV_USERS[i];
    const role = i === 0 ? "owner" : (memberRoles[i - 1] ?? "editor");
    console.log(`  ${user.email} / ${user.password} (${role})`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
