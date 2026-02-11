import type { DayPatternResponse, ScheduleResponse } from "@tabi/shared";

export type PresenceUser = {
  userId: string;
  name: string;
  dayId: string | null;
  patternId: string | null;
};

// Pattern notifications exclude schedules — the client re-fetches full data on sync
type PatternNotification = Omit<DayPatternResponse, "schedules">;

export type ServerMessage =
  | { type: "schedule:created"; dayId: string; patternId: string; schedule: ScheduleResponse }
  | { type: "schedule:updated"; dayId: string; patternId: string; schedule: ScheduleResponse }
  | { type: "schedule:deleted"; dayId: string; patternId: string; scheduleId: string }
  | { type: "schedule:reordered"; dayId: string; patternId: string; scheduleIds: string[] }
  | { type: "schedule:assigned"; schedule: ScheduleResponse; dayId: string; patternId: string }
  | { type: "schedule:unassigned"; scheduleId: string; fromDayId: string; fromPatternId: string }
  | {
      type: "schedule:batch-unassigned";
      scheduleIds: string[];
      fromDayId: string;
      fromPatternId: string;
    }
  | { type: "schedule:batch-deleted"; scheduleIds: string[]; dayId: string; patternId: string }
  | { type: "candidate:created"; schedule: ScheduleResponse }
  | { type: "candidate:updated"; schedule: ScheduleResponse }
  | { type: "candidate:deleted"; scheduleId: string }
  | { type: "candidate:reordered"; scheduleIds: string[] }
  | { type: "candidate:batch-assigned"; scheduleIds: string[]; dayId: string; patternId: string }
  | { type: "candidate:batch-deleted"; scheduleIds: string[] }
  | { type: "candidate:batch-duplicated"; scheduleIds: string[] }
  | { type: "schedule:batch-duplicated"; scheduleIds: string[]; dayId: string; patternId: string }
  | { type: "pattern:created"; dayId: string; pattern: PatternNotification }
  | { type: "pattern:updated"; dayId: string; pattern: PatternNotification }
  | { type: "pattern:deleted"; dayId: string; patternId: string }
  | { type: "pattern:duplicated"; dayId: string; pattern: PatternNotification }
  | { type: "trip:updated" }
  | { type: "presence"; users: PresenceUser[] };

export type ClientMessage = {
  type: "presence:update";
  dayId: string;
  patternId: string | null;
};
