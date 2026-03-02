# Trip Day Weather Design

**Goal:** Allow users to manually record weather type and temperature (high/low) for each trip day.

---

## Requirements

- Weather type: enum of common Japanese weather conditions
- Max temperature: integer (°C), nullable
- Min temperature: integer (°C), nullable
- Manual input by users with editor role
- Display compactly in day tabs: `1日目 ☀️ 24/18°` or `1日目 ☀️→☁️ 24/18°` (when secondary is set)
- Edit UI in the day panel (above memo editor), similar to the existing `DayMemoEditor` pattern

---

## Data Model

Add four columns to `trip_days`:

| Column | Type | Description |
|--------|------|-------------|
| `weather_type` | `weather_type` enum, nullable | Primary weather condition |
| `weather_type_secondary` | `weather_type` enum, nullable | Secondary weather (for "→" transitions like "晴れのち曇り") |
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
- Extend `updateTripDaySchema` with `weatherType`, `weatherTypeSecondary`, `tempHigh`, `tempLow`

**`src/types.ts`** — extend `DayResponse`:
```typescript
weatherType?: WeatherType | null;
weatherTypeSecondary?: WeatherType | null;
tempHigh?: number | null;
tempLow?: number | null;
```

### API (`apps/api`)

**`src/db/schema.ts`** — add `weatherTypeEnum` pgEnum, add 4 columns to `tripDays`.

**Migration** — generated via `bun run db:generate`, applied via `bun run db:migrate`.

**`src/routes/trip-days.ts`** — extend PATCH handler to update `weatherType`, `weatherTypeSecondary`, `tempHigh`, `tempLow`. Activity log entity: `day_weather`.

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
- Display mode: compact row showing `☀️` or `☀️→☁️` + "XX°/XX°" (or "天気を追加" if unset)
- Clickable for editors when online
- Edit mode:
  - Primary weather picker row (11 icons)
  - Optional secondary weather picker row (11 icons + clear button), shown below with "→" indicator
  - Two number inputs for high/low temp
  - Save/Cancel buttons

**`_components/day-tabs.tsx`** — when `day.weatherType` is set, append ` {emoji}[→{emoji2}] {high}/{low}°` to the tab label.

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
