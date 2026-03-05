# Google Maps 統合 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Google Maps を旅行計画アプリに統合し、Places Autocomplete によるスポット入力補完・右パネルの地図タブ・タイムライン上の移動所要時間表示を実装する。管理者が作成した旅行のみで有効化する。

**Architecture:** `trips.maps_enabled` フラグで機能を制御。スポット作成時に Places API で lat/lng を取得・保存し、地図表示と Routes API プロキシ経由の所要時間計算に使用する。

**Tech Stack:** `@vis.gl/react-google-maps` (Maps JS + Places)、Google Routes API (server-side proxy)、Drizzle ORM migration、Vitest

---

## 前提確認

**環境変数（実装前に Google Cloud Console で取得して設定）:**

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...  # Maps JS + Places 用、HTTP リファラー制限付き
GOOGLE_MAPS_API_KEY=...              # Routes API 用、制限なし（サーバー専用）
```

ローカルの `.env.local` に追加。Vercel にも両方追加する。

---

### Task 1: DB schema に maps_enabled / lat / lng / place_id を追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: schema.ts を編集**

`trips` テーブルの `updatedAt` の直前に以下を追加:

```typescript
// apps/api/src/db/schema.ts の trips テーブル内
mapsEnabled: boolean("maps_enabled").notNull().default(false),
```

`schedules` テーブルの `createdAt` の直前に以下を追加:

```typescript
// apps/api/src/db/schema.ts の schedules テーブル内
latitude: doublePrecision("latitude"),
longitude: doublePrecision("longitude"),
placeId: varchar("place_id", { length: 255 }),
```

ファイル先頭の import に `doublePrecision` が含まれていなければ追加:

```typescript
import {
  // ...既存...
  doublePrecision,
} from "drizzle-orm/pg-core";
```

**Step 2: migration ファイルを生成**

```bash
bun run db:generate
```

期待: `apps/api/src/db/migrations/` に新しい SQL ファイルが生成される。内容に `maps_enabled`, `latitude`, `longitude`, `place_id` が含まれることを確認。

**Step 3: migration を実行**

```bash
bun run db:migrate
```

期待: `✓ migrations applied` のようなログで正常終了。

**Step 4: 型チェック**

```bash
bun run check-types
```

期待: エラーなし。

**Step 5: commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrations/
git commit -m "feat: maps_enabled を trips に、lat/lng/place_id を schedules に追加"
```

---

### Task 2: 共有スキーマ・型定義を更新

**Files:**
- Modify: `packages/shared/src/schemas/schedule.ts` — 入力スキーマに lat/lng/placeId を追加
- Modify: `packages/shared/src/types.ts` — レスポンス型 `TripResponse` / `ScheduleResponse` を更新

> **注意**: レスポンス型は Zod スキーマではなく `packages/shared/src/types.ts` の TypeScript 型で定義されている。`tripSchema` は存在しない。

**Step 1: schedule.ts の入力スキーマに lat/lng/placeId を追加**

`packages/shared/src/schemas/schedule.ts` の `createScheduleSchema` に追加:

```typescript
latitude: z.number().nullable().optional(),
longitude: z.number().nullable().optional(),
placeId: z.string().max(255).nullable().optional(),
```

`updateScheduleSchema` は `createScheduleSchema.partial().extend({...})` から派生しているため変更不要。

**Step 2: types.ts の `TripResponse` に mapsEnabled を追加**

`packages/shared/src/types.ts` の `TripResponse` 型に追加:

```typescript
export type TripResponse = {
  // ...既存フィールド...
  mapsEnabled: boolean;   // ← 追加
};
```

**Step 3: types.ts の `ScheduleResponse` に lat/lng/placeId を追加**

```typescript
export type ScheduleResponse = {
  // ...既存フィールド...
  latitude?: number | null;    // ← 追加
  longitude?: number | null;   // ← 追加
  placeId?: string | null;     // ← 追加
};
```

**Step 4: 型チェック**

```bash
bun run check-types
```

期待: エラーなし。

**Step 5: commit**

```bash
git add packages/shared/src/schemas/schedule.ts packages/shared/src/types.ts
git commit -m "feat: スキーマ・型定義に mapsEnabled / lat / lng / placeId を追加"
```

---

### Task 3: POST /api/trips — 管理者判定で mapsEnabled を自動設定

**Files:**
- Modify: `apps/api/src/routes/trips.ts`
- Test: `apps/api/src/routes/trips.test.ts`（存在しなければ新規作成）

**Step 1: テストを書く（Red）**

