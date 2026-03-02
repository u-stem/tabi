# Trip Day Weather Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to manually record weather type (including "のち" transitions), high/low temperature for each trip day, displayed compactly in day tabs.

**Architecture:** Add `weather_type` enum + 4 new nullable columns to `trip_days`. Extend shared schema + `DayResponse` type. Extend PATCH API. Add `DayWeatherEditor` component and `useDayWeather` hook following the existing `DayMemoEditor`/`useDayMemo` pattern. Render in both desktop and SP trip pages above the memo editor.

**Tech Stack:** Drizzle ORM (PostgreSQL), Hono, React 19, Zod, Vitest, Tailwind CSS v4, shadcn/ui

---

## Current state

- `tripDays` has: `id`, `tripId`, `date`, `dayNumber`, `memo`
- `updateTripDaySchema` in `packages/shared/src/schemas/trip-day.ts` has only `memo`
- `DayResponse` type in `packages/shared/src/types.ts` has: `id`, `dayNumber`, `date`, `memo`, `patterns`
- PATCH `/api/trips/:tripId/days/:dayId` updates only `memo`
- `DayMemoEditor` + `useDayMemo` at `apps/web/app/(authenticated)/trips/[id]/_components/day-memo-editor.tsx` and `apps/web/lib/hooks/use-day-memo.ts`

---

## Task 1: Add weather constants and schema to packages/shared

**Files:**
- Modify: `packages/shared/src/schemas/trip-day.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/messages.ts`

**Step 1: Update `packages/shared/src/schemas/trip-day.ts`**

Replace the entire file content with:

```typescript
import { z } from "zod";

export const DAY_MEMO_MAX_LENGTH = 500;

export const WEATHER_TYPES = [
  "sunny",
  "partly_cloudy",
  "cloudy",
  "mostly_cloudy",
  "light_rain",
  "rainy",
  "heavy_rain",
  "thunder",
  "snowy",
  "sleet",
  "foggy",
] as const;

export type WeatherType = (typeof WEATHER_TYPES)[number];

export const WEATHER_EMOJI: Record<WeatherType, string> = {
  sunny: "☀️",
  partly_cloudy: "🌤️",
  cloudy: "☁️",
  mostly_cloudy: "🌥️",
  light_rain: "🌦️",
  rainy: "🌧️",
  heavy_rain: "⛈️",
  thunder: "⛈️",
  snowy: "❄️",
  sleet: "🌨️",
  foggy: "🌫️",
};

export const WEATHER_LABELS: Record<WeatherType, string> = {
  sunny: "晴れ",
  partly_cloudy: "晴れ時々曇り",
  cloudy: "曇り",
  mostly_cloudy: "曇り時々晴れ",
  light_rain: "小雨",
  rainy: "雨",
  heavy_rain: "大雨",
  thunder: "雷雨",
  snowy: "雪",
  sleet: "みぞれ",
  foggy: "霧",
};

export const updateTripDaySchema = z.object({
  memo: z.string().max(DAY_MEMO_MAX_LENGTH).nullable(),
  weatherType: z.enum(WEATHER_TYPES).nullable().optional(),
  weatherTypeSecondary: z.enum(WEATHER_TYPES).nullable().optional(),
  tempHigh: z.number().int().min(-50).max(60).nullable().optional(),
  tempLow: z.number().int().min(-50).max(60).nullable().optional(),
});
```

**Step 2: Extend `DayResponse` in `packages/shared/src/types.ts`**

Find:
```typescript
export type DayResponse = {
  id: string;
  dayNumber: number;
  date: string;
  memo?: string | null;
  patterns: DayPatternResponse[];
};
```

Replace with:
```typescript
export type DayResponse = {
  id: string;
  dayNumber: number;
  date: string;
  memo?: string | null;
  weatherType?: WeatherType | null;
  weatherTypeSecondary?: WeatherType | null;
  tempHigh?: number | null;
  tempLow?: number | null;
  patterns: DayPatternResponse[];
};
```

Also add the import at the top of `types.ts` (after existing imports):
```typescript
import type { WeatherType } from "./schemas/trip-day";
```

**Step 3: Add messages to `packages/shared/src/messages.ts`**

