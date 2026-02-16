export {};

const API_URL = process.env.API_URL || "http://localhost:3000";

const DEV_USERS = [
  { name: "開発ユーザー", username: "dev", email: "dev@sugara.local", password: "Password1" },
  { name: "Alice", username: "alice", email: "alice@sugara.local", password: "Password1" },
  { name: "Bob", username: "bob", email: "bob@sugara.local", password: "Password1" },
];

const SAMPLE_TRIP = {
  title: "京都3日間の旅",
  destination: "京都",
  startDate: "2026-03-20",
  endDate: "2026-03-22",
};

const SAMPLE_SCHEDULES = [
  // --- Day 1 ---
  {
    dayIndex: 0,
    name: "東京から京都へ移動",
    category: "transport",
    startTime: "07:30",
    endTime: "09:45",
    departurePlace: "東京駅",
    arrivalPlace: "京都駅",
    transportMethod: "shinkansen",
    color: "orange",
    memo: "のぞみ7号 7号車12A",
    url: "https://smartex.jr-central.co.jp/",
  },
  {
    dayIndex: 0,
    name: "金閣寺",
    category: "sightseeing",
    startTime: "10:30",
    endTime: "12:00",
    address: "京都市北区金閣寺町1",
    url: "https://www.shokoku-ji.jp/kinkakuji/",
    color: "blue",
    memo: "拝観料: 500円",
  },
  {
    dayIndex: 0,
    name: "金閣寺から嵐山へ移動",
    category: "transport",
    startTime: "12:15",
    endTime: "12:45",
    departurePlace: "金閣寺道",
    arrivalPlace: "嵐山",
    transportMethod: "bus",
    color: "green",
  },
  {
    dayIndex: 0,
    name: "嵐山 竹林の小径",
    category: "sightseeing",
    startTime: "13:00",
    endTime: "14:00",
    address: "京都市右京区嵯峨天龍寺芒ノ馬場町",
  },
  {
    dayIndex: 0,
    name: "湯豆腐 嵯峨野",
    category: "restaurant",
    startTime: "14:15",
    endTime: "15:15",
    address: "京都市右京区嵯峨天龍寺芒ノ馬場町45",
    url: "https://www.yudofu-sagano.com/",
    memo: "予約済み 14:30 / 湯豆腐コース 4,000円",
    color: "red",
  },
  {
    dayIndex: 0,
    name: "嵐山から京都駅へ移動",
    category: "transport",
    startTime: "15:30",
    endTime: "16:15",
    departurePlace: "嵐山",
    arrivalPlace: "京都駅",
    transportMethod: "train",
  },
  {
    dayIndex: 0,
    name: "京都タワーホテル",
    category: "hotel",
    startTime: "17:00",
    endTime: "10:00",
    endDayOffset: 1,
    address: "京都市下京区烏丸通七条下る東塩小路町721-1",
    url: "https://www.kyoto-tower-hotel.co.jp/",
    memo: "予約番号: KTH-20260320 / ツイン / 朝食付き 15,800円",
    color: "purple",
  },
  // --- Day 2 ---
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
    address: "京都市伏見区深草藪之内町68",
    url: "https://inari.jp/",
    color: "red",
  },
  {
    dayIndex: 1,
    name: "稲荷駅から錦市場へ移動",
    category: "transport",
    startTime: "10:15",
    endTime: "10:45",
    departurePlace: "稲荷駅",
    arrivalPlace: "四条駅",
    transportMethod: "train",
    color: "green",
  },
  {
    dayIndex: 1,
    name: "錦市場",
    category: "restaurant",
    startTime: "11:00",
    endTime: "12:30",
    address: "京都市中京区錦小路通",
    memo: "食べ歩き / 箸巻き・たこたまご・漬物",
    color: "orange",
  },
  {
    dayIndex: 1,
    name: "錦市場から清水寺へ移動",
    category: "transport",
    startTime: "13:00",
    endTime: "13:30",
    departurePlace: "四条河原町",
    arrivalPlace: "清水道",
    transportMethod: "bus",
    color: "green",
    memo: "市バス207号系統",
  },
  {
    dayIndex: 1,
    name: "清水寺",
    category: "sightseeing",
    startTime: "14:00",
    endTime: "16:00",
    address: "京都市東山区清水1丁目294",
    url: "https://www.kiyomizudera.or.jp/",
    memo: "拝観料: 400円 / 舞台からの眺望",
    color: "blue",
  },
  {
    dayIndex: 1,
    name: "清水寺から祇園へ散歩",
    category: "transport",
    startTime: "16:00",
    endTime: "16:30",
    departurePlace: "清水寺",
    arrivalPlace: "祇園",
    transportMethod: "walk",
    color: "gray",
  },
  {
    dayIndex: 1,
    name: "祇園散策",
    category: "activity",
    startTime: "16:30",
    endTime: "18:00",
    address: "京都市東山区祇園町",
    memo: "花見小路通り / 八坂神社",
    color: "pink",
  },
  {
    dayIndex: 1,
    name: "祇園から京都駅へ移動",
    category: "transport",
    startTime: "18:15",
    endTime: "18:30",
    departurePlace: "祇園四条駅",
    arrivalPlace: "京都駅",
    transportMethod: "taxi",
    color: "yellow",
    memo: "約1,500円",
  },
  {
    dayIndex: 1,
    name: "京都駅ビル 拉麺小路",
    category: "restaurant",
    startTime: "18:45",
    endTime: "19:30",
    address: "京都市下京区東塩小路町 京都駅ビル10F",
  },
  {
    dayIndex: 1,
    name: "ホテルグランヴィア京都",
    category: "hotel",
    startTime: "20:00",
    endTime: "09:00",
    endDayOffset: 1,
    address: "京都市下京区烏丸通塩小路下る JR京都駅中央口",
    url: "https://www.granvia-kyoto.co.jp/",
    memo: "予約番号: GV-88432 / デラックスツイン / 22,000円",
    color: "purple",
  },
  // --- Day 3 ---
  {
    dayIndex: 2,
    name: "ホテルから銀閣寺へ移動",
    category: "transport",
    startTime: "09:30",
    endTime: "10:00",
    departurePlace: "京都駅",
    arrivalPlace: "銀閣寺道",
    transportMethod: "bus",
    color: "green",
  },
  {
    dayIndex: 2,
    name: "銀閣寺",
    category: "sightseeing",
    startTime: "10:00",
    endTime: "11:00",
    address: "京都市左京区銀閣寺町2",
    url: "https://www.shokoku-ji.jp/ginkakuji/",
    memo: "拝観料: 500円",
    color: "blue",
  },
  {
    dayIndex: 2,
    name: "哲学の道 散策",
    category: "activity",
    startTime: "11:00",
    endTime: "12:00",
    address: "京都市左京区浄土寺石橋町",
    memo: "桜の季節は特におすすめ",
    color: "pink",
  },
  {
    dayIndex: 2,
    name: "おめん 銀閣寺本店",
    category: "restaurant",
    startTime: "12:00",
    endTime: "13:00",
    address: "京都市左京区浄土寺石橋町74",
    url: "https://www.omen.co.jp/",
    memo: "名物うどん / 予約不要",
    color: "red",
  },
  {
    dayIndex: 2,
    name: "京都から東京へ移動",
    category: "transport",
    startTime: "14:00",
    endTime: "16:15",
    departurePlace: "京都駅",
    arrivalPlace: "東京駅",
    transportMethod: "shinkansen",
    color: "orange",
    memo: "のぞみ32号 自由席",
  },
];