```typescript
// apps/api/src/routes/trips.test.ts
import { describe, it, expect, beforeEach } from "vitest"

describe("POST /api/trips - mapsEnabled", () => {
  it("管理者が作成するとmapsEnabled=trueになる", async () => {
    // 既存のテストヘルパーでログイン済みクライアントを作成
    // ADMIN_USERNAME に一致するユーザーで POST /api/trips を呼ぶ
    // response.mapsEnabled === true を確認
  })

  it("一般ユーザーが作成するとmapsEnabled=falseになる", async () => {
    // 非管理者ユーザーで POST /api/trips を呼ぶ
    // response.mapsEnabled === false を確認
  })
})
```

プロジェクトの既存テストファイル（`apps/api/src/routes/` 内）を参照してテストヘルパーのパターンを確認し、同じ形式でテストを記述する。

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/api test
```

期待: 新しいテストが FAIL。

**Step 3: ハンドラーに mapsEnabled ロジックを追加**

`apps/api/src/routes/trips.ts` の `POST /api/trips` ハンドラー（`createTripSchema.safeParse` の直後）に以下を追加:

```typescript
// 管理者判定: requireAdmin と同じロジックを用いる
// Better Auth のセッションキャッシュには username が含まれない場合があるため
// DB から username を取得する
let username = user.username ?? null;
if (!username) {
  const row = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  username = row[0]?.username ?? null;
}
const mapsEnabled = username === process.env.ADMIN_USERNAME && !!process.env.ADMIN_USERNAME;
```

`db.transaction` 内の `tx.insert(trips).values({...})` に `mapsEnabled` を追加:

```typescript
.values({
  ownerId: user.id,
  title,
  destination,
  startDate,
  endDate,
  coverImageUrl: coverImageUrl ?? null,
  coverImagePosition: coverImagePosition ?? 50,
  mapsEnabled,   // ← 追加
})
```

**Step 4: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/api test
```

期待: PASS。

**Step 5: GET /api/trips/:tripId のレスポンスに mapsEnabled が含まれることを確認**

`trips.ts` の GET ハンドラーを確認し、trip オブジェクトを返している箇所で `mapsEnabled` が自動的に含まれているか確認する。Drizzle で `trips.*` を返している場合は自動的に含まれる。フロントエンドの型定義（`TripResponse` 等）に `mapsEnabled: boolean` が含まれているか確認し、なければ追加する。

**Step 6: commit**

```bash
git add apps/api/src/routes/trips.ts apps/api/src/routes/trips.test.ts
git commit -m "feat: 旅行作成時に管理者なら mapsEnabled=true を自動設定"
```

---

### Task 4: GET /api/directions — Routes API プロキシ

**Files:**
- Create: `apps/api/src/routes/directions.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/routes/directions.test.ts`

**Step 1: テストを書く（Red）**

```typescript
// apps/api/src/routes/directions.test.ts
import { describe, it, expect, vi } from "vitest"

describe("GET /api/directions", () => {
  it("未認証なら401を返す", async () => {
    const res = await app.request("/api/directions?tripId=xxx&originLat=35&originLng=139&destLat=35.1&destLng=139.1")
    expect(res.status).toBe(401)
  })

  it("mapsEnabled=falseの旅行なら403を返す", async () => {
    // mapsEnabled=false な旅行に参加しているユーザーでリクエスト
    // expect(res.status).toBe(403)
  })

  it("旅行メンバーでないユーザーなら403を返す", async () => {
    // 旅行に参加していないユーザーでリクエスト
    // expect(res.status).toBe(403)
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/api test
```

**Step 3: directions.ts を作成**

```typescript
// apps/api/src/routes/directions.ts
import { Hono } from "hono"
import { requireAuth } from "../middleware/auth"
import { db } from "../db"
import { trips } from "../db/schema"
import { eq } from "drizzle-orm"
import { checkTripAccess } from "../lib/permissions"
import type { AppEnv } from "../types"

export const directionsRoutes = new Hono<AppEnv>()

directionsRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")
  const { tripId, originLat, originLng, destLat, destLng, originPlaceId, destPlaceId } =
    c.req.query()

  if (!tripId || !originLat || !originLng || !destLat || !destLng) {
    return c.json({ error: "Missing required query parameters" }, 400)
  }

  // 旅行への参加確認
  const role = await checkTripAccess(tripId, user.id)
  if (!role) {
    return c.json({ error: "Forbidden" }, 403)
  }

  // mapsEnabled チェック
  const [trip] = await db
    .select({ mapsEnabled: trips.mapsEnabled })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
  if (!trip?.mapsEnabled) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return c.json({ error: "Maps not configured" }, 503)
  }

  // Routes API 呼び出し
  const body = {
    origin: {
      location: {
        latLng: { latitude: Number(originLat), longitude: Number(originLng) },
      },
    },
    destination: {
      location: {
        latLng: { latitude: Number(destLat), longitude: Number(destLng) },
      },
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
  }

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return c.json({ error: "Routes API error" }, 502)
  }

  const data = (await res.json()) as {
    routes?: Array<{ duration?: string; polyline?: { encodedPolyline?: string } }>
  }
  const route = data.routes?.[0]
  if (!route) {
    return c.json({ error: "No route found" }, 404)
  }

  // duration は "924s" 形式で返るため数値に変換
  const durationSeconds = route.duration ? Number.parseInt(route.duration.replace("s", ""), 10) : 0

  return c.json({
    durationSeconds,
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
  })
})
```