After the `// Day memo` section (around line 250-252), add:

```typescript
  // Day weather
  DAY_WEATHER_UPDATED: "天気を更新しました",
  DAY_WEATHER_UPDATE_FAILED: "天気の更新に失敗しました",
```

**Step 4: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/trip-day.ts packages/shared/src/types.ts packages/shared/src/messages.ts
git commit -m "feat: trip day 天気・気温フィールドを shared スキーマと型に追加"
```

---

## Task 2: DB schema + migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Add `weatherTypeEnum` pgEnum to `apps/api/src/db/schema.ts`**

After the existing `souvenirPriorityEnum` definition (around line 72), insert:

```typescript
export const weatherTypeEnum = pgEnum("weather_type", [
  "sunny",
  "partly_cloudy",
  "cloudy",
  "mostly_cloudy",
  "light_rain",
  "rainy",
  "heavy_rain",
  "thunder",
  "snowy",
  "sleet",
  "foggy",
]);
```

**Step 2: Add columns to `tripDays` table**

In the `tripDays` table definition, after the `memo: text("memo")` line, add:

```typescript
    weatherType: weatherTypeEnum("weather_type"),
    weatherTypeSecondary: weatherTypeEnum("weather_type_secondary"),
    tempHigh: smallint("temp_high"),
    tempLow: smallint("temp_low"),
```

**Step 3: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 4: Generate migration**

```bash
bun run db:generate
```

Expected: a new migration file appears in `apps/api/src/db/migrations/`.

**Step 5: Apply migration locally**

```bash
bun run db:migrate
```

Expected: "Migrations applied successfully" or similar.

**Step 6: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrations/
git commit -m "feat: trip_days テーブルに天気・気温カラムを追加"
```

---

## Task 3: Extend PATCH API route + tests (TDD)

**Files:**
- Modify: `apps/api/src/routes/trip-days.ts`
- Modify: `apps/api/src/__tests__/trip-days.test.ts`

**Step 1: Write failing tests in `apps/api/src/__tests__/trip-days.test.ts`**

Add these tests after the existing `"returns 400 for memo exceeding max length"` test (inside the `describe("PATCH ...")` block):

```typescript
    it("updates weather type successfully", async () => {
      const existing = {
        id: dayId,
        tripId,
        date: "2025-01-01",
        dayNumber: 1,
        memo: null,
        weatherType: null,
        weatherTypeSecondary: null,
        tempHigh: null,
        tempLow: null,
      };
      mockDbQuery.tripDays.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, weatherType: "sunny" };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(tripDayRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: null, weatherType: "sunny" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.weatherType).toBe("sunny");
    });

    it("updates secondary weather type for 'nochi' pattern", async () => {
      const existing = {
        id: dayId,
        tripId,
        date: "2025-01-01",
        dayNumber: 1,
        memo: null,
        weatherType: "sunny",
        weatherTypeSecondary: null,
        tempHigh: null,
        tempLow: null,
      };
      mockDbQuery.tripDays.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, weatherTypeSecondary: "cloudy" };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(tripDayRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: null, weatherType: "sunny", weatherTypeSecondary: "cloudy" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.weatherTypeSecondary).toBe("cloudy");
    });

    it("clears weather with null", async () => {
      const existing = {
        id: dayId,
        tripId,
        date: "2025-01-01",
        dayNumber: 1,
        memo: null,
        weatherType: "sunny",
        weatherTypeSecondary: "cloudy",
        tempHigh: 25,
        tempLow: 15,
      };
      mockDbQuery.tripDays.findFirst.mockResolvedValue(existing);
      const updated = {
        ...existing,
        weatherType: null,
        weatherTypeSecondary: null,
        tempHigh: null,
        tempLow: null,
      };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(tripDayRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memo: null,
          weatherType: null,
          weatherTypeSecondary: null,
          tempHigh: null,
          tempLow: null,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.weatherType).toBeNull();
    });

    it("updates temperatures successfully", async () => {
      const existing = {
        id: dayId,
        tripId,
        date: "2025-01-01",
        dayNumber: 1,
        memo: null,
        weatherType: "sunny",
        weatherTypeSecondary: null,
        tempHigh: null,
        tempLow: null,
      };
      mockDbQuery.tripDays.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, tempHigh: 30, tempLow: 20 };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(tripDayRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: null, weatherType: "sunny", tempHigh: 30, tempLow: 20 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tempHigh).toBe(30);
      expect(body.tempLow).toBe(20);
    });

    it("returns 400 for invalid weather type", async () => {
      const app = createTestApp(tripDayRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: null, weatherType: "hurricane" }),
      });

      expect(res.status).toBe(400);
    });
```

