# tabi - 旅行計画アプリ

## プロジェクト概要

旅行計画Webアプリ。Turborepo + bun workspaces によるモノレポ構成。

## 構成

```
apps/web/         Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
apps/api/         Hono API サーバー (bun runtime)
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
bun run setup        # 初回セットアップ (Docker)
```

パッケージ単位の実行は `--filter` を使用:

```bash
bun run --filter @tabi/api test
bun run --filter @tabi/web lint
bun run --filter @tabi/shared check-types
```

**`cd <dir> && ...` パターンは絶対に使わない。常に `bun run` または `bun run --filter` を使う。**
**`bunx` は使わない。全ツールは package.json スクリプトで定義済み。**

## 技術スタック

- ランタイム: bun
- フロントエンド: Next.js 15, React 19, Tailwind CSS v4, shadcn/ui (New York, Zinc)
- バックエンド: Hono on bun
- DB: PostgreSQL + Drizzle ORM
- 認証: Better Auth (メール/パスワード, `advanced.database.generateId: "uuid"`)
- バリデーション: Zod (packages/shared で共有)
- リンター/フォーマッター: Biome (ルートに biome.json、各パッケージから turbo 経由で実行)
- テスト: Vitest
- Git フック: lefthook (pre-commit: check + check-types, commit-msg: Conventional Commits, pre-push: test)
- 地図: Leaflet + react-leaflet

## 主要パターン

- 全 API ルートで `requireAuth` ミドルウェアが必要 (ヘルスチェックと共有旅行ビューを除く)
- Zod スキーマは `packages/shared/src/schemas/` に配置し、API とフロントエンドの両方で使用
- API クライアント `apps/web/lib/api.ts` が認証 Cookie を自動処理 (`ApiError` クラスでステータスコード管理)
- DB スキーマ `apps/api/src/db/schema.ts` に Better Auth テーブルを含む
- スポットは trip_days に、trip_days は trips に所属
- 旅行作成時に日付範囲から trip_days を自動生成し、作成者を trip_member として追加
- 旅行/スポットの権限は trip_members テーブルで検証 (checkTripAccess -> canEdit/isOwner)
- メンバーロール: owner (全権限), editor (スポット/旅行の CRUD), viewer (閲覧のみ)

## 開発環境

- 初回セットアップ: `bun run setup` (Docker で DB + API 起動、スキーマ反映、シード投入)
- DB + API 起動: `docker compose up -d`
- Web: `bun run --filter @tabi/web dev` (localhost:3000)
- API ホットリロード: 有効 (Docker 内でソース変更が自動反映)
- 全起動: `docker compose up -d && bun run --filter @tabi/web dev`
- DB リセット: `docker compose down -v && bun run setup`
- 結合テスト: `bun run --filter @tabi/api test:integration` (PostgreSQL の `tabi_test` DB が必要)

## 規約

- Conventional Commits: `<type>: <日本語の説明>`
- TDD: Red -> Green -> Refactor
- コード内の言語: 英語 (コメントは What でなく Why を書く)
- デッドコード禁止、TODO は Issue 化する
- `biome-ignore` による lint 抑制禁止。根本的に修正する
- Git フック (lefthook): `bun install` で自動セットアップ。`--no-verify` でのスキップ禁止