**Step 4: app.ts にルートを登録**

```typescript
// apps/api/src/app.ts の import セクションに追加
import { directionsRoutes } from "./routes/directions"

// 既存のルート登録（app.route("/", announcementRoutes) など）の末尾に追加
app.route("/api/directions", directionsRoutes)
```

> **注意**: `apps/api/src/app.ts` は Hono の単一インスタンスにすべてのルートを登録している。
> `tripRoutes` などと同様のパターンで追加する。`export { app }` の前に登録すること。

**Step 5: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/api test
```

**Step 6: commit**

```bash
git add apps/api/src/routes/directions.ts apps/api/src/routes/directions.test.ts apps/api/src/app.ts
git commit -m "feat: /api/directions Routes API プロキシを追加"
```

---

### Task 5: @vis.gl/react-google-maps をインストールし APIProvider を設定

**Files:**
- Modify: `apps/web/package.json`（bun add で自動）
- Create: `apps/web/app/(authenticated)/trips/[id]/layout.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: パッケージをインストール**

```bash
bun add --filter @sugara/web @vis.gl/react-google-maps
```

期待: `apps/web/package.json` に `@vis.gl/react-google-maps` が追加される。

**Step 2: `trips/[id]/layout.tsx` を作成**

`apps/web/app/(authenticated)/trips/[id]/layout.tsx` は現在存在しないため新規作成する。
layout はサーバーコンポーネントのため、APIProvider はここではなく page.tsx（クライアントコンポーネント）に配置する。

```typescript
// apps/web/app/(authenticated)/trips/[id]/layout.tsx
export default function TripLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

**Step 3: page.tsx で mapsEnabled に応じて APIProvider を条件付きレンダリング**

`apps/web/app/(authenticated)/trips/[id]/page.tsx` は "use client" のクライアントコンポーネント。
`trip.mapsEnabled` が取得できている箇所（TripDetailContent などの内部）に以下のパターンで `APIProvider` をラップする:

```tsx
// page.tsx（クライアントコンポーネント内）
import { APIProvider } from "@vis.gl/react-google-maps"

// JSX 内で、mapsEnabled が true の場合のみ APIProvider でラップ
{trip.mapsEnabled && (
  <APIProvider
    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
    libraries={["places", "geometry"]}
  >
    {/* 地図・Autocomplete を使うコンポーネント群 */}
  </APIProvider>
)}
```

`libraries={["places", "geometry"]}` は Places Autocomplete と polyline デコード（`google.maps.geometry.encoding.decodePath`）に必要。

実際には page.tsx の構造が大きいため、APIProvider でラップする範囲は RightPanel と各スケジュールダイアログ（AddScheduleDialog, EditScheduleDialog）を含む JSX 全体にする必要がある。

**Step 4: 型チェック**

```bash
bun run check-types
```

期待: エラーなし。

**Step 5: commit**

```bash
git add apps/web/package.json apps/web/app/(authenticated)/trips/[id]/layout.tsx apps/web/app/(authenticated)/trips/[id]/page.tsx bun.lockb
git commit -m "feat: @vis.gl/react-google-maps をインストール、APIProvider を旅程ページに追加"
```

---

### Task 6: schedule-form-fields.tsx — Places Autocomplete を address フィールドに統合

**Files:**
- Modify: `apps/web/components/schedule-form-fields.tsx`
- Test: `apps/web/components/schedule-form-fields.test.tsx`（新規作成）

**Step 1: テストを書く（Red）**

```typescript
// apps/web/components/schedule-form-fields.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ScheduleFormFields } from "./schedule-form-fields"

// @vis.gl/react-google-maps をモック
vi.mock("@vis.gl/react-google-maps", () => ({
  useMapsLibrary: vi.fn(() => null),
}))