Also update the `beforeEach` mock to include weather fields:
```typescript
    mockDbQuery.tripDays.findFirst.mockResolvedValue({
      id: dayId,
      tripId,
      date: "2025-01-01",
      dayNumber: 1,
      memo: null,
      weatherType: null,
      weatherTypeSecondary: null,
      tempHigh: null,
      tempLow: null,
    });
```

**Step 2: Run tests to verify they fail**

```bash
bun run --filter @sugara/api test
```

Expected: new tests FAIL (weather fields not yet handled in route).

**Step 3: Update PATCH handler in `apps/api/src/routes/trip-days.ts`**

Replace the current `set({ memo: parsed.data.memo })` call and the activity log with:

```typescript
  const [updated] = await db
    .update(tripDays)
    .set({
      memo: parsed.data.memo,
      ...(parsed.data.weatherType !== undefined && { weatherType: parsed.data.weatherType }),
      ...(parsed.data.weatherTypeSecondary !== undefined && {
        weatherTypeSecondary: parsed.data.weatherTypeSecondary,
      }),
      ...(parsed.data.tempHigh !== undefined && { tempHigh: parsed.data.tempHigh }),
      ...(parsed.data.tempLow !== undefined && { tempLow: parsed.data.tempLow }),
    })
    .where(eq(tripDays.id, dayId))
    .returning();

  const isWeatherChange =
    parsed.data.weatherType !== undefined ||
    parsed.data.weatherTypeSecondary !== undefined ||
    parsed.data.tempHigh !== undefined ||
    parsed.data.tempLow !== undefined;
  const isMemoChange = parsed.data.memo !== undefined;

  if (isWeatherChange) {
    logActivity({
      tripId,
      userId: user.id,
      action: "updated",
      entityType: "day_weather",
      detail: `${existing.dayNumber}日目`,
    });
  } else if (isMemoChange) {
    logActivity({
      tripId,
      userId: user.id,
      action: "updated",
      entityType: "day_memo",
      detail: `${existing.dayNumber}日目`,
    });
  }
```

Note: The existing code logs only `day_memo`. The new code logs `day_weather` when weather fields are changed.

Actually, keep it simpler — always log when changes are made, using existing detection:

```typescript
  const [updated] = await db
    .update(tripDays)
    .set({
      memo: parsed.data.memo,
      ...(parsed.data.weatherType !== undefined && { weatherType: parsed.data.weatherType }),
      ...(parsed.data.weatherTypeSecondary !== undefined && {
        weatherTypeSecondary: parsed.data.weatherTypeSecondary,
      }),
      ...(parsed.data.tempHigh !== undefined && { tempHigh: parsed.data.tempHigh }),
      ...(parsed.data.tempLow !== undefined && { tempLow: parsed.data.tempLow }),
    })
    .where(eq(tripDays.id, dayId))
    .returning();

  logActivity({
    tripId,
    userId: user.id,
    action: "updated",
    entityType: "day_weather",
    detail: `${existing.dayNumber}日目`,
  });
```

**Step 4: Run tests to verify they pass**

```bash
bun run --filter @sugara/api test
```

Expected: all tests PASS.

**Step 5: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/api/src/routes/trip-days.ts apps/api/src/__tests__/trip-days.test.ts
git commit -m "feat: PATCH trip-days API を天気・気温フィールドに対応"
```

---

## Task 4: useDayWeather hook

**Files:**
- Create: `apps/web/lib/hooks/use-day-weather.ts`

**Step 1: Create `apps/web/lib/hooks/use-day-weather.ts`**

```typescript
import type { TripResponse, WeatherType } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type WeatherState = {
  weatherType: WeatherType | null;
  weatherTypeSecondary: WeatherType | null;
  tempHigh: number | null;
  tempLow: number | null;
};

