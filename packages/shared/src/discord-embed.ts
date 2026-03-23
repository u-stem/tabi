import type { NotificationType } from "./schemas/notification";

type NotificationPayload = {
  actorName?: string;
  tripName?: string;
  entityName?: string;
  newRole?: string;
  [key: string]: string | undefined;
};

export type DiscordEmbed = {
  author?: { name: string };
  title: string;
  description: string;
  url: string;
  color: number;
  timestamp: string;
};

export const DISCORD_EMBED_COLORS = {
  member: 0x3b82f6,
  schedule: 0x22c55e,
  poll: 0xf97316,
  expense: 0xa855f7,
} as const;

const COLOR_MAP: Record<string, number> = {
  member_added: DISCORD_EMBED_COLORS.member,
  member_removed: DISCORD_EMBED_COLORS.member,
  role_changed: DISCORD_EMBED_COLORS.member,
  schedule_created: DISCORD_EMBED_COLORS.schedule,
  schedule_updated: DISCORD_EMBED_COLORS.schedule,
  schedule_deleted: DISCORD_EMBED_COLORS.schedule,
  poll_started: DISCORD_EMBED_COLORS.poll,
  poll_closed: DISCORD_EMBED_COLORS.poll,
  expense_added: DISCORD_EMBED_COLORS.expense,
  settlement_checked: DISCORD_EMBED_COLORS.expense,
  candidate_created: DISCORD_EMBED_COLORS.schedule,
  candidate_deleted: DISCORD_EMBED_COLORS.schedule,
  candidate_reaction: DISCORD_EMBED_COLORS.poll,
};

const DISCORD_MSG_JA: Record<string, (p: NotificationPayload) => string> = {
  member_added: (p) => `${p.actorName}さんが新しいメンバーを招待しました`,
  member_removed: (p) => `${p.actorName}さんがメンバーを削除しました`,
  role_changed: (p) => `${p.actorName}さんがロールを「${p.newRole}」に変更しました`,
  schedule_created: (p) => `${p.actorName}さんが予定「${p.entityName}」を追加しました`,
  schedule_updated: (p) => `${p.actorName}さんが予定「${p.entityName}」を更新しました`,
  schedule_deleted: (p) => `${p.actorName}さんが予定を削除しました`,
  poll_started: () => "日程調整が開始されました",
  poll_closed: () => "日程調整が終了しました",
  expense_added: (p) => `${p.actorName}さんが費用「${p.entityName}」を追加しました`,
  settlement_checked: (p) => `${p.actorName}さんが精算をチェックしました`,
  candidate_created: (p) => `${p.actorName}さんが候補「${p.entityName}」を追加しました`,
  candidate_deleted: (p) => `${p.actorName}さんが候補を削除しました`,
  candidate_reaction: (p) => `${p.actorName}さんが候補「${p.entityName}」にリアクションしました`,
};

const DISCORD_MSG_EN: Record<string, (p: NotificationPayload) => string> = {
  member_added: (p) => `${p.actorName} invited a new member`,
  member_removed: (p) => `${p.actorName} removed a member`,
  role_changed: (p) => `${p.actorName} changed a role to "${p.newRole}"`,
  schedule_created: (p) => `${p.actorName} added "${p.entityName}" to the schedule`,
  schedule_updated: (p) => `${p.actorName} updated "${p.entityName}"`,
  schedule_deleted: (p) => `${p.actorName} removed a schedule item`,
  poll_started: () => "A poll has started",
  poll_closed: () => "A poll has ended",
  expense_added: (p) => `${p.actorName} added expense "${p.entityName}"`,
  settlement_checked: (p) => `${p.actorName} checked a settlement`,
  candidate_created: (p) => `${p.actorName} added candidate "${p.entityName}"`,
  candidate_deleted: (p) => `${p.actorName} removed a candidate`,
  candidate_reaction: (p) => `${p.actorName} reacted to candidate "${p.entityName}"`,
};

const DISCORD_MSG: Record<string, Record<string, (p: NotificationPayload) => string>> = {
  ja: DISCORD_MSG_JA,
  en: DISCORD_MSG_EN,
};

type BuildEmbedParams = {
  type: NotificationType;
  payload: NotificationPayload;
  tripId: string;
  locale: string;
  baseUrl: string;
};

export function buildDiscordEmbed(params: BuildEmbedParams): DiscordEmbed {
  const { type, payload, tripId, locale, baseUrl } = params;
  const messages = DISCORD_MSG[locale] ?? DISCORD_MSG.en;
  const formatter = messages[type];
  const description = formatter ? formatter(payload) : type;

  return {
    author: { name: "sugara" },
    title: payload.tripName ?? "Trip",
    description,
    url: `${baseUrl}/trips/${tripId}`,
    color: COLOR_MAP[type] ?? DISCORD_EMBED_COLORS.member,
    timestamp: new Date().toISOString(),
  };
}
