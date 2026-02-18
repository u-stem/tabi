# sugara

旅行計画Webアプリケーション。

## 技術スタック

- **モノレポ**: Turborepo + bun workspaces
- **フロントエンド**: Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
- **API**: Hono (Next.js Route Handler 統合)
- **データベース**: Supabase PostgreSQL + Drizzle ORM
- **リアルタイム同期**: Supabase Realtime (Broadcast + Presence)
- **認証**: Better Auth (メール/パスワード、招待制)
- **バリデーション**: Zod (共有スキーマ)
- **リンター/フォーマッター**: Biome
- **Git フック**: lefthook (pre-commit / commit-msg / pre-push)
- **デプロイ**: Vercel

## セットアップ

### 前提条件

- [bun](https://bun.sh/) >= 1.0
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Docker](https://www.docker.com/) (Supabase CLI が内部で使用)

### 初回セットアップ

```bash
bun install
supabase start
bun run db:push
bun run db:seed
```

1. `bun install` で依存関係をインストール (lefthook も自動セットアップ)
2. `supabase start` でローカル Supabase を起動 (PostgreSQL, Realtime など)
3. `bun run db:push` で DB スキーマを反映
4. `bun run db:seed` で開発用シードデータを投入

### 環境変数

`apps/web/.env.example` をコピーして `.env.local` を作成:

```bash
cp apps/web/.env.example apps/web/.env.local
```

`supabase status` で取得した値を設定する。

### 開発

```bash
supabase start                        # ローカル Supabase を起動
bun run --filter @sugara/web dev      # Next.js 開発サーバーを起動
```

- Web: http://localhost:3000
- API: http://localhost:3000/api (Next.js Route Handler)
- Supabase Studio: http://127.0.0.1:54323

### データベースリセット

```bash
supabase db reset
bun run db:push
bun run db:seed
```

## スクリプト

プロジェクトルートから実行:

```bash
bun run build        # 全パッケージビルド
bun run test         # 全テスト実行 (Vitest)
bun run lint         # 全パッケージ lint (Biome)
bun run format       # 全パッケージ format (Biome)
bun run check        # lint + format + import sort (Biome)
bun run check-types  # TypeScript 型チェック
bun run db:push      # DB スキーマ反映
bun run db:generate  # マイグレーション生成
bun run db:migrate   # マイグレーション実行
bun run db:studio    # Drizzle Studio 起動
bun run db:seed      # 開発用シードデータ投入
bun run db:seed-user # 本番用ユーザー作成 (環境変数で指定)
```

パッケージ単位の実行:

```bash
bun run --filter @sugara/api test
bun run --filter @sugara/web lint
bun run --filter @sugara/shared check-types
```

## プロジェクト構成

```
sugara/
├── apps/
│   ├── web/          # Next.js フロントエンド + API Route Handler
│   └── api/          # Hono API (Route Handler として統合)
├── packages/
│   └── shared/       # 共有 Zod スキーマ・型定義
├── supabase/         # Supabase CLI 設定
├── biome.json        # Biome 設定 (lint/format)
├── lefthook.yml      # Git フック設定
└── turbo.json        # Turborepo 設定
```