type UseDayWeatherArgs = {
  tripId: string;
  currentDayId: string | null;
  onDone: () => void;
};

export function useDayWeather({ tripId, currentDayId, onDone }: UseDayWeatherArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherState>({
    weatherType: null,
    weatherTypeSecondary: null,
    tempHigh: null,
    tempLow: null,
  });
  const [saving, setSaving] = useState(false);

  function startEdit(dayId: string, current: Partial<WeatherState>) {
    setEditingDayId(dayId);
    setWeather({
      weatherType: current.weatherType ?? null,
      weatherTypeSecondary: current.weatherTypeSecondary ?? null,
      tempHigh: current.tempHigh ?? null,
      tempLow: current.tempLow ?? null,
    });
  }

  function cancelEdit() {
    setEditingDayId(null);
    setWeather({ weatherType: null, weatherTypeSecondary: null, tempHigh: null, tempLow: null });
  }

  async function save() {
    if (!currentDayId || editingDayId !== currentDayId) return;
    setSaving(true);
    const dayId = currentDayId;
    const next = { ...weather };

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, {
        ...prev,
        days: prev.days.map((d) => (d.id !== dayId ? d : { ...d, ...next })),
      });
    }
    toast.success(MSG.DAY_WEATHER_UPDATED);
    setEditingDayId(null);
    setWeather({ weatherType: null, weatherTypeSecondary: null, tempHigh: null, tempLow: null });

    try {
      await api(`/api/trips/${tripId}/days/${dayId}`, {
        method: "PATCH",
        body: JSON.stringify({
          memo: prev?.days.find((d) => d.id === dayId)?.memo ?? null,
          weatherType: next.weatherType,
          weatherTypeSecondary: next.weatherTypeSecondary,
          tempHigh: next.tempHigh,
          tempLow: next.tempLow,
        }),
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.DAY_WEATHER_UPDATE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  return {
    editingDayId,
    weather,
    setWeather,
    saving,
    startEdit,
    cancelEdit,
    save,
  };
}
```

**Step 2: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/lib/hooks/use-day-weather.ts
git commit -m "feat: useDayWeather フックを追加"
```

---

## Task 5: DayWeatherEditor component

**Files:**
- Create: `apps/web/components/day-weather-editor.tsx`

**Step 1: Create `apps/web/components/day-weather-editor.tsx`**

```typescript
"use client";

import { WEATHER_EMOJI, WEATHER_LABELS, WEATHER_TYPES, type WeatherType } from "@sugara/shared";
import { Check, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useDayWeather } from "@/lib/hooks/use-day-weather";
import { cn } from "@/lib/utils";

type Weather = ReturnType<typeof useDayWeather>;

type DayWeatherEditorProps = {
  weatherHook: Weather;
  currentDayId: string;
  currentWeatherType?: WeatherType | null;
  currentWeatherTypeSecondary?: WeatherType | null;
  currentTempHigh?: number | null;
  currentTempLow?: number | null;
  canEdit: boolean;
  online: boolean;
};

export function DayWeatherEditor({
  weatherHook,
  currentDayId,
  currentWeatherType,
  currentWeatherTypeSecondary,
  currentTempHigh,
  currentTempLow,
  canEdit,
  online,
}: DayWeatherEditorProps) {
  const isEditing = weatherHook.editingDayId === currentDayId;
  const hasWeather = currentWeatherType != null;

  return (
    <div className="mb-3">
      {isEditing ? (
        <div className="space-y-3 rounded-md border border-border px-3 py-2">
          {/* Primary weather picker */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">天気</p>
            <div className="flex flex-wrap gap-1">
              {WEATHER_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  title={WEATHER_LABELS[type]}
                  onClick={() =>
                    weatherHook.setWeather((prev) => ({
                      ...prev,
                      weatherType: prev.weatherType === type ? null : type,
                      // Clear secondary if primary is cleared
                      weatherTypeSecondary:
                        prev.weatherType === type ? null : prev.weatherTypeSecondary,
                    }))
                  }
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-base transition-colors",
                    weatherHook.weather.weatherType === type
                      ? "bg-primary/20 ring-1 ring-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {WEATHER_EMOJI[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary weather picker (for "のち" pattern) */}
          {weatherHook.weather.weatherType != null && (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                のち（省略可）
              </p>
              <div className="flex flex-wrap gap-1">
                {WEATHER_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    title={WEATHER_LABELS[type]}
                    onClick={() =>
                      weatherHook.setWeather((prev) => ({
                        ...prev,
                        weatherTypeSecondary: prev.weatherTypeSecondary === type ? null : type,
                      }))
                    }
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-base transition-colors",
                      weatherHook.weather.weatherTypeSecondary === type
                        ? "bg-primary/20 ring-1 ring-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {WEATHER_EMOJI[type]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Temperature inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">最高</span>
              <Input
                type="number"
                min={-50}
                max={60}
                value={weatherHook.weather.tempHigh ?? ""}
                onChange={(e) =>
                  weatherHook.setWeather((prev) => ({
                    ...prev,
                    tempHigh: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="--"
                className="h-7 w-16 text-center text-sm"
              />
              <span className="text-xs text-muted-foreground">°C</span>
            </div>
            <span className="text-xs text-muted-foreground">/</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">最低</span>
              <Input
                type="number"
                min={-50}
                max={60}
                value={weatherHook.weather.tempLow ?? ""}
                onChange={(e) =>
                  weatherHook.setWeather((prev) => ({
                    ...prev,
                    tempLow: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="--"
                className="h-7 w-16 text-center text-sm"
              />
              <span className="text-xs text-muted-foreground">°C</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={weatherHook.cancelEdit}
              disabled={weatherHook.saving}
            >
              キャンセル
            </Button>
            <Button size="sm" onClick={weatherHook.save} disabled={weatherHook.saving}>
              <Check className="h-3.5 w-3.5" />
              {weatherHook.saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            canEdit && online
              ? weatherHook.startEdit(currentDayId, {
                  weatherType: currentWeatherType,
                  weatherTypeSecondary: currentWeatherTypeSecondary,
                  tempHigh: currentTempHigh,
                  tempLow: currentTempLow,
                })
              : undefined
          }
          className={cn(
            "flex w-full select-none items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors",
            canEdit && online
              ? "cursor-pointer hover:border-border hover:bg-muted/50"
              : "cursor-default",
            hasWeather ? "border-border text-foreground" : "border-muted-foreground/20 text-muted-foreground",
          )}
        >
          <Cloud className="h-3.5 w-3.5 shrink-0" />
          {hasWeather ? (
            <span>
              {WEATHER_EMOJI[currentWeatherType]}
              {currentWeatherTypeSecondary != null
                ? `→${WEATHER_EMOJI[currentWeatherTypeSecondary]}`
                : ""}
              {(currentTempHigh != null || currentTempLow != null) && (
                <span className="ml-1 text-muted-foreground">
                  {currentTempHigh != null ? `${currentTempHigh}°` : "--"}
                  {" / "}
                  {currentTempLow != null ? `${currentTempLow}°` : "--"}
                </span>
              )}
            </span>
          ) : (
            "天気を追加"
          )}
        </button>
      )}
    </div>
  );
}
```

**Step 2: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 3: Lint**

```bash
bun run check
```

Expected: no errors (existing cookie warning is expected and unrelated).

**Step 4: Commit**

```bash
git add apps/web/components/day-weather-editor.tsx
git commit -m "feat: DayWeatherEditor コンポーネントを追加"
```

---

## Task 6: Update DayTabs to show weather info

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/day-tabs.tsx`

**Step 1: Update `day-tabs.tsx`**

Add the import at the top (after existing imports):

```typescript
import { WEATHER_EMOJI, type WeatherType } from "@sugara/shared";
```

In the `days.map()` section, replace the tab button content from:
```tsx
            {day.dayNumber}日目
```

to:
```tsx
            <span className="flex items-center gap-1">
              <span>{day.dayNumber}日目</span>
              {day.weatherType != null && (
                <span className="text-base leading-none">
                  {WEATHER_EMOJI[day.weatherType as WeatherType]}
                  {day.weatherTypeSecondary != null
                    ? `→${WEATHER_EMOJI[day.weatherTypeSecondary as WeatherType]}`
                    : ""}
                </span>
              )}
              {(day.tempHigh != null || day.tempLow != null) && (
                <span className="text-xs text-muted-foreground">
                  {day.tempHigh != null ? `${day.tempHigh}` : "-"}
                  /{day.tempLow != null ? `${day.tempLow}` : "-"}°
                </span>
              )}
            </span>
```

**Step 2: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 3: Commit**

```bash
git add "apps/web/app/(authenticated)/trips/[id]/_components/day-tabs.tsx"
git commit -m "feat: DayTabs に天気アイコンと気温を表示"
```

---

## Task 7: Wire up in trip pages

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Modify: `apps/web/app/(sp)/sp/trips/[id]/page.tsx`

### Step 1: Update desktop trip page

In `apps/web/app/(authenticated)/trips/[id]/page.tsx`:

**Add import** (after the existing `useDayMemo` import):
```typescript
import { useDayWeather } from "@/lib/hooks/use-day-weather";
import { DayWeatherEditor } from "@/components/day-weather-editor";
```

**Add hook call** (after the `memo = useDayMemo(...)` call around line 499):
```typescript
  const weather = useDayWeather({
    tripId,
    currentDayId: currentDay?.id ?? null,
    onDone: onMutate,
  });
```

**Add `DayWeatherEditor` in mobile panel** (before `<DayMemoEditor` in the mobile `tabpanel` div around line 686):
```tsx
                <DayWeatherEditor
                  weatherHook={weather}
                  currentDayId={currentDay.id}
                  currentWeatherType={currentDay.weatherType}
                  currentWeatherTypeSecondary={currentDay.weatherTypeSecondary}
                  currentTempHigh={currentDay.tempHigh}
                  currentTempLow={currentDay.tempLow}
                  canEdit={canEdit}
                  online={online}
                />
```

**Add `DayWeatherEditor` in desktop panel** (before `<DayMemoEditor` in the desktop `day-panel` div around line 923):
```tsx
                  <DayWeatherEditor
                    weatherHook={weather}
                    currentDayId={currentDay.id}
                    currentWeatherType={currentDay.weatherType}
                    currentWeatherTypeSecondary={currentDay.weatherTypeSecondary}
                    currentTempHigh={currentDay.tempHigh}
                    currentTempLow={currentDay.tempLow}
                    canEdit={canEdit}
                    online={online}
                  />
```

### Step 2: Update SP trip page

In `apps/web/app/(sp)/sp/trips/[id]/page.tsx`:

**Add import** (after the existing `useDayMemo` import):
```typescript
import { useDayWeather } from "@/lib/hooks/use-day-weather";
import { DayWeatherEditor } from "@/components/day-weather-editor";
```

**Add hook call** (after the `memo = useDayMemo(...)` call):
```typescript
  const weather = useDayWeather({
    tripId,
    currentDayId: currentDay?.id ?? null,
    onDone: onMutate,
  });
```

**Add `DayWeatherEditor`** in the day panel (before `<DayMemoEditor`):
```tsx
                <DayWeatherEditor
                  weatherHook={weather}
                  currentDayId={currentDay.id}
                  currentWeatherType={currentDay.weatherType}
                  currentWeatherTypeSecondary={currentDay.weatherTypeSecondary}
                  currentTempHigh={currentDay.tempHigh}
                  currentTempLow={currentDay.tempLow}
                  canEdit={canEdit}
                  online={online}
                />
```

**Step 3: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 4: Run lint**

```bash
bun run check
```

Expected: no errors.

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add "apps/web/app/(authenticated)/trips/[id]/page.tsx" apps/web/app/(sp)/sp/trips/[id]/page.tsx
git commit -m "feat: 旅行ページに DayWeatherEditor を組み込み"
```

---

## Task 8: Final verification

**Step 1: Run full test suite**

```bash
bun run test
```

Expected: all tests pass.

**Step 2: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 3: Run lint/format**

```bash
bun run check
```

Expected: no errors (existing cookie warning is unrelated).
