# Trip Day Weather Design

**Goal:** Allow users to manually record weather type and temperature (high/low) for each trip day.

---

## Requirements

- Weather type: enum of common Japanese weather conditions
- Max temperature: integer (°C), nullable
- Min temperature: integer (°C), nullable
- Manual input by users with editor role
- Display compactly in day tabs: `1日目 ☀️ 24/18°`
- Edit UI in the day panel (above memo editor), similar to the existing `DayMemoEditor` pattern

---

## Data Model

Add three columns to `trip_days`:

| Column | Type | Description |
|--------|------|-------------|
| `weather_type` | `weather_type` enum, nullable | Weather condition |
| `temp_high` | `smallint`, nullable | High temperature (°C) |
| `temp_low` | `smallint`, nullable | Low temperature (°C) |

### Weather enum values

```
sunny, partly_cloudy, cloudy, mostly_cloudy,
light_rain, rainy, heavy_rain, thunder,
snowy, sleet, foggy
```

Emoji and label mappings live in `packages/shared/src/schemas/trip-day.ts`.

---

## Architecture

### Shared (`packages/shared`)

**`src/schemas/trip-day.ts`** — add:
- `WEATHER_TYPES` constant array
- `WeatherType` type
- `WEATHER_LABELS: Record<WeatherType, string>` (Japanese labels)
- `WEATHER_EMOJI: Record<WeatherType, string>` (emoji)
- Extend `updateTripDaySchema` with `weatherType`, `tempHigh`, `tempLow`

**`src/types.ts`** — extend `DayResponse`:
```typescript
weatherType?: WeatherType | null;
tempHigh?: number | null;
tempLow?: number | null;
```

### API (`apps/api`)

**`src/db/schema.ts`** — add `weatherTypeEnum` pgEnum, add 3 columns to `tripDays`.

**Migration** — generated via `bun run db:generate`, applied via `bun run db:migrate`.

**`src/routes/trip-days.ts`** — extend PATCH handler to update `weatherType`, `tempHigh`, `tempLow`. Activity log entity: `day_weather`.

**`src/__tests__/trip-days.test.ts`** — add tests for:
- Updates weather type successfully
- Clears weather with null
- Updates temperatures
- Rejects invalid weather type (400)

### Frontend (`apps/web`)

**`packages/shared/src/messages.ts`** — add:
- `DAY_WEATHER_UPDATED`
- `DAY_WEATHER_UPDATE_FAILED`

**`lib/hooks/use-day-weather.ts`** — new hook following `useDayMemo` pattern:
- Optimistic update on the React Query cache
- Rollback on API error
- PATCH `/api/trips/:tripId/days/:dayId`

**`components/day-weather-editor.tsx`** — new component:
- Display mode: compact row showing emoji + "最高 XX° / 最低 XX°" (or "天気を追加" if unset)
- Clickable for editors when online
- Edit mode: row of weather icon buttons (11 types) + two number inputs for high/low temp + Save/Cancel

**`_components/day-tabs.tsx`** — when `day.weatherType` is set, append ` {emoji} {high}/{low}°` to the tab label.

**`trips/[id]/page.tsx`** and **`sp/trips/[id]/page.tsx`** — render `DayWeatherEditor` above `DayMemoEditor` in the day panel. Pass the `useDayWeather` hook result as prop.

---

## Data Flow

1. User clicks weather row in day panel → edit mode opens
2. User selects emoji icon + enters temperatures → clicks Save
3. `useDayWeather.save()` → optimistic update to React Query cache → PATCH `/api/trips/:id/days/:dayId`
4. On success: toast, realtime broadcast triggers sync for other members
5. On error: cache rollback + error toast

---

## Testing

- API unit tests: weather update, null clear, invalid type rejection
- Component tests: `DayWeatherEditor` render in display/edit mode (follows existing component test patterns)

---

## Out of Scope

- Automatic weather fetch from external APIs
- Weather display in print page / shared trip view (can add later)
- Per-temperature unit (°C only)
