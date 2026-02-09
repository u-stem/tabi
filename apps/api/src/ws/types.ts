import type { DayPatternResponse, SpotResponse } from "@tabi/shared";

export type PresenceUser = {
  userId: string;
  name: string;
  dayId: string | null;
  patternId: string | null;
};

export type ServerMessage =
  | { type: "spot:created"; dayId: string; patternId: string; spot: SpotResponse }
  | { type: "spot:updated"; dayId: string; patternId: string; spot: SpotResponse }
  | { type: "spot:deleted"; dayId: string; patternId: string; spotId: string }
  | { type: "spot:reordered"; dayId: string; patternId: string; spotIds: string[] }
  | { type: "pattern:created"; dayId: string; pattern: DayPatternResponse }
  | { type: "pattern:updated"; dayId: string; pattern: DayPatternResponse }
  | { type: "pattern:deleted"; dayId: string; patternId: string }
  | { type: "pattern:duplicated"; dayId: string; pattern: DayPatternResponse }
  | { type: "trip:updated" }
  | { type: "presence"; users: PresenceUser[] };

export type ClientMessage = {
  type: "presence:update";
  dayId: string;
  patternId: string | null;
};