describe("ScheduleFormFields - address フィールド", () => {
  const baseProps = {
    category: "sightseeing" as const,
    onCategoryChange: vi.fn(),
    color: "blue" as const,
    onColorChange: vi.fn(),
    transportMethod: "" as const,
    onTransportMethodChange: vi.fn(),
    startTime: undefined,
    onStartTimeChange: vi.fn(),
    endTime: undefined,
    onEndTimeChange: vi.fn(),
    endDayOffset: 0,
    onEndDayOffsetChange: vi.fn(),
    maxEndDayOffset: 0,
    timeError: null,
    urls: [],
    onUrlsChange: vi.fn(),
  }

  it("mapsEnabled=false のとき通常の Input が表示される", () => {
    render(<ScheduleFormFields {...baseProps} mapsEnabled={false} />)
    const input = screen.getByRole("textbox", { name: /住所/ })
    expect(input.tagName).toBe("INPUT")
  })

  it("mapsEnabled=true のとき Places Autocomplete が表示される", () => {
    render(<ScheduleFormFields {...baseProps} mapsEnabled={true} />)
    // Autocomplete コンテナが存在する
    expect(screen.getByTestId("places-autocomplete")).toBeInTheDocument()
  })

  it("onLocationSelected が呼ばれると親に lat/lng が伝わる", async () => {
    const onLocationSelected = vi.fn()
    // Autocomplete の選択をシミュレートしてコールバックを検証
    // ...
    expect(onLocationSelected).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) })
    )
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/web test
```

**Step 3: ScheduleFormFieldsProps に mapsEnabled と onLocationSelected を追加**

```typescript
// apps/web/components/schedule-form-fields.tsx の Props 型に追加
type ScheduleFormFieldsProps = {
  // ...既存のフィールド...
  mapsEnabled?: boolean
  onLocationSelected?: (params: {
    address: string
    latitude: number
    longitude: number
    placeId: string
    name: string
  }) => void
}
```

**Step 4: address フィールドを条件分岐で実装**

```tsx
// schedule-form-fields.tsx の address フィールド部分を以下に差し替え
// (category !== "transport" の条件ブロック内)

{mapsEnabled ? (
  <div className="space-y-2" data-testid="places-autocomplete">
    <Label htmlFor={`${idPrefix}address`}>住所</Label>
    <PlacesAutocompleteInput
      id={`${idPrefix}address`}
      defaultValue={defaultValues?.address ?? ""}
      onPlaceSelect={({ formattedAddress, lat, lng, placeId, displayName }) => {
        onLocationSelected?.({
          address: formattedAddress,
          latitude: lat,
          longitude: lng,
          placeId,
          name: displayName,
        })
        setAddress(formattedAddress)
      }}
    />
  </div>
) : (
  <div className="space-y-2">
    <Label htmlFor={`${idPrefix}address`}>住所</Label>
    <Input
      id={`${idPrefix}address`}
      name="address"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      placeholder="京都市北区金閣寺町1"
      maxLength={SCHEDULE_ADDRESS_MAX_LENGTH}
    />
    <p className="text-right text-xs text-muted-foreground">
      {address.length}/{SCHEDULE_ADDRESS_MAX_LENGTH}
    </p>
  </div>
)}
```

**Step 5: PlacesAutocompleteInput コンポーネントを作成**

`useMapsLibrary("places")` で Legacy Places API の `Autocomplete` クラスを使う実装:

```tsx
// apps/web/components/places-autocomplete-input.tsx
"use client"

import { useEffect, useRef } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { Input } from "@/components/ui/input"

type PlaceSelectResult = {
  formattedAddress: string
  lat: number
  lng: number
  placeId: string
  displayName: string
}

type Props = {
  id?: string
  defaultValue?: string
  onPlaceSelect: (result: PlaceSelectResult) => void
}

export function PlacesAutocompleteInput({ id, defaultValue, onPlaceSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const placesLib = useMapsLibrary("places")

  useEffect(() => {
    if (!placesLib || !inputRef.current) return

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "place_id", "name"],
    })

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      onPlaceSelect({
        formattedAddress: place.formatted_address ?? "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id ?? "",
        displayName: place.name ?? "",
      })
    })

    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [placesLib, onPlaceSelect])

  return (
    <Input
      ref={inputRef}
      id={id}
      name="address"
      defaultValue={defaultValue}
      placeholder="場所を検索..."
    />
  )
}
```

> **注意**: `fields` の Legacy API の名称は `formatted_address`, `geometry`, `place_id`, `name`。
> `@vis.gl/react-google-maps` の `useMapsLibrary("places")` は `google.maps.places` ライブラリを返す。
> `onPlaceSelect` コールバックの型を独自に定義することで、Google Maps API の型に依存しない設計にする。

**Step 6: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/web test
```

**Step 7: commit**

```bash
git add apps/web/components/schedule-form-fields.tsx apps/web/components/places-autocomplete-input.tsx apps/web/components/schedule-form-fields.test.tsx
git commit -m "feat: schedule フォームに Places Autocomplete を統合"
```

---

### Task 7: add/edit-schedule-dialog — onLocationSelected を処理

**Files:**
- Modify: `apps/web/components/add-schedule-dialog.tsx`
- Modify: `apps/web/components/edit-schedule-dialog.tsx`

**Step 1: add-schedule-dialog.tsx を更新**

Props 型に `mapsEnabled` を追加:

