# sugara - 旅行計画アプリ

## プロジェクト概要

旅行計画Webアプリ。Turborepo + bun workspaces によるモノレポ構成。

## 構成

```
apps/web/         Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui + Hono API (Route Handler)
apps/api/         Hono API ルート・DB スキーマ・認証 (Next.js Route Handler として統合)
packages/shared/  共有 Zod スキーマ・型定義
```

## コマンド

プロジェクトルートから `bun run` で実行:

```bash
bun run build        # 全パッケージビルド
bun run test         # 全テスト実行 (vitest)
bun run lint         # 全パッケージ lint (Biome via turbo)
bun run format       # 全パッケージ format (Biome via turbo)
bun run check        # lint + format + import sort (Biome via turbo)
bun run check-types  # TypeScript 型チェック
bun run db:generate  # マイグレーション生成 (スキーマ変更後に実行)
bun run db:migrate   # マイグレーション実行 (ローカル。本番は Vercel デプロイ時に自動実行)
bun run db:studio    # Drizzle Studio 起動
bun run db:seed      # 開発用シードデータ投入
bun run db:seed-user # 本番用ユーザー作成 (環境変数で指定)
bun run db:seed-faqs # FAQ データ投入
bun run db:cleanup-guests  # 期限切れゲストユーザーを削除
bun run test:coverage      # カバレッジ付きテスト
bun run test:e2e           # E2E テスト (Playwright)
```

パッケージ単位の実行は `--filter` を使用:

```bash
bun run --filter @sugara/api test
bun run --filter @sugara/web lint
bun run --filter @sugara/shared check-types
```

**`cd <dir> && ...` パターンは絶対に使わない。常に `bun run` または `bun run --filter` を使う。**
**`bunx` は使わない。全ツールは package.json スクリプトで定義済み。**

## 技術スタック

- ランタイム: bun
- フロントエンド: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (New York, Zinc)
- API: Hono (Next.js Route Handler `apps/web/app/api/[[...route]]/route.ts` として統合)
- DB: Supabase PostgreSQL + Drizzle ORM
- リアルタイム同期: Supabase Realtime (Broadcast + Presence)
- 認証: Better Auth (メール/パスワード, 管理者が新規登録を制御, `advanced.database.generateId: "uuid"`)
- バリデーション: Zod (packages/shared で共有)
- リンター/フォーマッター: Biome (ルートに biome.json、各パッケージから turbo 経由で実行)
- i18n: next-intl (Cookie ベース、URL 変更なし)
- テスト: Vitest, Playwright (E2E)
- Git フック: lefthook (pre-commit: check + check-types, commit-msg: Conventional Commits, pre-push: test + audit)
- Claude Code フック: post-edit (biome check + type check), post-stop (test)
- デプロイ: Vercel

## 主要パターン

- 全 API ルートで `requireAuth` ミドルウェアが必要 (ヘルスチェックと共有旅行ビューを除く)
- Zod スキーマは `packages/shared/src/schemas/` に配置し、API とフロントエンドの両方で使用
- API クライアント `apps/web/lib/api.ts` が認証 Cookie を自動処理 (`ApiError` クラスでステータスコード管理)
- API は同一オリジン (相対パス `/api/...`) でアクセス
- DB スキーマ `apps/api/src/db/schema.ts` に Better Auth テーブルを含む
- スポットは trip_days に、trip_days は trips に所属
- 旅行作成時に日付範囲から trip_days を自動生成し、作成者を trip_member として追加
- 旅行/スポットの権限は trip_members テーブルで検証 (checkTripAccess -> canEdit/isOwner)
- メンバーロール: owner (全権限), editor (スポット/旅行の CRUD), viewer (閲覧のみ)
- API のログは pino (`apps/api/src/lib/logger.ts`) を使う。`console.*` は禁止
  - `logger.error({ err, key: val }, "message")` — 第1引数に構造化データ、第2引数にメッセージ
  - エラーオブジェクトは `{ err }` キーで渡す (pino がスタックトレースをシリアライズする)
  - `requestLogger` middleware が requestId/method/path/status/duration を自動記録

## 開発環境

- 初回セットアップ: `bun install && supabase start && bun run db:migrate && bun run db:seed`
- ローカル Supabase 起動: `supabase start`
- Web + API: `bun run --filter @sugara/web dev` (localhost:3000)
- API エンドポイント: http://localhost:3000/api
- Supabase Studio: http://127.0.0.1:54323
- DB リセット: `supabase db reset && bun run db:migrate && bun run db:seed`
- 結合テスト: `bun run --filter @sugara/api test:integration` (PostgreSQL の `sugara_test` DB が必要)

## デプロイ

- Vercel へのデプロイは push 時に自動実行
- `turbo-ignore` により `@sugara/web` とその依存 (`@sugara/api`, `@sugara/shared`) に変更がない場合はスキップされる
- コミットメッセージで CI / デプロイをスキップできる
  - `[skip ci]`: Vercel **と** GitHub Actions の両方をスキップ（ドキュメントのみの変更に使う）
  - `[skip deploy]`: Vercel のみスキップ、GitHub Actions は動く（デスクトップリリース時に使う）
  - 例: `docs: CLAUDE.mdを更新 [skip ci]`
  - 例: `chore: デスクトップアプリ v0.2.0 にバージョンアップ [skip deploy]`

