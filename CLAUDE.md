# sugara - 旅行計画アプリ

## プロジェクト概要

旅行計画Webアプリ。Turborepo + bun workspaces によるモノレポ構成。

## 構成

```
apps/web/         Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui + Hono API (Route Handler)
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
bun run db:push      # DB スキーマ反映
bun run db:generate  # マイグレーション生成
bun run db:migrate   # マイグレーション実行
bun run db:studio    # Drizzle Studio 起動
bun run db:seed      # 開発用シードデータ投入
bun run db:seed-user # 本番用ユーザー作成 (環境変数で指定)
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
- フロントエンド: Next.js 15, React 19, Tailwind CSS v4, shadcn/ui (New York, Zinc)
- API: Hono (Next.js Route Handler `apps/web/app/api/[[...route]]/route.ts` として統合)
- DB: Supabase PostgreSQL + Drizzle ORM
- リアルタイム同期: Supabase Realtime (Broadcast + Presence)
- 認証: Better Auth (メール/パスワード, 招待制, `advanced.database.generateId: "uuid"`)
- バリデーション: Zod (packages/shared で共有)
- リンター/フォーマッター: Biome (ルートに biome.json、各パッケージから turbo 経由で実行)
- テスト: Vitest
- Git フック: lefthook (pre-commit: check + check-types, commit-msg: Conventional Commits, pre-push: test)
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

## 開発環境

- 初回セットアップ: `bun install && supabase start && bun run db:push && bun run db:seed`
- ローカル Supabase 起動: `supabase start`
- Web + API: `bun run --filter @sugara/web dev` (localhost:3000)
- API エンドポイント: http://localhost:3000/api
- Supabase Studio: http://127.0.0.1:54323
- DB リセット: `supabase db reset && bun run db:push && bun run db:seed`
- 結合テスト: `bun run --filter @sugara/api test:integration` (PostgreSQL の `sugara_test` DB が必要)

## 規約

- Conventional Commits: `<type>: <日本語の説明>`
- TDD: Red -> Green -> Refactor
- コード内の言語: 英語 (コメントは What でなく Why を書く)
- デッドコード禁止、TODO は Issue 化する
- `biome-ignore` による lint 抑制禁止。根本的に修正する
- Git フック (lefthook): `bun install` で自動セットアップ。`--no-verify` でのスキップ禁止
