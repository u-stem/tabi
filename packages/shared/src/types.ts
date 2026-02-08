export type SpotResponse = {
  id: string;
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

export type DayResponse = {
  id: string;
  dayNumber: number;
  date: string;
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
