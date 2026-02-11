export const MSG = {
  // Schedule
  SCHEDULE_ADDED: "予定を追加しました",
  SCHEDULE_ADD_FAILED: "予定の追加に失敗しました",
  SCHEDULE_UPDATED: "予定を更新しました",
  SCHEDULE_UPDATE_FAILED: "予定の更新に失敗しました",
  SCHEDULE_DELETED: "予定を削除しました",
  SCHEDULE_DELETE_FAILED: "予定の削除に失敗しました",
  SCHEDULE_MOVED_TO_CANDIDATE: "候補に戻しました",
  SCHEDULE_MOVE_FAILED: "候補への移動に失敗しました",
  SCHEDULE_REORDER_FAILED: "並び替えに失敗しました",

  // Candidate
  CANDIDATE_ASSIGNED: "予定に追加しました",
  CANDIDATE_ASSIGN_FAILED: "予定への追加に失敗しました",
  CANDIDATE_ADDED: "候補を追加しました",
  CANDIDATE_ADD_FAILED: "候補の追加に失敗しました",
  CANDIDATE_DELETED: "候補を削除しました",
  CANDIDATE_DELETE_FAILED: "候補の削除に失敗しました",
  CANDIDATE_UPDATED: "候補を更新しました",
  CANDIDATE_UPDATE_FAILED: "候補の更新に失敗しました",

  // Trip
  TRIP_UPDATED: "旅行を更新しました",
  TRIP_UPDATE_FAILED: "旅行の更新に失敗しました",
  TRIP_DELETED: "旅行を削除しました",
  TRIP_DELETE_FAILED: "旅行の削除に失敗しました",
  TRIP_STATUS_CHANGED: "ステータスを変更しました",
  TRIP_STATUS_CHANGE_FAILED: "ステータスの変更に失敗しました",
  TRIP_DATE_REQUIRED: "日付を選択してください",

  // Share
  SHARE_LINK_COPIED: "共有リンクをコピーしました",
  SHARE_LINK_FAILED: "共有リンクの生成に失敗しました",
  SHARE_LINK_REGENERATED: "共有リンクを再生成してコピーしました",
  SHARE_LINK_REGENERATE_FAILED: "共有リンクの再生成に失敗しました",

  // Member
  MEMBER_ADDED: "メンバーを追加しました",
  MEMBER_ADD_FAILED: "メンバーの追加に失敗しました",
  MEMBER_LIST_FAILED: "メンバー一覧の取得に失敗しました",
  MEMBER_ROLE_CHANGED: "ロールを変更しました",
  MEMBER_ROLE_CHANGE_FAILED: "ロールの変更に失敗しました",
  MEMBER_REMOVED: "メンバーを削除しました",
  MEMBER_REMOVE_FAILED: "メンバーの削除に失敗しました",

  // Auth
  AUTH_LOGIN_FAILED: "ログインに失敗しました",
  AUTH_LOGIN_SUCCESS: "ログインしました",

  // Conflict
  CONFLICT: "他のユーザーが先に更新しました。画面を更新してください。",

  // Time validation
  TIME_START_REQUIRED: "開始時間を入力してください",
  TIME_END_BEFORE_START: "終了時間は開始時間より後にしてください",
  TIME_HOTEL_CHECKIN_REQUIRED: "チェックイン時間を入力してください",
  TIME_HOTEL_CHECKOUT_AFTER: "チェックアウト時間はチェックイン時間より後にしてください",
  TIME_TRANSPORT_DEPARTURE_REQUIRED: "出発時間を入力してください",
  TIME_TRANSPORT_ARRIVAL_AFTER: "到着時間は出発時間より後にしてください",

  // Shared view
  SHARED_LINK_INVALID: "このリンクは無効か、有効期限が切れています",
  SHARED_TRIP_FETCH_FAILED: "旅行の取得に失敗しました",
  SHARED_TRIP_NOT_FOUND: "旅行が見つかりません",
} as const;
