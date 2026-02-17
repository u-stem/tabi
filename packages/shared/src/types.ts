import type { BookmarkListVisibility } from "./schemas/bookmark";
import type { MemberRole } from "./schemas/member";
import type { ReactionType, ScheduleCategory, ScheduleColor } from "./schemas/schedule";
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
  urls: string[];
  departurePlace?: string | null;
  arrivalPlace?: string | null;
  transportMethod?: string | null;
  color: ScheduleColor;
  endDayOffset?: number | null;
  updatedAt: string;
};

export type CandidateResponse = ScheduleResponse & {
  likeCount: number;
  hmmCount: number;
  myReaction: ReactionType | null;
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
  candidates: CandidateResponse[];
  scheduleCount: number;
  memberCount: number;
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
  crossDayPosition: "intermediate" | "final";
};

export type MemberResponse = {
  userId: string;
  role: MemberRole;
  name: string;
  image?: string | null;
};

export type ActivityLogResponse = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityName?: string | null;
  detail?: string | null;
  createdAt: string;
};

export type FriendResponse = {
  friendId: string;
  userId: string;
  name: string;
  image?: string | null;
};

export type FriendRequestResponse = {
  id: string;
  requesterId: string;
  name: string;
  image?: string | null;
  createdAt: string;
};

export type BookmarkListResponse = {
  id: string;
  name: string;
  visibility: BookmarkListVisibility;
  sortOrder: number;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkResponse = {
  id: string;
  name: string;
  memo?: string | null;
  urls: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkListDetailResponse = BookmarkListResponse & {
  bookmarks: BookmarkResponse[];
};

export type PublicProfileResponse = {
  id: string;
  name: string;
  image?: string | null;
  bookmarkLists: BookmarkListResponse[];
};
