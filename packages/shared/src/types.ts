import type { MemberRole } from "./schemas/member";
import type { SpotCategory, SpotColor } from "./schemas/spot";
import type { TripStatus } from "./schemas/trip";

export type SpotResponse = {
  id: string;
  name: string;
  category: SpotCategory;
  address?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder: number;
  memo?: string | null;
  url?: string | null;
  departurePlace?: string | null;
  arrivalPlace?: string | null;
  transportMethod?: string | null;
  color: SpotColor;
};

export type DayPatternResponse = {
  id: string;
  label: string;
  isDefault: boolean;
  sortOrder: number;
  spots: SpotResponse[];
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
};

export type TripListItem = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  role: MemberRole;
  totalSpots: number;
};

export type MemberResponse = {
  userId: string;
  role: MemberRole;
  name: string;
  email: string;
};
