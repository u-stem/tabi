import type { MemberRole } from "./schemas/member";
import type { ScheduleCategory, ScheduleColor } from "./schemas/schedule";
import type { TripStatus } from "./schemas/trip";

export type ScheduleResponse = {
  id: string;
  name: string;
  category: ScheduleCategory;
  address?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder: number;
  memo?: string | null;
  url?: string | null;
  departurePlace?: string | null;
  arrivalPlace?: string | null;
  transportMethod?: string | null;
  color: ScheduleColor;
  endDayOffset?: number | null;
  updatedAt: string;
};

export type DayPatternResponse = {
  id: string;
  label: string;
  isDefault: boolean;
  sortOrder: number;
  schedules: ScheduleResponse[];
};

export type DayResponse = {
  id: string;
  dayNumber: number;
  date: string;
  memo?: string | null;
  patterns: DayPatternResponse[];
};

export type TripResponse = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  role: MemberRole;
  days: DayResponse[];
  candidates: ScheduleResponse[];
};

export type TripListItem = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  role: MemberRole;
  totalSchedules: number;
};

export type CrossDayEntry = {
  schedule: ScheduleResponse;
  sourceDayId: string;
  sourcePatternId: string;
  sourceDayNumber: number;
};

export type MemberResponse = {
  userId: string;
  role: MemberRole;
  name: string;
  email: string;
};
