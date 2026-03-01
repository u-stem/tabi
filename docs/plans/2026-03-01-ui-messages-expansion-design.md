# UI Messages Expansion Design

**Date:** 2026-03-01
**Status:** Approved

## Goal

Prevent ad-hoc UI messages by centralizing all user-facing Japanese text into `packages/shared/src/messages.ts`. Developers will always find an existing constant before writing their own string.

## Background

After consolidating `ERROR_MSG`, `MSG`, `AUTH_ERROR_MAP`, `PUSH_MSG`, and `*_LABELS` into `packages/shared/src/messages.ts`, the following categories remain scattered across ~22 component files:

- Empty state messages ("まだ〜がありません", "〜がありません")
- UI status messages ("全員追加済みです", "変更がありません")
- Bookmark visibility labels ("非公開", "フレンド限定", "全体公開")

## Design

### Approach

Expand the existing `MSG` constant with an `// Empty states` section, and add a new `VISIBILITY_LABELS` export following the established `ROLE_LABELS` / `STATUS_LABELS` pattern.

No new abstractions. No new files.

### Additions to MSG

```typescript
// Empty states
EMPTY_TRIP: "まだ旅行がありません",
EMPTY_TRIP_SHARED: "共有された旅行はありません",
EMPTY_TRIP_FILTER: "条件に一致する旅行がありません",
EMPTY_SCHEDULE: "まだ予定がありません",
EMPTY_CANDIDATE: "候補がありません",
EMPTY_BOOKMARK_LIST: "リストがありません",
EMPTY_BOOKMARK_LIST_FILTER: "条件に一致するリストがありません",
EMPTY_BOOKMARK: "ブックマークがありません",
EMPTY_FRIEND: "フレンドがいません",
EMPTY_MEMBER: "まだメンバーがいません",
EMPTY_GROUP: "グループがありません",
EMPTY_NOTIFICATION: "通知はありません",
EMPTY_EXPENSE: "費用はまだ記録されていません",
EMPTY_SOUVENIR: "お土産リストはまだありません",
EMPTY_NEWS: "お知らせはまだありません",
EMPTY_EXPORT_SHEET: "このシートにデータがありません",

// UI status
MEMBER_ALL_ADDED: "全員追加済みです",
NO_CHANGES: "変更がありません",
```

### New export: VISIBILITY_LABELS

```typescript
export const VISIBILITY_LABELS = {
  private: "非公開",
  friends_only: "フレンド限定",
  public: "全体公開",
} as const;
```

The type for keys is `"private" | "friends_only" | "public"` — already used in bookmark list schema.

## Affected Files (≈22)

### Empty states (update to use MSG.EMPTY_*)

| File | Keys used |
|------|-----------|
| `apps/web/app/(authenticated)/home/page.tsx` | EMPTY_TRIP, EMPTY_TRIP_SHARED, EMPTY_TRIP_FILTER |
| `apps/web/app/(sp)/sp/home/page.tsx` | EMPTY_TRIP, EMPTY_TRIP_SHARED, EMPTY_TRIP_FILTER |
| `apps/web/app/(authenticated)/bookmarks/page.tsx` | EMPTY_BOOKMARK_LIST, EMPTY_BOOKMARK_LIST_FILTER |
| `apps/web/app/(sp)/sp/bookmarks/page.tsx` | EMPTY_BOOKMARK_LIST, EMPTY_BOOKMARK_LIST_FILTER |
| `apps/web/app/(authenticated)/bookmarks/[listId]/page.tsx` | EMPTY_BOOKMARK |
| `apps/web/app/(sp)/sp/bookmarks/[listId]/page.tsx` | EMPTY_BOOKMARK |
| `apps/web/components/day-timeline.tsx` | EMPTY_SCHEDULE |
| `apps/web/app/(authenticated)/trips/[id]/print/page.tsx` | EMPTY_SCHEDULE |
| `apps/web/app/shared/[token]/_components/shared-trip-client.tsx` | EMPTY_SCHEDULE |
| `apps/web/components/candidate-panel.tsx` | EMPTY_CANDIDATE |
| `apps/web/components/bookmark-panel.tsx` | EMPTY_BOOKMARK, EMPTY_BOOKMARK_LIST |
| `apps/web/components/bookmark-list-picker-dialog.tsx` | EMPTY_BOOKMARK_LIST |
| `apps/web/app/(authenticated)/friends/_components/friends-tab.tsx` | EMPTY_FRIEND |
| `apps/web/app/(authenticated)/friends/_components/group-detail-dialog.tsx` | EMPTY_MEMBER, EMPTY_FRIEND |
| `apps/web/components/member-dialog.tsx` | EMPTY_FRIEND, EMPTY_GROUP |
| `apps/web/app/(authenticated)/friends/_components/groups-tab.tsx` | EMPTY_GROUP |
| `apps/web/components/notification-bell.tsx` | EMPTY_NOTIFICATION |
| `apps/web/components/expense-panel.tsx` | EMPTY_EXPENSE |
| `apps/web/components/souvenir-panel.tsx` | EMPTY_SOUVENIR |
| `apps/web/app/news/page.tsx` | EMPTY_NEWS |
| `apps/web/app/(authenticated)/trips/[id]/export/page.tsx` | EMPTY_EXPORT_SHEET |
| `apps/web/app/users/[userId]/page.tsx` | EMPTY_BOOKMARK, EMPTY_BOOKMARK_LIST |

### VISIBILITY_LABELS (update to use imported constant)

| File | Current usage |
|------|--------------|
| `apps/web/app/(authenticated)/bookmarks/[listId]/_components/bookmark-dialogs.tsx` | SelectItem の value/text |
| `apps/web/components/create-bookmark-list-dialog.tsx` | SelectItem の value/text |
| `apps/web/app/(authenticated)/bookmarks/page.tsx` | フィルター用ラベル配列 |
| `apps/web/app/(sp)/sp/bookmarks/page.tsx` | フィルター用ラベル配列 |
| `apps/web/app/(authenticated)/bookmarks/[listId]/_components/bookmark-list-header.tsx` | バッジ表示 |
| `apps/web/components/bookmark-list-card.tsx` | バッジ表示 |

### UI status messages

| File | Key |
|------|-----|
| `apps/web/components/member-dialog.tsx` | MEMBER_ALL_ADDED |
| `apps/web/app/(authenticated)/friends/_components/group-detail-dialog.tsx` | MEMBER_ALL_ADDED |
| `apps/web/app/(authenticated)/settings/page.tsx` | NO_CHANGES |

## Import Strategy

Components import `MSG` via `@/lib/messages` (existing re-export) or directly from `@sugara/shared`.
`VISIBILITY_LABELS` is imported directly from `@sugara/shared` (same as `ROLE_LABELS`, `STATUS_LABELS`).

## Testing

- Type-check (`bun run check-types`) after each commit
- Full test suite (`bun run test`) at the end
- No new test code needed — these are string constants

## Out of Scope

- Button labels ("キャンセル", "削除", "保存") — too component-specific, no consolidation benefit
- Dialog titles and descriptions — component-specific context
- Placeholder examples ("金閣寺", "東京駅") — domain examples, not reusable text
- aria-label strings — accessibility, scoped to component