```typescript
type AddScheduleDialogProps = {
  // ...既存...
  mapsEnabled?: boolean
}
```

state に lat/lng/placeId を追加:

```typescript
const [latitude, setLatitude] = useState<number | null>(null)
const [longitude, setLongitude] = useState<number | null>(null)
const [placeId, setPlaceId] = useState<string | null>(null)
```

`buildSchedulePayload` の呼び出し（または `data` オブジェクトの構築）に lat/lng/placeId を追加:

```typescript
const data = buildSchedulePayload(formData, {
  category,
  color,
  startTime,
  endTime,
  transportMethod,
  endDayOffset,
  urls,
  latitude,       // ← 追加
  longitude,      // ← 追加
  placeId,        // ← 追加
})
```

`ScheduleFormFields` に props を追加:

```tsx
<ScheduleFormFields
  // ...既存の props...
  mapsEnabled={mapsEnabled}
  onLocationSelected={({ address, latitude, longitude, placeId, name }) => {
    setLatitude(latitude)
    setLongitude(longitude)
    setPlaceId(placeId)
    // name フィールドが空の場合のみ上書き（フォームの name input を直接操作するのは避け、
    // defaultValues で制御するか、name フィールドが空かチェックして setName を呼ぶ）
  }}
/>
```

ダイアログを閉じる際のリセットに lat/lng/placeId を追加:

```typescript
setLatitude(null)
setLongitude(null)
setPlaceId(null)
```

**Step 2: edit-schedule-dialog.tsx を同様に更新**

`defaultValues` として既存の `latitude`, `longitude`, `placeId` を渡し、選択時に上書きする。

**Step 3: `buildSchedulePayload` が lat/lng/placeId を受け取れるか確認**

`apps/web/lib/schedule-utils.ts`（または相当するファイル）の `buildSchedulePayload` を確認し、`latitude`, `longitude`, `placeId` を payload に含めるよう更新する。

**Step 4: 型チェック**

```bash
bun run check-types
```

期待: エラーなし。

**Step 5: commit**

```bash
git add apps/web/components/add-schedule-dialog.tsx apps/web/components/edit-schedule-dialog.tsx
git commit -m "feat: add/edit ダイアログで Places 選択時の lat/lng を保存"
```

---

### Task 8: right-panel — mapsEnabled・allSchedules props と地図タブ構造

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel-tabs.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`（props 追加）

**Step 1: right-panel-tabs.tsx を更新**

`RightPanelTab` 型に `"map"` を追加:

```typescript
// right-panel-tabs.tsx
export type RightPanelTab = "candidates" | "activity" | "bookmarks" | "expenses" | "souvenirs" | "map"
```

`RightPanelTabs` コンポーネントの Props に `mapsEnabled` を追加し、map タブボタンを条件付きで追加:

```tsx
// RightPanelTabs の Props に追加
mapsEnabled?: boolean

// 既存のタブボタン群の末尾（または適切な位置）に追加
{mapsEnabled && (
  <button
    type="button"
    role="tab"
    aria-selected={current === "map"}
    onClick={() => onChange("map")}
    className={cn(CHIP_BASE, current === "map" ? CHIP_ACTIVE : CHIP_INACTIVE)}
  >
    地図
  </button>
)}
```

> **注意**: 現在のタブはアイコンなしのチップデザイン（テキストのみ）。設計書の「地図アイコン」は使わず、他タブと同じチップスタイルで統一する。

**Step 2: right-panel.tsx を更新**

Props 型に追加（`Schedule` 型は存在しない。`ScheduleResponse` を使う）:

```typescript
type RightPanelProps = {
  // ...既存...
  mapsEnabled: boolean
  allSchedules: ScheduleResponse[]   // trip 全スポット（全日程分）
}
```

タブコンテンツのコンテナを地図タブ用に分岐:

```tsx
// 既存の共通コンテナ（overflow-y-auto p-4）を以下に差し替え
{rightPanelTab === "map" ? (
  <div className="min-h-0 flex-1 overflow-hidden">
    <MapPanel
      currentDaySchedules={currentDaySchedules}
      allSchedules={allSchedules}
      online={online}
    />
  </div>
) : (
  <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
    {/* 既存のタブコンテンツ */}
  </div>
)}
```

**Step 3: page.tsx から RightPanel に props を渡す**

`page.tsx` で `trip.mapsEnabled` と `allSchedules`（全日程のスケジュールを集約）を RightPanel に渡す。
`trip.days` は `DayResponse[]` で `day.patterns[].schedules` が `ScheduleResponse[]`:

```tsx
<RightPanel
  // ...既存の props...
  mapsEnabled={trip.mapsEnabled}
  allSchedules={trip.days.flatMap(day =>
    day.patterns.flatMap(pattern => pattern.schedules)
  )}
