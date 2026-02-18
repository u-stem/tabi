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
    urls: [
      "https://smartex.jr-central.co.jp/",
      "https://railway.jr-central.co.jp/timetable/nr/13/",
    ],
  },
  {
    dayIndex: 0,
    name: "金閣寺",
    category: "sightseeing",
    startTime: "10:30",
    endTime: "12:00",
    address: "京都市北区金閣寺町1",
    urls: [
      "https://www.shokoku-ji.jp/kinkakuji/",
      "https://www.google.com/maps/place/金閣寺",
      "https://ja.wikipedia.org/wiki/鹿苑寺",
    ],
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
    urls: ["https://www.yudofu-sagano.com/"],
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
    urls: ["https://www.kyoto-tower-hotel.co.jp/", "https://travel.rakuten.co.jp/HOTEL/8987/"],
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
    urls: ["https://inari.jp/"],
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
    urls: ["https://www.kiyomizudera.or.jp/"],
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
    urls: ["https://www.granvia-kyoto.co.jp/"],
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
    urls: ["https://www.shokoku-ji.jp/ginkakuji/"],
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
    urls: ["https://www.omen.co.jp/"],
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
  // Long data: long name, long address, long memo, many URLs
  {
    dayIndex: 2,
    name: "京都伝統産業ミュージアム（京都市勧業館みやこめっせ地下1階）",
    category: "sightseeing",
    startTime: "11:30",
    endTime: "12:30",
    address: "京都市左京区岡崎成勝寺町9番地の1 京都市勧業館みやこめっせ 地下1階",
    urls: [
      "https://kmtc.jp/",
      "https://www.google.com/maps/place/京都伝統産業ミュージアム",
      "https://ja.wikipedia.org/wiki/京都伝統産業ミュージアム",
      "https://www.tripadvisor.jp/Attraction_Review-g298564-d1386890-Reviews",
      "https://www.jalan.net/kankou/spt_26103cc3290031914/",
    ],
    memo: "入館無料 / 西陣織・京友禅・清水焼・京漆器など74品目の伝統工芸品を展示 / 体験コーナーあり（要予約・別途料金）/ 所要時間の目安は60〜90分",
    color: "yellow",
  },
];

