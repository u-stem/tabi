const API_URL = process.env.API_URL || "http://localhost:3001";

const DEV_USER = {
  name: "開発ユーザー",
  email: "dev@example.com",
  password: "password123",
};

const SAMPLE_TRIP = {
  title: "京都3日間の旅",
  destination: "京都",
  startDate: "2025-04-01",
  endDate: "2025-04-03",
};

const SAMPLE_SPOTS = [
  {
    dayIndex: 0,
    name: "金閣寺",
    category: "sightseeing",
    startTime: "09:00",
    endTime: "10:30",
    latitude: 35.0394,
    longitude: 135.7292,
  },
  {
    dayIndex: 0,
    name: "嵐山 竹林の小径",
    category: "sightseeing",
    startTime: "11:00",
    endTime: "12:00",
    latitude: 35.0173,
    longitude: 135.6711,
  },
  {
    dayIndex: 0,
    name: "湯豆腐 嵯峨野",
    category: "restaurant",
    startTime: "12:30",
    endTime: "13:30",
    latitude: 35.0148,
    longitude: 135.6745,
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
    latitude: 34.9671,
    longitude: 135.7727,
  },
  {
    dayIndex: 1,
    name: "錦市場",
    category: "restaurant",
    startTime: "11:00",
    endTime: "12:30",
    latitude: 35.005,
    longitude: 135.7649,
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
    latitude: 34.9949,
    longitude: 135.785,
  },
  {
    dayIndex: 2,
    name: "銀閣寺",
    category: "sightseeing",
    startTime: "09:00",
    endTime: "10:30",
    latitude: 35.027,
    longitude: 135.7983,
  },
  {
    dayIndex: 2,
    name: "哲学の道",
    category: "activity",
    startTime: "10:30",
    endTime: "11:30",
    latitude: 35.0232,
    longitude: 135.7942,
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

async function main() {
  console.log("Seeding database...");
  console.log(`API: ${API_URL}`);

  // 1. Create dev user via signup API
  console.log(`\nCreating user: ${DEV_USER.email}`);
  let cookies: string;
  try {
    const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEV_USER),
      redirect: "manual",
    });
    cookies = res.headers.getSetCookie?.().join("; ") ?? "";
    if (!res.ok && res.status !== 302) {
      const body = await res.text();
      if (body.includes("already") || body.includes("exist")) {
        console.log("  User already exists, logging in...");
        const loginRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: DEV_USER.email, password: DEV_USER.password }),
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
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      console.error(`\nError: API server is not running at ${API_URL}`);
      console.error("Run 'bun run dev' first, then try again.\n");
      process.exit(1);
    }
    throw err;
  }
  console.log("  Done");

  // 2. Create sample trip
  console.log(`\nCreating trip: ${SAMPLE_TRIP.title}`);
  const trip = await apiFetch<{ id: string; days?: { id: string; dayNumber: number }[] }>(
    "/api/trips",
    { method: "POST", body: JSON.stringify(SAMPLE_TRIP), headers: { cookie: cookies } },
  );
  console.log(`  Trip ID: ${trip.id}`);

  // 3. Fetch trip details to get day IDs and default pattern IDs
  const tripDetail = await apiFetch<{
    days: { id: string; dayNumber: number; patterns: { id: string; isDefault: boolean }[] }[];
  }>(`/api/trips/${trip.id}`, { headers: { cookie: cookies } });
  const days = tripDetail.days.sort((a, b) => a.dayNumber - b.dayNumber);

  // 4. Create spots via pattern-scoped URLs
  console.log(`\nCreating ${SAMPLE_SPOTS.length} spots...`);
  for (const spot of SAMPLE_SPOTS) {
    const day = days[spot.dayIndex];
    if (!day) continue;
    const defaultPattern = day.patterns.find((v) => v.isDefault) ?? day.patterns[0];
    if (!defaultPattern) continue;
    const { dayIndex: _, ...spotData } = spot;
    await apiFetch(`/api/trips/${trip.id}/days/${day.id}/patterns/${defaultPattern.id}/spots`, {
      method: "POST",
      body: JSON.stringify(spotData),
      headers: { cookie: cookies },
    });
    console.log(`  ${day.dayNumber}日目: ${spot.name}`);
  }

  console.log("\n--- Seed complete ---");
  console.log(`Email:    ${DEV_USER.email}`);
  console.log(`Password: ${DEV_USER.password}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