/>
```

また `RightPanelTabs` へ `mapsEnabled` を渡す処理も right-panel.tsx 内で追加する。

**Step 4: 型チェック**

```bash
bun run check-types
```

**Step 5: commit**

```bash
git add apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx apps/web/app/(authenticated)/trips/[id]/_components/right-panel-tabs.tsx apps/web/app/(authenticated)/trips/[id]/page.tsx
git commit -m "feat: right-panel に地図タブと mapsEnabled 制御を追加"
```

---

### Task 9: MapPanel コンポーネントを作成

**Files:**
- Create: `apps/web/app/(authenticated)/trips/[id]/_components/map-panel.tsx`
- Test: `apps/web/app/(authenticated)/trips/[id]/_components/map-panel.test.tsx`

**Step 1: テストを書く（Red）**

```typescript
// map-panel.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MapPanel } from "./map-panel"

vi.mock("@vis.gl/react-google-maps", () => ({
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="google-map">{children}</div>,
  AdvancedMarker: () => <div data-testid="marker" />,
  InfoWindow: () => <div data-testid="info-window" />,
  useMap: vi.fn(() => null),
}))

const mockScheduleWithCoords = {
  id: "1", name: "spot A", latitude: 35.6762, longitude: 139.6503,
  category: "sightseeing", color: "blue", endDayOffset: null,
  // ...他の必須フィールド
}
const mockScheduleWithoutCoords = {
  id: "2", name: "spot B", latitude: null, longitude: null,
  category: "sightseeing", color: "blue", endDayOffset: null,
}

