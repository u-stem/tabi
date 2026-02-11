# Supabase + Vercel Deploy Design

## Goal

Supabase (PostgreSQL + Realtime) と Vercel にデプロイする。
ローカル開発は `supabase start` + `vercel dev` に移行し、Docker Compose を廃止する。

## Current Architecture

```
[Browser] -> [Next.js (localhost:3000)]
          -> [Hono API + WebSocket (Docker, localhost:3001)]
          -> [PostgreSQL (Docker)]
```

- API: Hono on bun with WebSocket (`createBunWebSocket`)
- DB: PostgreSQL 16 (Docker)
- Auth: Better Auth (session cookie)
- Realtime: Custom WebSocket (broadcast + presence + heartbeat)

## Target Architecture

```
[Browser] -> [Vercel (Next.js + Hono API as Route Handler)]
          -> [Supabase PostgreSQL]
          -> [Supabase Realtime (Broadcast + Presence)]
```

- API: Hono on Vercel Functions (Next.js Route Handler 統合)
- DB: Supabase PostgreSQL (Transaction pooler 経由)
- Auth: Better Auth (変更なし、DB 接続先のみ変更)
- Realtime: Supabase Realtime (Broadcast + Presence)

## Key Decisions

| 項目 | 決定 | 理由 |
|------|------|------|
| API ホスティング | Vercel Functions (Next.js 統合) | CORS 不要、Cookie 共有が自然、インフラ統一 |
| DB | Supabase PostgreSQL | 無料枠 500MB、Drizzle ORM 互換 |
| Auth | Better Auth のまま | 変更最小限 |
| Realtime | Supabase Realtime (Broadcast + Presence) | WebSocket サーバー不要、無料枠で十分 |
| ローカル開発 | `supabase start` + `vercel dev` | 本番と同一構成 |
| Vercel 構成 | 1プロジェクト (Next.js + API 統合) | CORS 不要、環境変数管理がシンプル |
| Supabase 構成 | 1プロジェクト (本番相当) | 無料枠 2 プロジェクトなので節約。ローカルは `supabase start` |

## DB Connection

Supabase は 2 種類の接続を提供:
- **Transaction pooler** (port 6543): アプリ用。Serverless 環境に必須
- **Direct connection** (port 5432): マイグレーション用

```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
MIGRATION_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.supabase.com:5432/postgres
```

## API Integration

現在の `apps/api` の Hono ルートを Next.js Route Handler に統合:

```
apps/web/app/api/[[...route]]/route.ts
  -> import { app } from "@tabi/api"
  -> handle(app) で Vercel Functions として実行
```

`apps/api` はパッケージとして残し、Hono app をエクスポートする。
WebSocket 関連コード (`ws/` ディレクトリ、broadcast 呼び出し) は削除。

## Realtime Migration

カスタム WebSocket を Supabase Realtime に置き換え:

### Broadcast (データ変更通知)
API でデータ変更 -> クライアントが API レスポンス受信後に Broadcast イベント送信 -> 他クライアントが受信して再取得

```ts
const channel = supabase.channel(`trip:${tripId}`);
channel.on("broadcast", { event: "trip:updated" }, () => {
  // refetch data
});
channel.send({ type: "broadcast", event: "trip:updated", payload: {} });
```

### Presence (誰がどこを見ているか)
Supabase Realtime の Presence 機能で置き換え:

```ts
channel.on("presence", { event: "sync" }, () => {
  const state = channel.presenceState();
});
channel.track({ userId, name, dayId: null, patternId: null });
```

### Deleted Code
- `apps/api/src/ws/handler.ts`
- `apps/api/src/ws/rooms.ts`
- `apps/api/src/ws/types.ts`
- `apps/api/src/index.ts` (bun server entry, replaced by Route Handler)
- All `broadcastTripUpdate()` calls in route handlers

## Local Development

```bash
brew install supabase/tap/supabase   # Initial setup
bun install                          # Dependencies + lefthook
supabase start                       # Local Supabase (PostgreSQL + Realtime)
bun run db:push                      # Apply schema
bun run db:seed                      # Seed data
vercel dev                           # Next.js + API
```

`supabase start` outputs local credentials (API URL, anon key, DB URL).
`.env.local` references these for local development.

## Deleted Infrastructure

- `docker-compose.yml`
- `scripts/setup.ts`
- `apps/api/src/index.ts` (bun server entry)
- `apps/api/src/ws/` directory

## Deployment

### Vercel + GitHub 連携

GitHub リポジトリを Vercel に接続し、`main` への push で自動デプロイ。
PR ごとにプレビューデプロイも自動生成される。
lefthook の pre-push でテストが通るため、品質ゲート付き。

### Vercel プロジェクト設定

- Root Directory: `apps/web`
- Framework: Next.js (自動検出)
- Build Command: `bun run build` (turbo 経由)
- Install Command: `bun install`

## Secret Management

### Environment Variables

| 変数 | 用途 | 公開 | 設定場所 |
|------|------|------|---------|
| `DATABASE_URL` | Supabase PostgreSQL (pooler) | No | Vercel env vars |
| `MIGRATION_URL` | Supabase PostgreSQL (direct) | No | ローカルのみ |
| `BETTER_AUTH_SECRET` | セッション暗号化キー | No | Vercel env vars |
| `BETTER_AUTH_BASE_URL` | Auth ベース URL | No | Vercel env vars |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | Yes (フロント) | Vercel env vars |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー | Yes (フロント) | Vercel env vars |

### Principles

- `NEXT_PUBLIC_` プレフィックスはブラウザに露出する。Supabase anon key は RLS 前提で安全
- `SUPABASE_SERVICE_ROLE_KEY` は不要 (Drizzle で直接 DB 接続するため)
- ローカルは `supabase start` 出力値を `.env.local` に設定 (`.gitignore` 済み)
- Vercel の環境変数は Dashboard から設定。git に含めない
- `.env.example` を用意し、必要な変数名のみ記載

## Auth Policy

公開デプロイにあたり、サインアップを無効化して招待制にする。
現在はメールアドレスの検証なしに誰でもサインアップできるため、不正利用のリスクがある。

- サインアップ UI (`/auth/signup`) を削除またはアクセス不可にする
- seed スクリプトで自分のアカウントのみ作成
- 将来的に OAuth や招待機能を追加する場合は別計画で対応

## Cost (Free Tier)

### Vercel Hobby
- Deployments: 100/day
- Function invocations: 1M/month
- Function duration: max 60s
- Build: 6,000 min/month

### Supabase Free
- Projects: 2
- DB storage: 500MB
- Realtime connections: 200 concurrent
- Realtime messages: 2M/month
- Pause after 1 week of inactivity