const SAMPLE_CANDIDATES = [
  // sightseeing: URL multiple + address + memo
  {
    name: "二条城",
    category: "sightseeing",
    address: "京都市中京区二条通堀川西入二条城町541",
    memo: "世界遺産 / 二の丸御殿のうぐいす張りが有名",
    urls: ["https://nijo-jocastle.city.kyoto.lg.jp/", "https://www.google.com/maps/place/二条城"],
    color: "blue",
  },
  // sightseeing: URL single only
  {
    name: "鈴虫寺",
    category: "sightseeing",
    urls: ["https://www.suzutera.or.jp/"],
  },
  // sightseeing: memo only, no URL
  {
    name: "天龍寺",
    category: "sightseeing",
    memo: "嵐山にあるので竹林の小径とセットで回れる",
  },
  // restaurant: URL + memo + address + time
  {
    name: "% Arabica 京都 東山",
    category: "restaurant",
    address: "京都市東山区星野町87-5",
    urls: ["https://arabica.coffee/"],
    memo: "八坂の塔の近く / テイクアウトのみ",
    startTime: "09:00",
    endTime: "10:00",
    color: "red",
  },
  // restaurant: memo only
  {
    name: "出町ふたば",
    category: "restaurant",
    memo: "名代豆餅 / 行列必須",
  },
  // activity: URL only
  {
    name: "京都サイクリングツアー",
    category: "activity",
    urls: ["https://www.kctp.net/"],
    color: "green",
  },
  // activity: multiple URLs + memo
  {
    name: "着物レンタル 夢館",
    category: "activity",
    memo: "祇園散策用 / 要予約",
    urls: ["https://www.yumeyakata.com/", "https://www.yumeyakata.com/plan/"],
    color: "pink",
  },
  // transport: candidate with route info
  {
    name: "京都〜奈良 近鉄特急",
    category: "transport",
    departurePlace: "京都駅",
    arrivalPlace: "近鉄奈良駅",
    transportMethod: "train",
    memo: "片道約35分 / 特急料金520円",
    urls: ["https://www.kintetsu.co.jp/"],
    color: "orange",
  },
  // hotel: address + multiple URLs + time
  {
    name: "THE THOUSAND KYOTO",
    category: "hotel",
    address: "京都市下京区東塩小路町570",
    startTime: "15:00",
    endTime: "11:00",
    urls: [
      "https://www.the-thousand-kyoto.jp/",
      "https://travel.rakuten.co.jp/HOTEL/176498/",
      "https://www.booking.com/hotel/jp/the-thousand-kyoto.html",
    ],
    memo: "京都駅直結 / 朝食ビュッフェが人気",
    color: "purple",
  },
  // other: memo only, no URL/address
  {
    name: "京都駅ビル 大階段",
    category: "other",
    memo: "夜のイルミネーションがきれい",
  },
  // sightseeing: minimal (name + category only)
  {
    name: "平等院鳳凰堂",
    category: "sightseeing",
  },
  // Long data: long name, long address, long memo, max URLs, long route
  {
    name: "京都鉄道博物館（旧梅小路蒸気機関車館・旧交通科学博物館）",
    category: "sightseeing",
    address: "京都市下京区観喜寺町 梅小路公園内 京都鉄道博物館",
    urls: [
      "https://www.kyotorailwaymuseum.jp/",
      "https://www.google.com/maps/place/京都鉄道博物館",
      "https://www.tripadvisor.jp/Attraction_Review-g298564-d10020717-Reviews",
      "https://www.jalan.net/kankou/spt_guide000000190292/",
      "https://ja.wikipedia.org/wiki/京都鉄道博物館",
    ],
    memo: "入館料: 大人1,500円 / SLスチーム号の乗車体験あり（別途300円）/ 日本最大級の鉄道博物館で所要時間は2〜3時間 / 梅小路公園の散歩もおすすめ",
    startTime: "10:00",
    endTime: "13:00",
    color: "orange",
  },
  {
    name: "嵐山〜貴船 1日観光タクシープラン（MKタクシー）",
    category: "transport",
    departurePlace: "京都駅八条口 MKタクシーのりば",
    arrivalPlace: "貴船神社前（叡山電車 貴船口駅経由）",
    transportMethod: "taxi",
    memo: "所要約6時間 / 嵐山→天龍寺→竹林→大覚寺→鷹峯→貴船を巡るコース / 要事前予約（2日前まで）/ 料金目安: 35,000円〜",
    urls: ["https://www.mktaxi-japan.com/"],
    color: "yellow",
  },
];

