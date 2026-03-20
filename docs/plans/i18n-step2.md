# i18n Step 2: 全画面の文字列切り出し

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ全体のハードコード日本語文字列を next-intl のメッセージファイルに切り出す

**Architecture:** Step 1 で導入済みの next-intl (Cookie ベース) を使用。`ja.json` にネームスペース単位で文字列を追加し、各コンポーネントで `useTranslations` (Client) / `getTranslations` (Server) に置き換える。MSG オブジェクトは段階的に削除する

**Tech Stack:** next-intl, Next.js 16 App Router, TypeScript

**Spec:** `docs/plans/i18n.md`

---

## ネームスペース設計

`ja.json` に以下のネームスペースを追加する:

```
metadata        ... (Step 1 で作成済み)
home            ... (Step 1 で作成済み)
common          ... 共通 UI (ボタン、ステータス、キャンセル等)
nav             ... ナビゲーション
auth            ... 認証画面
labels          ... ラベル定数 (カテゴリ、ステータス等)
messages        ... トースト・フィードバックメッセージ (MSG から移行)
authErrors      ... 認証エラーメッセージ (AUTH_ERROR_MAP から移行)
trip            ... 旅行関連 UI
schedule        ... スケジュール・候補関連 UI
expense         ... 費用・精算関連 UI
poll            ... 投票関連 UI
bookmark        ... ブックマーク関連 UI
friend          ... フレンド・グループ関連 UI
settings        ... 設定画面
profile         ... プロフィール・マイページ
notification    ... 通知関連 UI
tools           ... ルーレット等ツール
shared          ... 共有ビュー
error           ... エラー・404・オフライン
legal           ... 利用規約・プライバシーポリシー
faq             ... FAQ ページ
news            ... お知らせページ
```

## バッチ分割

作業を以下の 8 バッチに分割する。各バッチは独立してコミット可能。

---

### Task 1: 共通 UI + ナビゲーション + ラベル定数

`common`, `nav`, `labels` ネームスペースを作成。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/lib/nav-links.ts`
- Modify: `apps/web/components/header.tsx`
- Modify: `apps/web/components/bottom-nav.tsx`
- Modify: `apps/web/components/theme-toggle.tsx`
- Modify: `apps/web/components/trip-toolbar.tsx`
- Modify: `apps/web/components/copy-button.tsx`
- Modify: `apps/web/components/shortcut-help-dialog.tsx`
- Modify: `apps/web/app/error.tsx`
- Modify: `apps/web/app/not-found.tsx`
- Modify: `apps/web/app/offline/page.tsx`

- [ ] **Step 1: `ja.json` に `common`, `nav`, `labels` ネームスペースを追加**

`common`: キャンセル、保存、削除、再試行、送信、編集、更新、検索、読み込み中、選択、全選択、全解除、選択モード、コピーしました、件選択中、オフラインです 等
`nav`: ホーム、ブックマーク、フレンド、メインナビゲーション、ボトムナビゲーション、メニューを開く/閉じる、ログアウト 等
`labels`: CATEGORY_LABELS, TRANSPORT_METHOD_LABELS, STATUS_LABELS, ROLE_LABELS, SCHEDULE_COLOR_LABELS, EXPENSE_CATEGORY_LABELS, SPLIT_TYPE_LABELS, VISIBILITY_LABELS の全キー

- [ ] **Step 2: ナビゲーションコンポーネントを置き換え**

`nav-links.ts`, `header.tsx`, `bottom-nav.tsx`, `theme-toggle.tsx` のハードコード文字列を `useTranslations("nav")` に置き換え。

- [ ] **Step 3: 共通コンポーネントを置き換え**

`trip-toolbar.tsx`, `copy-button.tsx`, `shortcut-help-dialog.tsx` のハードコード文字列を `useTranslations("common")` に置き換え。

- [ ] **Step 4: エラー・特殊ページを置き換え**

`error.tsx`, `not-found.tsx`, `offline/page.tsx` のハードコード文字列を置き換え。

- [ ] **Step 5: 型チェック + テスト**

```bash
bun run --filter @sugara/web check-types
bun run --filter @sugara/web test
```

- [ ] **Step 6: コミット**

```bash
git commit -m "feat: 共通 UI・ナビゲーション・ラベル定数を next-intl に移行"
```

---

### Task 2: MSG オブジェクトの移行

`messages` ネームスペースに MSG の全キーを移行。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `packages/shared/src/messages.ts` (段階的にキーを削除)
- Modify: `apps/web/lib/messages.ts`
- Modify: MSG を import している全 85 ファイル (Agent で並列処理)

- [ ] **Step 1: `ja.json` に `messages` ネームスペースを追加**

MSG の全キーを `messages` ネームスペースに追加。関数型メッセージは ICU MessageFormat に変換:
```json
"tripBulkDeleted": "{count}件の旅行を削除しました"
```

- [ ] **Step 2: `authErrors` ネームスペースを追加**

AUTH_ERROR_MAP の全キーを `authErrors` ネームスペースに追加。

- [ ] **Step 3: MSG を import しているファイルを `useTranslations("messages")` に順次置き換え**

85 ファイルを機能グループごとに置き換え。Agent を使って並列処理する。

`translateAuthError` 関数は next-intl のメッセージに置き換え。

- [ ] **Step 4: MSG オブジェクトから移行済みキーを削除**

全ての参照が置き換え完了したキーを MSG から削除。最終的に MSG オブジェクトが空になったら `packages/shared/src/messages.ts` から MSG export を削除。

注意: `ERROR_MSG` と `PUSH_MSG` は対象外。残す。

- [ ] **Step 5: ラベル定数の参照を置き換え**

`CATEGORY_LABELS`, `STATUS_LABELS` 等を import しているファイル (23 ファイル 69 箇所) を `useTranslations("labels")` に置き換え。

ラベル定数は `packages/shared/src/messages.ts` から削除。

- [ ] **Step 6: 型チェック + テスト**

```bash
bun run check-types
bun run test
```

- [ ] **Step 7: コミット**

```bash
git commit -m "feat: MSG オブジェクトとラベル定数を next-intl に移行"
```

---

### Task 3: 認証画面

`auth` ネームスペースを作成。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/components/auth-form.tsx`
- Modify: `apps/web/components/signup-form.tsx`
- Modify: `apps/web/components/guest-button.tsx`
- Modify: `apps/web/components/guest-upgrade-dialog.tsx`
- Modify: `apps/web/components/guest-banner.tsx`
- Modify: `apps/web/app/auth/signup/page.tsx`
- Modify: `apps/web/app/auth/forgot-password/page.tsx`
- Modify: `apps/web/app/auth/reset-password/page.tsx`