## デスクトップアプリのリリース

`tauri.conf.json` の `version` を変更して main に push するとリリースできる。

```
1. tauri.conf.json の version を更新 (例: "0.1.0" → "0.2.0")
2. tauri.conf.json の userAgent も同じバージョンに更新
3. Cargo.toml の version も同じ値に更新
4. コミット & push
5. desktop-tag.yml が自動で desktop-v<version> タグを作成
6. desktop-build.yml がタグをトリガーにビルド・リリース
7. バイナリが u-stem/sugara-releases に公開される
```

- バージョンが既にタグ済みの場合は何もしない（冪等）
- `apps/desktop/` のみの変更は Vercel の `turbo-ignore` がスキップするため Web ビルドは不要
- バージョン方針: patch（0.1.x）= バグ修正・軽微な改善、minor（0.x.0）= 新機能、major（x.0.0）= 破壊的変更

## 規約

- Conventional Commits: `<type>: <日本語の説明>`
- TDD: Red -> Green -> Refactor
- コード内の言語: 英語 (コメントは What でなく Why を書く)
- デッドコード禁止、TODO は Issue 化する
- `biome-ignore` による lint 抑制禁止。根本的に修正する
- Git フック (lefthook): `bun install` で自動セットアップ。`--no-verify` でのスキップ禁止

## Supabase Realtime

- チャンネルの一時利用（subscribe → send → removeChannel）では、`cleaned` フラグで `removeChannel` の二重呼び出しを防ぐ。SDK の `removeChannel` は `CLOSED` コールバックを再発火するため、ガードなしでは無限再帰になる
- Realtime チャンネルのテストモックでは `removeChannel` 呼び出し時に `_emitStatus("CLOSED")` を発火させ、SDK の実際の副作用を再現する（`use-trip-sync.test.ts`, `use-friends-sync.test.ts` 参照）

## FAQ メンテナンス

機能を追加・変更したときは、そのユーザーが持ちそうな疑問を考え、`apps/api/src/db/seed-faqs.ts` を同じコミットで更新する。
`JA_FAQS` と `EN_FAQS` の両方にエントリを追加し、適切な `sortOrder` を設定する（`resolveCategory` でカテゴリが自動付与される）。
更新後は `bun run --filter @sugara/api db:seed-faqs` を実行してローカル DB に反映する。

- 新機能の追加 → ja と en の両方に新しい FAQ エントリを追加
- 機能の仕様変更 → 既存エントリの answer を ja/en 両方で更新
- 機能の削除 → 該当エントリを ja/en 両方で削除
- カテゴリの追加 → `resolveCategory` の sortOrder マッピングと `messages/{ja,en}.json` の `faq.category` を更新

## お知らせ (News) メンテナンス

機能を追加・変更したときは `apps/web/content/news/ja/YYYY-MM-DD-<topic>.md` と `apps/web/content/news/en/YYYY-MM-DD-<topic>.md` にお知らせ記事を追加する。
既存の記事で記述が古くなったもの（機能の場所が変わった等）も同じコミットで ja/en 両方を修正する。

- 新機能の追加 → ja と en の両方に新しい記事を作成
- 既存機能の変更 → 影響する過去の記事を ja/en 両方で修正

## README バッジメンテナンス

README の静的バッジ (Next.js, Hono, Tauri 等) はメジャーバージョン更新時に手動で更新する。
動的バッジ (CI, Vercel, Commit Activity 等) は自動更新されるため対応不要。

- 依存パッケージのメジャーバージョンアップ → README のバッジのバージョン番号を更新

## DB スキーマ変更

スキーマ変更は必ず migration 経由で行う。`db:push` は削除済み (migration 追跡が壊れるため)。

```bash
# 1. schema.ts を変更する
# 2. migration ファイルを生成
bun run db:generate

# 3. ローカル DB に適用
bun run db:migrate
```

本番 DB への適用は **Vercel デプロイ時に自動実行** される (`apps/web/vercel.json` の buildCommand)。
`MIGRATION_URL` 環境変数が Vercel に設定されていること (Supabase の Direct Connection URL)。

## ドキュメント構成

```
docs/
  architecture/
    overview.md            全体像・インフラ構成図・技術スタック・デプロイ
    db-backup-recovery.md  DB バックアップ・リカバリ手順
```

- 設計ドキュメントは「現在の状態」を反映する。古い計画書は git 履歴に残し、docs/ には置かない
- コード変更時にドキュメントが乖離したら同じコミットで更新する

## 計画ドキュメントの運用

大きな機能開発や設計変更を行う場合、計画ドキュメントを作成して実装する。

1. **計画を作成** → `docs/plans/<topic>.md` に保存
2. **計画に沿って実装** → タスクごとにチェックボックスを更新
3. **実装完了後に計画を削除** → 完了した計画は git 履歴に残る
4. **必要に応じて設計ドキュメントを更新** → `docs/architecture/` を最新に保つ

計画ファイルは一時的な作業用ドキュメントであり、リポジトリに残すべき永続的な資料ではない。
