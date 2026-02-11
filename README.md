# sugara

旅行計画Webアプリケーション。

## 技術スタック

- **モノレポ**: Turborepo + bun workspaces
- **フロントエンド**: Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
- **API**: Hono (bun runtime)
- **データベース**: PostgreSQL + Drizzle ORM
- **認証**: Better Auth (メール/パスワード)
- **バリデーション**: Zod (共有スキーマ)
- **リンター/フォーマッター**: Biome
- **Git フック**: lefthook (pre-commit / commit-msg / pre-push)
- **地図**: Leaflet + react-leaflet

## セットアップ

### 前提条件

- [bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/)

### 初回セットアップ

```bash
bun install
bun run setup
```

PostgreSQL + API サーバーを起動し、スキーマ反映とシードデータ投入を行う。
`bun install` 時に lefthook が自動でインストールされ、Git フックが有効になる。

### 開発

```bash
docker compose up -d                   # DB + API を起動
bun run --filter @sugara/web dev       # フロントエンドを起動
```

- Web: http://localhost:3000
- API: http://localhost:3001 (ホットリロード有効)

### データベースリセット

```bash
docker compose down -v
bun run setup
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
bun run setup        # 初回セットアップ (Docker)
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
│   ├── web/          # Next.js フロントエンド
│   └── api/          # Hono API サーバー
├── packages/
│   └── shared/       # 共有 Zod スキーマ・型定義
├── biome.json        # Biome 設定 (lint/format)
├── lefthook.yml      # Git フック設定
├── turbo.json        # Turborepo 設定
└── docker-compose.yml
```
