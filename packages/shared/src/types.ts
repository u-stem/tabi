export type SpotResponse = {
  id: string;
  name: string;
  category: string;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder: number;
  memo?: string | null;
  url?: string | null;
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
  status: string;
  days: DayResponse[];
};

export type TripListItem = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
};