- [ ] **Step 1: `ja.json` に `auth` ネームスペースを追加**

ログイン、新規登録、パスワードリセット、ゲスト関連の全文字列。

- [ ] **Step 2: 各ファイルのハードコード文字列を置き換え**

- [ ] **Step 3: 型チェック + テスト**

- [ ] **Step 4: コミット**

```bash
git commit -m "feat: 認証画面の文字列を next-intl に移行"
```

---

### Task 4: 旅行・スケジュール関連

`trip`, `schedule` ネームスペースを作成。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/components/create-trip-dialog.tsx`
- Modify: `apps/web/components/edit-trip-dialog.tsx`
- Modify: `apps/web/components/trip-card.tsx`
- Modify: `apps/web/components/trip-actions.tsx`
- Modify: `apps/web/components/share-dialog.tsx`
- Modify: `apps/web/components/member-dialog.tsx`
- Modify: `apps/web/components/add-schedule-dialog.tsx`
- Modify: `apps/web/components/edit-schedule-dialog.tsx`
- Modify: `apps/web/components/add-candidate-dialog.tsx`
- Modify: `apps/web/components/edit-candidate-dialog.tsx`
- Modify: `apps/web/components/batch-shift-dialog.tsx`
- Modify: `apps/web/components/candidate-panel.tsx`
- Modify: `apps/web/components/candidate-list.tsx`
- Modify: `apps/web/components/day-timeline.tsx`
- Modify: `apps/web/components/day-memo-editor.tsx`
- Modify: `apps/web/components/day-weather-editor.tsx`
- Modify: `apps/web/components/day-picker-drawer.tsx`
- Modify: `apps/web/components/activity-log.tsx`
- Modify: `apps/web/app/(authenticated)/home/page.tsx`
- Modify: `apps/web/app/(sp)/sp/home/page.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Modify: `apps/web/app/(sp)/sp/trips/[id]/page.tsx`
- Modify: 各 print/export ページ

- [ ] **Step 1: `ja.json` に `trip`, `schedule` ネームスペースを追加**

- [ ] **Step 2: ダイアログ・パネルコンポーネントを置き換え**

- [ ] **Step 3: ページコンポーネントを置き換え**

- [ ] **Step 4: 型チェック + テスト**

- [ ] **Step 5: コミット**

```bash
git commit -m "feat: 旅行・スケジュール関連の文字列を next-intl に移行"
```

---

### Task 5: 費用・精算 + 投票 + お土産