describe("MapPanel", () => {
  it("lat/lng があるスポットにのみマーカーを表示する", () => {
    render(
      <MapPanel
        currentDaySchedules={[mockScheduleWithCoords, mockScheduleWithoutCoords]}
        allSchedules={[mockScheduleWithCoords, mockScheduleWithoutCoords]}
        online={true}
      />
    )
    expect(screen.getAllByTestId("marker")).toHaveLength(1)
  })

  it("オフライン時はエラーメッセージを表示する", () => {
    render(
      <MapPanel
        currentDaySchedules={[]}
        allSchedules={[]}
        online={false}
      />
    )
    expect(screen.getByText(/オフライン/)).toBeInTheDocument()
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/web test
```

**Step 3: map-panel.tsx を作成**

`Schedule` 型は存在しない。`ScheduleResponse` を使う。

```tsx
// apps/web/app/(authenticated)/trips/[id]/_components/map-panel.tsx
"use client"

import { useState } from "react"
import { Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps"
import type { ScheduleResponse } from "@sugara/shared"

// 日別色パレット（10色、日数超過時は循環）
const DAY_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
]

type MapMode = "day" | "all"

type Props = {
  currentDaySchedules: ScheduleResponse[]
  allSchedules: ScheduleResponse[]
  online: boolean
}

export function MapPanel({ currentDaySchedules, allSchedules, online }: Props) {
  const [mode, setMode] = useState<MapMode>("day")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!online) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        オフライン時は地図を表示できません
      </div>
    )
  }

  const schedules = mode === "day" ? currentDaySchedules : allSchedules
  const mappableSchedules = schedules.filter(
    (s) => s.latitude != null && s.longitude != null
  )

  // 中心座標: ピンがある場合はその重心、なければ日本中心
  const center = mappableSchedules.length > 0
    ? {
        lat: mappableSchedules.reduce((sum, s) => sum + s.latitude!, 0) / mappableSchedules.length,
        lng: mappableSchedules.reduce((sum, s) => sum + s.longitude!, 0) / mappableSchedules.length,
      }
    : { lat: 36.2048, lng: 138.2529 }

  return (
    <div className="flex h-full flex-col">
      {/* 表示切替タブ */}
      <div className="flex shrink-0 border-b">
        <button
          className={`flex-1 px-4 py-2 text-sm ${mode === "day" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          onClick={() => setMode("day")}
        >
          当日
        </button>
        <button
          className={`flex-1 px-4 py-2 text-sm ${mode === "all" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          onClick={() => setMode("all")}
        >
          全期間
        </button>
      </div>

      {/* 地図 */}
      <div className="flex-1">
        <Map
          defaultCenter={center}
          defaultZoom={13}
          mapId="sugara-trip-map"
          className="h-full w-full"
        >
          {mappableSchedules.map((schedule, index) => {
            const color = mode === "all"
              ? DAY_COLORS[index % DAY_COLORS.length]
              : "#3b82f6"
            return (
              <AdvancedMarker
                key={schedule.id}
                position={{ lat: schedule.latitude!, lng: schedule.longitude! }}
                onClick={() => setSelectedId(schedule.id === selectedId ? null : schedule.id)}
              >
                <div
                  className="h-3 w-3 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: color }}
                />
              </AdvancedMarker>
            )
          })}

          {selectedId && (() => {
            const s = mappableSchedules.find((s) => s.id === selectedId)
            if (!s) return null
            return (
              <InfoWindow
                position={{ lat: s.latitude!, lng: s.longitude! }}
                onCloseClick={() => setSelectedId(null)}
              >
                <p className="text-sm font-medium">{s.name}</p>
              </InfoWindow>
            )
          })()}
        </Map>
      </div>
    </div>
  )
}
```

当日モードのルートポリライン（`mode === "day"`）は後続の Task 10 で directions キャッシュと連動させる。

**Step 4: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/web test
```

**Step 5: commit**

```bash
git add apps/web/app/(authenticated)/trips/[id]/_components/map-panel.tsx apps/web/app/(authenticated)/trips/[id]/_components/map-panel.test.tsx
git commit -m "feat: MapPanel コンポーネントを作成（ピン表示・当日/全期間切り替え）"
```

---

### Task 10: TravelTimeSeparator + day-timeline への統合

**Files:**
- Create: `apps/web/components/travel-time-separator.tsx`
- Test: `apps/web/components/travel-time-separator.test.tsx`
- Modify: `apps/web/components/day-timeline.tsx`

> **注意**: `day-timeline.tsx` の実際のパスは `apps/web/components/day-timeline.tsx`。
> 設計書に記載されていた `_components/` パスは誤り。

**Step 1: テストを書く（Red）**

```typescript
// apps/web/components/travel-time-separator.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TravelTimeSeparator } from "./travel-time-separator"

// api をモック
vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue({ durationSeconds: 900, encodedPolyline: null }),
}))

describe("TravelTimeSeparator", () => {
  const baseProps = {
    tripId: "trip-1",
    originLat: 35.6762,
    originLng: 139.6503,
    originPlaceId: "place-a",
    destLat: 35.7148,
    destLng: 139.7967,
    destPlaceId: "place-b",
  }

  it("所要時間を「車で 15分」形式で表示する", async () => {
    render(<TravelTimeSeparator {...baseProps} />)
    // 900秒 = 15分
    expect(await screen.findByText(/15分/)).toBeInTheDocument()
    expect(screen.getByText(/車で/)).toBeInTheDocument()
  })

  it("API エラー時は何も表示しない", async () => {
    vi.mocked(api).mockRejectedValueOnce(new Error("network error"))
    const { container } = render(<TravelTimeSeparator {...baseProps} />)
    await new Promise((r) => setTimeout(r, 50))
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/web test
```

**Step 3: TravelTimeSeparator を作成**

```tsx
// apps/web/components/travel-time-separator.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

type Props = {
  tripId: string
  originLat: number
  originLng: number
  originPlaceId?: string | null
  destLat: number
  destLng: number
  destPlaceId?: string | null
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem > 0 ? `${hours}時間${rem}分` : `${hours}時間`
}

export function TravelTimeSeparator({
  tripId,
  originLat,
  originLng,
  originPlaceId,
  destLat,
  destLng,
  destPlaceId,
}: Props) {
  // placeId がある場合はより安定したキー、ない場合は座標
  const queryKey = originPlaceId && destPlaceId
    ? ["directions", originPlaceId, destPlaceId, "DRIVING"]
    : ["directions", originLat, originLng, destLat, destLng, "DRIVING"]

  const params = new URLSearchParams({
    tripId,
    originLat: String(originLat),
    originLng: String(originLng),
    destLat: String(destLat),
    destLng: String(destLng),
    ...(originPlaceId ? { originPlaceId } : {}),
    ...(destPlaceId ? { destPlaceId } : {}),
  })

  const { data } = useQuery({
    queryKey,
    queryFn: () => api<{ durationSeconds: number; encodedPolyline: string | null }>(
      `/api/directions?${params}`
    ),
    staleTime: 5 * 60 * 1000, // 5 分
    retry: false,              // エラー時はリトライしない（API コスト節約）
  })

  if (!data) return null

  return (
    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span>車で {formatDuration(data.durationSeconds)}</span>
      <span>→</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
```

**Step 4: day-timeline.tsx に TravelTimeSeparator を挿入**

`apps/web/app/(authenticated)/trips/[id]/_components/day-timeline.tsx` でスケジュールリストをレンダリングしている箇所を確認し、連続するスケジュールのペア間に以下を挿入:

```tsx
{schedules.map((schedule, index) => {
  const next = schedules[index + 1]
  const showSeparator =
    mapsEnabled &&
    next != null &&
    schedule.category !== "transport" &&
    next.category !== "transport" &&
    schedule.latitude != null &&
    schedule.longitude != null &&
    next.latitude != null &&
    next.longitude != null &&
    schedule.startTime != null &&
    schedule.endTime != null &&
    next.startTime != null &&
    (schedule.endDayOffset == null || schedule.endDayOffset === 0)

  return (
    <Fragment key={schedule.id}>
      <ScheduleItem schedule={schedule} ... />
      {showSeparator && (
        <TravelTimeSeparator
          tripId={tripId}
          originLat={schedule.latitude!}
          originLng={schedule.longitude!}
          originPlaceId={schedule.placeId}
          destLat={next.latitude!}
          destLng={next.longitude!}
          destPlaceId={next.placeId}
        />
      )}
    </Fragment>
  )
})}
```

`day-timeline.tsx` の Props 型に `mapsEnabled: boolean` を追加し、`page.tsx` から渡す。

**Step 5: MapPanel にルートポリラインを追加（directions キャッシュを再利用）**

`map-panel.tsx` の当日モードで、同じ React Query キャッシュから directions データを読み取り、`Polyline` を描画する（`@vis.gl/react-google-maps` の `Polyline` コンポーネントを使用）。キャッシュキーが TravelTimeSeparator と同一であれば追加 API コールは不要。

**Step 6: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/web test
```

**Step 7: commit**

```bash
git add apps/web/components/travel-time-separator.tsx apps/web/components/travel-time-separator.test.tsx apps/web/components/day-timeline.tsx
git commit -m "feat: タイムラインにスポット間の所要時間セパレータを追加"
```

---

### Task 11: キーボードショートカット `g m` を追加

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: 既存のキーボードショートカット登録パターンを確認**

`page.tsx` 内の `g c`（候補パネル）などのショートカットが登録されている箇所を探す。

**Step 2: `g m` を追加**

`mapsEnabled` が true の場合のみ `g m` → 地図タブ切り替えを登録:

```typescript
// 既存の g c, g x などと同じパターンで
if (mapsEnabled) {
  // g m → 地図タブ
  registerShortcut("g", "m", () => setRightPanelTab("map"))
}
```

**Step 3: commit**

```bash
git add apps/web/app/(authenticated)/trips/[id]/page.tsx
git commit -m "feat: キーボードショートカット g m で地図タブを開く"
```

---

### Task 12: 全体テストと FAQ 更新

**Step 1: 全テストを実行**

```bash
bun run test
```

期待: すべて PASS。

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: lint**

```bash
bun run check
```

**Step 4: FAQ シードを更新**

`apps/api/src/db/seed-faqs.ts` に以下のエントリを追加:

```typescript
{
  question: "地図タブが表示されません",
  answer: "地図機能は管理者が作成した旅行でのみ利用できます。管理者に旅行の作成を依頼してください。",
  category: "trip",
},
{
  question: "地図にスポットが表示されません",
  answer: "スポット追加時に住所フィールドで候補から場所を選択すると、地図にピンが表示されます。住所を手入力した場合はピンが表示されません。",
  category: "schedule",
},
{
  question: "タイムラインに移動時間が表示されません",
  answer: "移動時間は、住所候補から選択した（地図ピンがある）スポットが連続して 2 つ以上あり、かつ両方に開始・終了時刻が設定されている場合に表示されます。また、transport カテゴリのスポットの前後には表示されません。",
  category: "schedule",
},
{
  question: "地図タブの使い方を教えてください",
  answer: "旅程ページ右側のパネルで「地図」タブを選択すると地図が開きます。「当日」ボタンで選択中の日のスポットのみ、「全期間」ボタンで旅行全体のスポットを表示できます。キーボードショートカット g→m でも地図タブを開けます。",
  category: "trip",
},
```

**Step 5: FAQ をローカル DB に反映**

```bash
bun run --filter @sugara/api db:seed-faqs
```

**Step 6: 最終コミット**

```bash
git add apps/api/src/db/seed-faqs.ts
git commit -m "feat: Google Maps 機能の FAQ を追加"
```

---

## 動作確認チェックリスト

実装完了後、以下を手動で確認する:

- [ ] 管理者アカウントで旅行を作成 → `mapsEnabled = true` になること（DB で確認）
- [ ] 一般ユーザーで旅行を作成 → `mapsEnabled = false`、地図タブが表示されないこと
- [ ] 管理者旅行でスポット追加時、住所フィールドで Places Autocomplete が動作すること
- [ ] 候補から場所を選ぶと name・address が自動入力されること
- [ ] 地図タブを開くとスポットのピンが表示されること
- [ ] 「全期間」モードで全スポットが日別色分けで表示されること
- [ ] ピンをクリックすると InfoWindow でスポット名が表示されること
- [ ] lat/lng のないスポット（手入力）はピンが出ないこと
- [ ] タイムラインで条件を満たすスポット間に「車で XX分」が表示されること
- [ ] オフライン時に地図タブで「オフライン時は地図を表示できません」が表示されること
- [ ] `g m` ショートカットで地図タブが開くこと
