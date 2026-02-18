import type { MemberRole } from "./schemas/member";
import type { ScheduleCategory, ScheduleColor, TransportMethod } from "./schemas/schedule";
import type { TripStatus } from "./schemas/trip";

export const DEFAULT_SCHEDULE_CATEGORY: ScheduleCategory = "sightseeing";

export const CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  sightseeing: "観光",
  restaurant: "飲食",
  hotel: "宿泊",
  transport: "移動",
  activity: "アクティビティ",
  other: "その他",
};

export const TRANSPORT_METHOD_LABELS: Record<TransportMethod, string> = {
  train: "電車",
  shinkansen: "新幹線",
  bus: "バス",
  taxi: "タクシー",
  walk: "徒歩",
  car: "車",
  airplane: "飛行機",
};

export const STATUS_LABELS: Record<TripStatus, string> = {
  scheduling: "日程調整中",
  draft: "下書き",
  planned: "計画済み",
  active: "進行中",
  completed: "完了",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "オーナー",
  editor: "編集者",
  viewer: "閲覧者",
};

export const SCHEDULE_COLOR_LABELS: Record<ScheduleColor, string> = {
  blue: "青",
  red: "赤",
  green: "緑",
  yellow: "黄",
  purple: "紫",
  pink: "ピンク",
  orange: "オレンジ",
  gray: "グレー",
};