const SAMPLE_BOOKMARK_LISTS = [
  {
    name: "京都グルメ",
    visibility: "private" as const,
    bookmarks: [
      {
        name: "出町ふたば",
        memo: "名代豆餅が有名。行列必須だが並ぶ価値あり",
        url: "https://tabelog.com/kyoto/A2601/A260302/26001520/",
      },
      {
        name: "中村藤吉本店",
        memo: "宇治抹茶スイーツの老舗",
        url: "https://www.tokichi.jp/",
      },
      {
        name: "% Arabica 京都 東山",
        url: "https://arabica.coffee/",
      },
      {
        name: "錦市場 食べ歩き",
        memo: "箸巻き・たこたまご・漬物がおすすめ",
      },
      {
        name: "湯豆腐 嵯峨野",
        memo: "嵐山の湯豆腐コース 4,000円",
        url: "https://www.yudofu-sagano.com/",
      },
      {
        name: "イノダコーヒ 本店",
        memo: "レトロな喫茶店。京の朝食セットが人気",
        url: "https://www.inoda-coffee.co.jp/",
      },
      {
        name: "ぎおん徳屋",
        memo: "本わらびもちが絶品",
      },
    ],
  },
  {
    name: "行きたい場所",
    visibility: "friends_only" as const,
    bookmarks: [
      {
        name: "チームラボ ボーダレス 麻布台",
        url: "https://www.teamlab.art/jp/e/borderless-azabudai/",
      },
      {
        name: "根津美術館",
        memo: "庭園も見どころ。国宝「燕子花図屏風」は春の特別展示",
        url: "https://www.nezu-muse.or.jp/",
      },
      {
        name: "鎌倉 報国寺",
        memo: "竹の庭で抹茶",
        url: "https://houkokuji.or.jp/",
      },
      {
        name: "直島",
        memo: "ベネッセアートサイト。フェリーで渡る",
      },
      {
        name: "屋久島 縄文杉トレッキング",
        memo: "往復10時間。体力に自信がある時に",
      },
    ],
  },
  {
    name: "旅行持ち物リスト",
    visibility: "public" as const,
    bookmarks: [
      { name: "パスポート" },
      { name: "充電器・モバイルバッテリー" },
      { name: "常備薬" },
      {
        name: "海外旅行保険",
        url: "https://www.sompo-japan.co.jp/kinsurance/leisure/off/",
      },
      { name: "変換プラグ", memo: "渡航先のコンセント形状を事前確認" },
    ],
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

  // 7. Create friend relationships (dev <-> alice, dev <-> bob)
  console.log("\nCreating friend relationships...");
  const aliceData = userMap.get("alice");
  const bobData = userMap.get("bob");

  if (aliceData) {
    // dev -> alice: send request, then alice accepts
    const req1 = await apiFetch<{ id: string }>("/api/friends/requests", {
      method: "POST",
      body: JSON.stringify({ addresseeId: aliceData.userId }),
      headers: { cookie: ownerCookies },
    });
    await apiFetch(`/api/friends/requests/${req1.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "accepted" }),
      headers: { cookie: aliceData.cookies },
    });
    console.log("  dev <-> alice: friends");
  }

  if (bobData) {
    // dev -> bob: send request, then bob accepts
    const req2 = await apiFetch<{ id: string }>("/api/friends/requests", {
      method: "POST",
      body: JSON.stringify({ addresseeId: bobData.userId }),
      headers: { cookie: ownerCookies },
    });
    await apiFetch(`/api/friends/requests/${req2.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "accepted" }),
      headers: { cookie: bobData.cookies },
    });
    console.log("  dev <-> bob: friends");
  }

  if (aliceData && bobData) {
    // alice -> bob: send request, then bob accepts
    const req3 = await apiFetch<{ id: string }>("/api/friends/requests", {
      method: "POST",
      body: JSON.stringify({ addresseeId: bobData.userId }),
      headers: { cookie: aliceData.cookies },
    });
    await apiFetch(`/api/friends/requests/${req3.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "accepted" }),
      headers: { cookie: bobData.cookies },
    });
    console.log("  alice <-> bob: friends");
  }

  // 8. Create groups with members
  console.log("\nCreating groups...");

  const group1 = await apiFetch<{ id: string }>("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name: "京都メンバー" }),
    headers: { cookie: ownerCookies },
  });
  if (aliceData) {
    await apiFetch(`/api/groups/${group1.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: aliceData.userId }),
      headers: { cookie: ownerCookies },
    });
  }
  if (bobData) {
    await apiFetch(`/api/groups/${group1.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: bobData.userId }),
      headers: { cookie: ownerCookies },
    });
  }
  console.log("  京都メンバー (dev所有, alice + bob)");

  const group2 = await apiFetch<{ id: string }>("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name: "家族" }),
    headers: { cookie: ownerCookies },
  });
  if (aliceData) {
    await apiFetch(`/api/groups/${group2.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: aliceData.userId }),
      headers: { cookie: ownerCookies },
    });
  }
  console.log("  家族 (dev所有, alice)");

  // 9. Create bookmark lists with bookmarks
  console.log(`\nCreating ${SAMPLE_BOOKMARK_LISTS.length} bookmark lists...`);
  for (const listData of SAMPLE_BOOKMARK_LISTS) {
    const { bookmarks: bms, ...listBody } = listData;
    const list = await apiFetch<{ id: string }>("/api/bookmark-lists", {
      method: "POST",
      body: JSON.stringify(listBody),
      headers: { cookie: ownerCookies },
    });
    console.log(`  リスト: ${listData.name} (${bms.length}件)`);
    for (const bm of bms) {
      await apiFetch(`/api/bookmark-lists/${list.id}/bookmarks`, {
        method: "POST",
        body: JSON.stringify(bm),
        headers: { cookie: ownerCookies },
      });
    }
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
