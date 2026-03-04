import type { BookmarkListVisibility } from "./schemas/bookmark";
import type { ExpenseSplitType } from "./schemas/expense";
import type { MemberRole } from "./schemas/member";
import type { PollResponseValue, PollStatus } from "./schemas/poll";
import type { ReactionType, ScheduleCategory, ScheduleColor } from "./schemas/schedule";
import type { TripStatus } from "./schemas/trip";
import type { WeatherType } from "./schemas/trip-day";

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
  weatherType?: WeatherType | null;
  weatherTypeSecondary?: WeatherType | null;
  tempHigh?: number | null;
  tempLow?: number | null;
  patterns: DayPatternResponse[];
};

export type TripPollSummary = {
  id: string;
  status: PollStatus;
  participantCount: number;
  respondedCount: number;
};

export type TripResponse = {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  coverImageUrl: string | null;
  coverImagePosition: number;
  role: MemberRole;
  days: DayResponse[];
  candidates: CandidateResponse[];
  scheduleCount: number;
  memberCount: number;
  poll: TripPollSummary | null;
};

export type TripListItem = {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  coverImageUrl: string | null;
  coverImagePosition: number;
  role: MemberRole;
  totalSchedules: number;
  updatedAt: string;
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
  hasExpenses?: boolean;
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

export type GroupResponse = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupMemberResponse = {
  userId: string;
  name: string;
  image?: string | null;
  addedAt: string;
};

export type BulkAddMembersResponse = {
  added: number;
  failed: number;
};

export type PublicProfileResponse = {
  id: string;
  name: string;
  image?: string | null;
  bookmarkLists: BookmarkListResponse[];
};

export type PollOptionResponse = {
  id: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
};

export type PollParticipantResponse = {
  id: string;
  userId: string;
  name: string;
  image?: string | null;
  responses: { optionId: string; response: PollResponseValue }[];
};

export type PollListItem = {
  id: string;
  title: string;
  destination: string | null;
  status: PollStatus;
  deadline: string | null;
  participantCount: number;
  respondedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PollDetailResponse = {
  id: string;
  ownerId: string;
  title: string;
  destination: string | null;
  note: string | null;
  status: PollStatus;
  deadline: string | null;
  confirmedOptionId: string | null;
  tripId: string;
  options: PollOptionResponse[];
  participants: PollParticipantResponse[];
  isOwner: boolean;
  myParticipantId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SharedPollResponse = Omit<
  PollDetailResponse,
  "isOwner" | "myParticipantId" | "tripId" | "ownerId"
> & {
  shareExpiresAt: string | null;
};

// Expense API response types

export type ExpenseSplit = {
  userId: string;
  amount: number;
  user: { id: string; name: string };
};

export type ExpenseItem = {
  id: string;
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  paidByUserId: string;
  paidByUser: { id: string; name: string };
  splits: ExpenseSplit[];
  createdAt: string;
};

export type Transfer = {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
};

export type Settlement = {
  totalAmount: number;
  balances: { userId: string; name: string; net: number }[];
  transfers: Transfer[];
};

export type ExpensesResponse = {
  expenses: ExpenseItem[];
  settlement: Settlement;
};

// Notification API response types

export type Notification = {
  id: string;
  type: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
  tripId: string | null;
};

export type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

export type UserProfileResponse = {
  id: string;
  name: string;
  image?: string | null;
};

// Shared trip view types

export type SharedTripResponse = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  days: DayResponse[];
  shareExpiresAt: string | null;
};

// Activity log paginated response

export type LogsResponse = {
  items: ActivityLogResponse[];
  nextCursor: string | null;
};
