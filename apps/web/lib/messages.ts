import {
  MAX_FRIENDS_PER_USER,
  MAX_MEMBERS_PER_TRIP,
  MAX_PATTERNS_PER_DAY,
  MAX_SCHEDULES_PER_TRIP,
  MAX_TRIPS_PER_USER,
} from "@sugara/shared";

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
  TRIP_CREATED: "旅行を作成しました",
  TRIP_CREATE_FAILED: "旅行の作成に失敗しました",
  TRIP_FETCH_FAILED: "旅行の取得に失敗しました",
  TRIP_NOT_FOUND: "旅行が見つかりません",
  TRIP_DATE_REQUIRED: "日付を選択してください",
  TRIP_AUTO_IN_PROGRESS: "旅行が開始されました。ステータスを「進行中」に変更しました",
  TRIP_AUTO_COMPLETED: "全ての予定が終了しました。ステータスを「完了」に変更しました",
  TRIP_BULK_DELETED: (n: number) => `${n}件の旅行を削除しました`,
  TRIP_BULK_DELETE_FAILED: (n: number) => `${n}件の削除に失敗しました`,
  TRIP_BULK_DUPLICATED: (n: number) => `${n}件の旅行を複製しました`,
  TRIP_BULK_DUPLICATE_FAILED: (n: number) => `${n}件の複製に失敗しました`,

  // Share
  SHARE_LINK_COPIED: "共有リンクをコピーしました",
  SHARE_LINK_CREATED: "共有リンクを生成しました（手動でコピーしてください）",
  SHARE_LINK_FAILED: "共有リンクの生成に失敗しました",
  SHARE_LINK_REGENERATED: "共有リンクを再生成してコピーしました",
  SHARE_LINK_REGENERATED_NO_COPY: "共有リンクを再生成しました（手動でコピーしてください）",
  SHARE_LINK_REGENERATE_FAILED: "共有リンクの再生成に失敗しました",
  COPY_FAILED: "コピーに失敗しました",

  // Member
  MEMBER_ADDED: "メンバーを追加しました",
  MEMBER_ADD_FAILED: "メンバーの追加に失敗しました",
  MEMBER_LIST_FAILED: "メンバー一覧の取得に失敗しました",
  MEMBER_ROLE_CHANGED: "ロールを変更しました",
  MEMBER_ROLE_CHANGE_FAILED: "ロールの変更に失敗しました",
  MEMBER_REMOVED: "メンバーを削除しました",
  MEMBER_REMOVE_FAILED: "メンバーの削除に失敗しました",

  // Pattern
  PATTERN_ADDED: "パターンを追加しました",
  PATTERN_ADD_FAILED: "パターンの追加に失敗しました",
  PATTERN_DUPLICATED: "パターンを複製しました",
  PATTERN_DUPLICATE_FAILED: "パターンの複製に失敗しました",
  PATTERN_DELETED: "パターンを削除しました",
  PATTERN_DELETE_FAILED: "パターンの削除に失敗しました",
  PATTERN_RENAMED: "名前を変更しました",
  PATTERN_RENAME_FAILED: "名前の変更に失敗しました",

  // Settings
  SETTINGS_PROFILE_UPDATED: "プロフィールを更新しました",
  SETTINGS_PROFILE_UPDATE_FAILED: "プロフィールの更新に失敗しました",
  SETTINGS_USERNAME_UPDATED: "ユーザー名を更新しました",
  SETTINGS_USERNAME_UPDATE_FAILED: "ユーザー名の更新に失敗しました",
  SETTINGS_PASSWORD_CHANGED: "パスワードを変更しました",
  SETTINGS_PASSWORD_CHANGE_FAILED: "パスワードの変更に失敗しました",
  SETTINGS_USER_ID_COPIED: "ユーザーIDをコピーしました",

  // Auth
  AUTH_LOGIN_FAILED: "ログインに失敗しました",
  AUTH_LOGIN_SUCCESS: "ログインしました",
  AUTH_LOGOUT_FAILED: "ログアウトに失敗しました",
  AUTH_SIGNUP_SUCCESS: "アカウントを作成しました",
  AUTH_SIGNUP_FAILED: "アカウントの作成に失敗しました",
  AUTH_SIGNUP_PASSWORD_MISMATCH: "パスワードが一致しません",
  AUTH_SIGNUP_TERMS_REQUIRED: "利用規約とプライバシーポリシーへの同意が必要です",
  AUTH_PASSWORD_TOO_WEAK: "パスワードの要件を満たしていません",

  // Friend
  FRIEND_REQUEST_SENT: "フレンド申請を送信しました",
  FRIEND_REQUEST_SEND_FAILED: "フレンド申請の送信に失敗しました",
  FRIEND_REQUEST_ACCEPTED: "フレンド申請を承認しました",
  FRIEND_REQUEST_ACCEPT_FAILED: "フレンド申請の承認に失敗しました",
  FRIEND_REQUEST_REJECTED: "フレンド申請を拒否しました",
  FRIEND_REQUEST_REJECT_FAILED: "フレンド申請の拒否に失敗しました",
  FRIEND_REQUEST_CANCELLED: "フレンド申請を取り消しました",
  FRIEND_REQUEST_CANCEL_FAILED: "フレンド申請の取り消しに失敗しました",
  FRIEND_REMOVED: "フレンドを解除しました",
  FRIEND_REMOVE_FAILED: "フレンドの解除に失敗しました",
  FRIEND_LIST_FAILED: "フレンド一覧の取得に失敗しました",
  FRIEND_REQUESTS_FAILED: "フレンド申請一覧の取得に失敗しました",

  // Reaction
  REACTION_FAILED: "リアクションに失敗しました",
  REACTION_REMOVE_FAILED: "リアクションの取り消しに失敗しました",

  // Batch operations
  BATCH_ASSIGNED: (n: number) => `${n}件を予定に追加しました`,
  BATCH_ASSIGN_FAILED: "予定への追加に失敗しました",
  BATCH_UNASSIGNED: (n: number) => `${n}件を候補に戻しました`,
  BATCH_UNASSIGN_FAILED: "候補への移動に失敗しました",
  BATCH_DELETED: (n: number) => `${n}件を削除しました`,
  BATCH_DELETE_FAILED: "削除に失敗しました",
  BATCH_DUPLICATED: (n: number) => `${n}件を複製しました`,
  BATCH_DUPLICATE_FAILED: "複製に失敗しました",

  // Day memo
  DAY_MEMO_UPDATED: "メモを更新しました",
  DAY_MEMO_UPDATE_FAILED: "メモの更新に失敗しました",

  // Account
  ACCOUNT_DELETED: "アカウントを削除しました",
  ACCOUNT_DELETE_FAILED: "アカウントの削除に失敗しました",

  // Feedback
  FEEDBACK_SENT: "フィードバックを送信しました",
  FEEDBACK_SEND_FAILED: "フィードバックの送信に失敗しました",

  // Activity log
  ACTIVITY_LOG_FETCH_FAILED: "履歴の取得に失敗しました",
  ACTIVITY_LOG_EMPTY: "まだ履歴がありません",

  // Conflict
  CONFLICT: "他のユーザーが先に更新しました。画面を更新してください。",
  CONFLICT_STALE: "他のユーザーが変更を行いました。最新のデータを読み込みます。",
  CONFLICT_DELETED: "対象が他のユーザーにより削除されました。",

  // Time validation
  TIME_START_REQUIRED: "開始時間を入力してください",
  TIME_END_BEFORE_START: "終了時間は開始時間より後にしてください",
  TIME_HOTEL_CHECKIN_REQUIRED: "チェックイン時間を入力してください",
  TIME_HOTEL_CHECKOUT_AFTER: "チェックアウト時間はチェックイン時間より後にしてください",
  TIME_TRANSPORT_DEPARTURE_REQUIRED: "出発時間を入力してください",
  TIME_TRANSPORT_ARRIVAL_AFTER: "到着時間は出発時間より後にしてください",

  // Limits
  LIMIT_TRIPS: `旅行は最大${MAX_TRIPS_PER_USER}件まで作成できます`,
  LIMIT_SCHEDULES: `予定と候補は1旅行あたり合計${MAX_SCHEDULES_PER_TRIP}件まで追加できます`,
  LIMIT_PATTERNS: `パターンは各日程に最大${MAX_PATTERNS_PER_DAY}件まで追加できます`,
  LIMIT_MEMBERS: `メンバーは1旅行あたり最大${MAX_MEMBERS_PER_TRIP}名まで招待できます`,
  LIMIT_FRIENDS: `フレンドは最大${MAX_FRIENDS_PER_USER}人まで登録できます`,

  // Export
  EXPORT_SUCCESS: "エクスポートしました",
  EXPORT_FAILED: "エクスポートに失敗しました",

  // Shared view
  SHARED_LINK_INVALID: "このリンクは無効か、有効期限が切れています",
  SHARED_TRIP_FETCH_FAILED: "旅行の取得に失敗しました",
  SHARED_TRIP_NOT_FOUND: "旅行が見つかりません",
} as const;
