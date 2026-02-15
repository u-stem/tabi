# Batch Time Shift Design

## Overview

When a user edits a schedule's time and the change affects subsequent schedules, propose shifting all later schedules by the same delta. This reduces manual work when plans get delayed or finish early.

## Scope

- Same-day schedules only (no cross-day cascade)
- Triggered from EditScheduleDialog on save
- Single new API endpoint; no changes to existing endpoints

## Delta Calculation

Priority: end time change > start time change.

1. If `endTime` changed and `endDayOffset` is unchanged:
   - `deltaMinutes = diffMinutes(newEndTime, oldEndTime)`
2. Else if `startTime` changed:
   - `deltaMinutes = diffMinutes(newStartTime, oldStartTime)`
3. Else: no proposal

Only propose when `deltaMinutes !== 0`.

## Target Selection

Starting from the edited schedule's `sortOrder`, collect all subsequent schedules in the same day pattern. Exclude:

- Schedules with both `startTime` and `endTime` unset
- Schedules with `category === "hotel"` and `endDayOffset > 0` (checkout time is fixed)

For each remaining schedule, determine which time fields to shift:

- `startTime`: shift if present; skip schedule if result exceeds 24:00
- `endTime`: shift if present AND `endDayOffset` is `null` or `0`; skip schedule if result exceeds 24:00
- `endTime` with `endDayOffset > 0`: do not shift (arrival/end on a later day is fixed)

If no valid targets remain after filtering, do not show the dialog.

## Confirmation Dialog

Displayed after the edited schedule is successfully saved.

```
以降の予定の時間を調整

「{scheduleName}」の{開始/終了}時間が{N}分{遅く/早く}なりました。
以降の予定も同じ分だけずらしますか？

対象:
・昼食         11:30 → 12:00
・国際通り散策  13:00 → 13:30
・夕食         18:00 → 18:30

(warning) 「夜景スポット」(23:50)は24:00を超えるためスキップします

[この予定だけ]     [以降もずらす]
```

Display rules:

- Show up to 3 target schedules with before/after times; collapse rest as "他N件"
- Show skipped schedules (24:00 overflow) as a warning
- If all targets are skipped, do not show the dialog
- Delta description uses natural Japanese: "15分遅く" / "10分早く"

## API

```
POST /api/trips/:tripId/days/:dayId/patterns/:patternId/schedules/batch-shift
```

### Request

```json
{
  "scheduleIds": ["uuid-1", "uuid-2", "uuid-3"],
  "deltaMinutes": 15
}
```

### Validation

- `scheduleIds`: non-empty array of UUIDs
- `deltaMinutes`: integer, non-zero, range -1440 to 1440

### Server Logic

1. Verify all schedules belong to the specified day pattern
2. Check trip access (editor or owner)
3. Within a single transaction:
   a. Fetch target schedules
   b. For each schedule:
      - Skip if `category === "hotel"` and `endDayOffset > 0`
      - Compute shifted `startTime` and `endTime`
      - Skip if any shifted time exceeds 24:00 or goes below 00:00
      - Apply shift to eligible time fields
   c. Bulk UPDATE
4. Return `{ updatedCount: number, skippedCount: number }`

### Response

```json
{
  "updatedCount": 3,
  "skippedCount": 1
}
```

## Error Handling

- 400: invalid input (empty scheduleIds, deltaMinutes out of range)
- 403: no edit permission
- 404: trip/day/pattern not found, or scheduleIds contain non-existent IDs
- Client: on success, toast "N件の予定の時間を更新しました"; on partial skip, include skip count

## Files to Modify

### New Files

- `apps/api/src/routes/schedules.ts` - add `batch-shift` route
- `packages/shared/src/schemas/schedule.ts` - add `batchShiftSchedulesSchema`
- `apps/web/components/batch-shift-dialog.tsx` - confirmation dialog component

### Modified Files

- `apps/web/components/edit-schedule-dialog.tsx` - detect delta, show BatchShiftDialog on save
- `apps/web/lib/messages.ts` - add shift-related messages
- `apps/api/src/routes/schedules.test.ts` - add batch-shift tests
