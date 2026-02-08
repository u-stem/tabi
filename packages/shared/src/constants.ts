import type { SpotCategory } from "./schemas/spot";
import type { TripStatus } from "./schemas/trip";

export const CATEGORY_LABELS: Record<SpotCategory, string> = {
  sightseeing: "観光",
  restaurant: "飲食",
  hotel: "宿泊",
  transport: "移動",
  activity: "アクティビティ",
  other: "その他",
};

export const STATUS_LABELS: Record<TripStatus, string> = {
  draft: "下書き",
  planned: "計画済み",
  active: "進行中",
  completed: "完了",
};
