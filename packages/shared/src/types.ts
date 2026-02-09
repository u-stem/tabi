import type { MemberRole } from "./schemas/member";
import type { SpotCategory } from "./schemas/spot";
import type { TripStatus } from "./schemas/trip";

export type SpotResponse = {
  id: string;
  name: string;
  category: SpotCategory;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder: number;
  memo?: string | null;
  url?: string | null;
  departurePlace?: string | null;
  arrivalPlace?: string | null;
  transportMethod?: string | null;
};

export type DayResponse = {
  id: string;
  dayNumber: number;
  date: string;
  memo?: string | null;
  spots: SpotResponse[];
};

export type TripResponse = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  days: DayResponse[];
};

export type TripListItem = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  totalSpots: number;
};

export type MemberResponse = {
  userId: string;
  role: MemberRole;
  name: string;
  email: string;
};