const SAMPLE_CANDIDATES = [
  {
    name: "二条城",
    category: "sightseeing",
    memo: "世界遺産 / 二の丸御殿のうぐいす張りが有名",
    url: "https://nijo-jocastle.city.kyoto.lg.jp/",
  },
  {
    name: "鈴虫寺",
    category: "sightseeing",
    url: "https://www.suzutera.or.jp/",
  },
  {
    name: "天龍寺",
    category: "sightseeing",
    memo: "嵐山にあるので竹林の小径とセットで回れる",
  },
  {
    name: "% Arabica 京都 東山",
    category: "restaurant",
    url: "https://arabica.coffee/",
    memo: "八坂の塔の近く / テイクアウトのみ",
  },
  {
    name: "出町ふたば",
    category: "restaurant",
    memo: "名代豆餅 / 行列必須",
  },
  {
    name: "京都サイクリングツアー",
    category: "activity",
    url: "https://www.kctp.net/",
  },
  {
    name: "着物レンタル 夢館",
    category: "activity",
    memo: "祇園散策用 / 要予約",
    url: "https://www.yumeyakata.com/",
  },
  {
    name: "京都駅ビル 大階段",
    category: "other",
    memo: "夜のイルミネーションがきれい",
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

type DevUser = {
  name: string;
  username: string;
  email: string;
  password: string;
};

async function signupOrLogin(user: DevUser): Promise<{ cookies: string; userId: string }> {
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
      const loginRes = await fetch(`${API_URL}/api/auth/sign-in/username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, password: user.password }),
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

  // Fetch user ID from session
  const sessionRes = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: { cookie: cookies },
  });
  const session = (await sessionRes.json()) as { user: { id: string } };
  return { cookies, userId: session.user.id };
}

async function main() {
  console.log("Seeding database...");
  console.log(`API: ${API_URL}`);

  // 1. Create all dev users
  const userMap = new Map<string, { cookies: string; userId: string }>();
  for (const user of DEV_USERS) {
    console.log(`\nCreating user: ${user.username}`);
    try {
      const result = await signupOrLogin(user);
      userMap.set(user.username, result);
      console.log(`  Done (ID: ${result.userId})`);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        console.error(`\nError: API server is not running at ${API_URL}`);
        console.error("Run 'bun run dev' first, then try again.\n");
        process.exit(1);
      }
      throw err;
    }
  }

  const ownerData = userMap.get(DEV_USERS[0].username);
  if (!ownerData) throw new Error(`Data not found for ${DEV_USERS[0].username}`);
  const ownerCookies = ownerData.cookies;

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

  // 5. Create candidates
  console.log(`\nCreating ${SAMPLE_CANDIDATES.length} candidates...`);
  for (const candidate of SAMPLE_CANDIDATES) {
    await apiFetch(`/api/trips/${trip.id}/candidates`, {
      method: "POST",
      body: JSON.stringify(candidate),
      headers: { cookie: ownerCookies },
    });
    console.log(`  候補: ${candidate.name}`);
  }

  // 6. Add other users as trip members
  const memberRoles = ["editor", "viewer"] as const;
  for (let i = 1; i < DEV_USERS.length; i++) {
    const user = DEV_USERS[i];
    const role = memberRoles[i - 1] ?? "editor";
    const userData = userMap.get(user.username);
    if (!userData) continue;
    console.log(`\nAdding member: ${user.username} (${role})`);
    await apiFetch(`/api/trips/${trip.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: userData.userId, role }),
      headers: { cookie: ownerCookies },
    });
    console.log("  Done");
  }

  console.log("\n--- Seed complete ---");
  console.log("\nTest accounts:");
  for (let i = 0; i < DEV_USERS.length; i++) {
    const user = DEV_USERS[i];
    const role = i === 0 ? "owner" : (memberRoles[i - 1] ?? "editor");
    console.log(`  ${user.username} / ${user.password} (${role})`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