`expense`, `poll`, `souvenir` ネームスペースを作成。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/components/expense-dialog.tsx`
- Modify: `apps/web/components/expense-panel.tsx`
- Modify: `apps/web/components/settlement-section.tsx`
- Modify: `apps/web/components/unsettled-summary.tsx`
- Modify: `apps/web/components/souvenir-dialog.tsx`
- Modify: `apps/web/components/souvenir-panel.tsx`
- Modify: `apps/web/components/create-quick-poll-dialog.tsx`
- Modify: `apps/web/app/(authenticated)/polls/page.tsx`
- Modify: `apps/web/app/(sp)/sp/polls/page.tsx`
- Modify: 各投票関連ページ・コンポーネント

- [ ] **Step 1: `ja.json` にネームスペースを追加**

- [ ] **Step 2: コンポーネントを置き換え**

- [ ] **Step 3: 型チェック + テスト**

- [ ] **Step 4: コミット**

```bash
git commit -m "feat: 費用・投票・お土産関連の文字列を next-intl に移行"
```

---

### Task 6: ブックマーク + フレンド + 通知

`bookmark`, `friend`, `notification` ネームスペースを作成。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/components/bookmark-panel.tsx`
- Modify: `apps/web/components/bookmark-list-card.tsx`
- Modify: `apps/web/components/create-bookmark-list-dialog.tsx`
- Modify: `apps/web/components/bookmark-list-picker-dialog.tsx`
- Modify: `apps/web/app/(authenticated)/bookmarks/page.tsx`
- Modify: `apps/web/app/(sp)/sp/bookmarks/page.tsx`
- Modify: `apps/web/components/friend-requests-card.tsx`
- Modify: `apps/web/components/sent-requests-card.tsx`
- Modify: `apps/web/components/my-qr-dialog.tsx`
- Modify: `apps/web/components/qr-scanner-dialog.tsx`
- Modify: `apps/web/app/(authenticated)/friends/page.tsx`
- Modify: `apps/web/app/(sp)/sp/friends/page.tsx`
- Modify: `apps/web/components/notification-preferences-section.tsx`
- Modify: `apps/web/app/(sp)/sp/notifications/page.tsx`

- [ ] **Step 1: `ja.json` にネームスペースを追加**

- [ ] **Step 2: コンポーネントを置き換え**

- [ ] **Step 3: 型チェック + テスト**

- [ ] **Step 4: コミット**

```bash
git commit -m "feat: ブックマーク・フレンド・通知関連の文字列を next-intl に移行"
```

---

### Task 7: 設定 + プロフィール + ツール

`settings`, `profile`, `tools` ネームスペースを作成。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/app/(authenticated)/settings/page.tsx`
- Modify: `apps/web/app/(sp)/sp/settings/page.tsx`
- Modify: `apps/web/app/(authenticated)/my/page.tsx`
- Modify: `apps/web/app/(sp)/sp/my/page.tsx`
- Modify: `apps/web/app/(authenticated)/my/edit/page.tsx`
- Modify: `apps/web/app/(sp)/sp/my/edit/page.tsx`
- Modify: `apps/web/components/email-section.tsx`
- Modify: `apps/web/components/feedback-dialog.tsx`
- Modify: `apps/web/components/install-banner.tsx`
- Modify: `apps/web/components/roulette-content.tsx`
- Modify: `apps/web/app/(authenticated)/tools/roulette/page.tsx`
- Modify: `apps/web/app/(sp)/sp/tools/roulette/page.tsx`
- Modify: `apps/web/components/header-menu.tsx`

- [ ] **Step 1: `ja.json` にネームスペースを追加**

- [ ] **Step 2: コンポーネントを置き換え**

- [ ] **Step 3: 型チェック + テスト**

- [ ] **Step 4: コミット**

```bash
git commit -m "feat: 設定・プロフィール・ツール関連の文字列を next-intl に移行"
```

---

### Task 8: 公開ページ + 共有ビュー + 最終検証

`legal`, `faq`, `news`, `shared` ネームスペースを作成。

**Files:**
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/app/faq/page.tsx`
- Modify: `apps/web/app/news/page.tsx`
- Modify: `apps/web/app/terms/page.tsx`
- Modify: `apps/web/app/privacy/page.tsx`
- Modify: `apps/web/components/faq-search.tsx`
- Modify: `apps/web/app/shared/[token]/_components/shared-trip-client.tsx`
- Modify: `apps/web/app/polls/shared/[token]/_components/shared-poll-client.tsx`
- Modify: `apps/web/app/p/[token]/_components/quick-poll-client.tsx`

- [ ] **Step 1: `ja.json` にネームスペースを追加**

- [ ] **Step 2: コンポーネントを置き換え**

- [ ] **Step 3: 全体検証**

```bash
bun run check-types
bun run test
bun run --filter @sugara/web lint
```

- [ ] **Step 4: ハードコード日本語の残留チェック**

grep で残っている日本語文字列がないか確認。`ja.json` と `en.json` (未作成) 以外に日本語が残っていないことを検証。

- [ ] **Step 5: コミット**

```bash
git commit -m "feat: 公開ページ・共有ビューの文字列を next-intl に移行"
```

---

## 注意事項

- `ERROR_MSG` (API レスポンス用英語メッセージ) は対象外。そのまま残す
- `PUSH_MSG` (プッシュ通知テンプレート) は対象外。そのまま残す
- `nav-links.ts` は現在オブジェクト定数だが、next-intl は hooks が必要なため Client Component 内で `useTranslations` を呼ぶ形に変更する
- ラベル定数 (`CATEGORY_LABELS` 等) は `useTranslations("labels")` で取得し、キーをそのまま使う: `t(\`category.\${value}\`)`
- 関数型メッセージ (`(n: number) => ...`) は ICU MessageFormat に変換: `t("key", { count: n })`
- `translateAuthError` 関数は `useTranslations("authErrors")` に置き換え
- 利用規約・プライバシーポリシーは長文のため、`ja.json` にはセクション単位で格納するか、マークダウンコンテンツとして別管理を検討
