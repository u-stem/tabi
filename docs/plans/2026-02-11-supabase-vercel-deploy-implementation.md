# Supabase + Vercel Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Supabase (PostgreSQL + Realtime) と Vercel にデプロイし、ローカル開発を `supabase start` + `vercel dev` に移行する

**Architecture:** Hono API を Next.js Route Handler に統合し、カスタム WebSocket を Supabase Realtime (Broadcast + Presence) に置き換える。Docker Compose を廃止し、Supabase CLI + Vercel CLI ベースの開発環境に移行する

**Tech Stack:** Supabase (PostgreSQL, Realtime), Vercel (Functions, Hosting), Hono, Next.js 15, Drizzle ORM, Better Auth

---

## Context

設計ドキュメント: `docs/plans/2026-02-11-supabase-vercel-deploy-design.md`

現在の構成:
- API: Hono on bun (Docker) + カスタム WebSocket
- DB: PostgreSQL (Docker)
- Auth: Better Auth (メール/パスワード、サインアップ制限なし)
- Frontend: Next.js (ローカル起動)

移行後:
- API: Hono on Vercel Functions (Next.js Route Handler 統合)
- DB: Supabase PostgreSQL (Transaction pooler)
- Realtime: Supabase Realtime (Broadcast + Presence)
- Auth: Better Auth (招待制、サインアップ無効化)
- ローカル: `supabase start` + `vercel dev`

---

### Task 1: Supabase CLI セットアップ

**Files:**
- Create: `supabase/config.toml` (supabase init で自動生成)
- Modify: `.gitignore`

**Step 1: Supabase CLI がインストール済みか確認**

Run: `supabase --version`
Expected: バージョン番号が表示される。未インストールなら `brew install supabase/tap/supabase`

**Step 2: supabase init を実行**

Run: `supabase init`
Expected: `supabase/` ディレクトリと `supabase/config.toml` が生成される

**Step 3: .gitignore に Supabase ローカルデータを追加**

`.gitignore` に追加:
```
# Supabase
supabase/.temp/
```

**Step 4: supabase start でローカル環境を起動**

Run: `supabase start`
Expected: PostgreSQL, Realtime などのサービスが Docker で起動し、接続情報が出力される

**Step 5: 接続情報を確認**

Run: `supabase status`
Expected: DB URL, API URL, anon key, service_role key が表示される

---

### Task 2: DB 接続の Supabase 移行

**Files:**
- Modify: `apps/api/src/db/index.ts`
- Modify: `apps/api/drizzle.config.ts`
- Create: `.env.local`
- Create: `.env.example`

**Step 1: .env.example を作成**

```
# Supabase
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
MIGRATION_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status で取得>

# Better Auth
BETTER_AUTH_SECRET=dev-secret-change-in-production
BETTER_AUTH_BASE_URL=http://localhost:3000

# Frontend
FRONTEND_URL=http://localhost:3000
```

**Step 2: .env.local を作成**

`supabase status` の出力値で `.env.local` を作成 (`.env.example` をコピーして実値を設定)

**Step 3: drizzle.config.ts を修正**

DB URL の参照先を変更:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MIGRATION_URL || process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
});
```

**Step 4: db/index.ts を修正**

デフォルト接続先を Supabase ローカルに変更:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export type Database = typeof db;
```

**Step 5: ローカル Supabase にスキーマを反映**

Run: `bun run db:push`
Expected: 全テーブルが作成される

**Step 6: seed データを投入**

Run: `bun run db:seed`
Expected: テストデータが投入される

**Step 7: 既存のユニットテストが通ることを確認**

Run: `bun run --filter @sugara/api test`
Expected: 全テスト PASS (テストは vi.mock で DB をモックしているため接続先に依存しない)

---

### Task 3: WebSocket コードの削除

**Files:**
- Delete: `apps/api/src/ws/handler.ts`
- Delete: `apps/api/src/ws/rooms.ts`
- Delete: `apps/api/src/ws/types.ts`
- Delete: `apps/api/src/index.ts`
- Modify: `apps/api/src/app.ts` (WebSocket 登録を削除)
- Modify: `apps/api/src/routes/trips.ts` (broadcast 削除)
- Modify: `apps/api/src/routes/schedules.ts` (broadcast 削除)
- Modify: `apps/api/src/routes/patterns.ts` (broadcast 削除)
- Modify: `apps/api/src/routes/candidates.ts` (broadcast 削除)
- Modify: `apps/api/src/lib/constants.ts` (WS close codes 削除)
- Modify: `apps/api/package.json` (scripts 調整)

**Step 1: ws/ ディレクトリを削除**

`apps/api/src/ws/` を完全に削除

**Step 2: 各ルートファイルから broadcast 関連コードを削除**

以下の全ルートファイルで:
- `import { broadcastToTrip } from "../ws/rooms"` を削除
- `broadcastToTrip(...)` の呼び出しを全て削除
- `import type { ServerMessage } from "../ws/types"` を削除

対象ファイル:
- `apps/api/src/routes/trips.ts`
- `apps/api/src/routes/schedules.ts`
- `apps/api/src/routes/patterns.ts`
- `apps/api/src/routes/candidates.ts`

**Step 3: apps/api/src/index.ts を削除**

bun サーバーエントリポイントを削除 (Route Handler に置き換わるため)

**Step 4: constants.ts から WS 関連コードを削除**

`WS_CLOSE_CODE` を削除。他に使われていなければファイルごと削除。

**Step 5: app.ts の確認**

`app.ts` は WebSocket 登録を直接含んでいない (`index.ts` で `registerWebSocket` を呼んでいた)。
`app.ts` はそのまま Hono app をエクスポートする形で維持。

**Step 6: package.json の scripts を調整**

`apps/api/package.json` の `dev` スクリプト (`bun run --hot src/index.ts`) を削除。
`index.ts` が消えるため不要。

**Step 7: テストを実行**

Run: `bun run --filter @sugara/api test`
Expected: ws 関連テストがあれば削除が必要。broadcast をモックしているテストは修正が必要。

**Step 8: コミット**

```
refactor: WebSocket コードを削除 (Supabase Realtime に移行準備)
```

---

### Task 4: Hono API を Next.js Route Handler に統合

**Files:**
- Create: `apps/web/app/api/[[...route]]/route.ts`
- Modify: `apps/api/src/app.ts` (エクスポート調整)
- Modify: `apps/web/package.json` (api パッケージ依存追加)
- Modify: `apps/web/lib/api.ts` (API URL を相対パスに変更)
- Modify: `apps/web/lib/auth-client.ts` (baseURL 変更)
- Modify: `apps/api/src/lib/auth.ts` (baseURL 変更)

**Step 1: apps/api/src/app.ts でエクスポートを確認**

現在 `app` をエクスポートしていることを確認。
CORS の origin を環境変数で制御できていることを確認。
同一オリジンになるため CORS 設定の調整が必要になる可能性がある。

**Step 2: apps/web/package.json に @sugara/api を依存に追加**

```json
"dependencies": {
  "@sugara/api": "workspace:*",
  ...
}
```

**Step 3: Route Handler を作成**

`apps/web/app/api/[[...route]]/route.ts`:
```ts
import { handle } from "hono/vercel";
import { app } from "@sugara/api/src/app";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
```

**Step 4: フロントエンド API クライアントを修正**

`apps/web/lib/api.ts`:
- `NEXT_PUBLIC_API_URL` のデフォルトを `""` (空文字 = 相対パス) に変更
- これにより `/api/trips/...` のように同一オリジンでリクエストされる

**Step 5: Better Auth の baseURL を修正**

`apps/api/src/lib/auth.ts`:
- `baseURL` のデフォルトを `http://localhost:3000` に変更 (同一オリジン)

`apps/web/lib/auth-client.ts`:
- `baseURL` を `/api/auth` または環境変数で制御

**Step 6: CORS 設定の調整**

同一オリジンの場合 CORS は不要だが、ローカル開発で `vercel dev` を使う場合も同一オリジンになるため、
CORS ミドルウェアを環境変数で制御するか、同一オリジン時はスキップするよう調整。

**Step 7: vercel dev で動作確認**

Run: `vercel dev`
Expected: Next.js + API が同一ポートで起動し、`/api/health` にアクセスできる

**Step 8: コミット**

```
feat: Hono API を Next.js Route Handler に統合
```

---

### Task 5: Supabase Realtime 導入 (Broadcast + Presence)

**Files:**
- Modify: `apps/web/package.json` (@supabase/supabase-js 追加)
- Create: `apps/web/lib/supabase.ts` (Supabase クライアント初期化)
- Rewrite: `apps/web/lib/hooks/use-trip-sync.ts` (Supabase Realtime に書き換え)

**Step 1: @supabase/supabase-js を追加**

Run: `bun add --filter @sugara/web @supabase/supabase-js`

**Step 2: Supabase クライアントを作成**

`apps/web/lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 3: use-trip-sync.ts を Supabase Realtime で書き換え**

現在の WebSocket ロジックを完全に置き換え:
- `supabase.channel(`trip:${tripId}`)` でチャンネル作成
- Broadcast: `trip:updated` イベントで sync callback を呼ぶ
- Presence: `track()` で現在のユーザー情報を送信、`presenceState()` で全員の状態を取得
- クリーンアップ: `channel.unsubscribe()` で退出

返り値のインターフェースは既存と同じ (`presence`, `isConnected`, `updatePresence`) を維持し、
呼び出し側 (trip detail page) の変更を最小限にする。

**Step 4: API レスポンス後の Broadcast 送信**

フロントエンドの API 呼び出し後に Broadcast イベントを送信するユーティリティを作成。
既存の各コンポーネント (schedule, pattern, candidate の CRUD) で API 成功後にイベントを送信。

**Step 5: 動作確認**

`supabase start` + `vercel dev` で起動し:
- データ変更が他のブラウザタブに反映されるか
- プレゼンスが正しく表示されるか

**Step 6: テストの修正**

`use-trip-sync` のテストがあれば Supabase Realtime に合わせて修正。

**Step 7: コミット**

```
feat: Supabase Realtime で Broadcast + Presence を実装
```

---

### Task 6: サインアップ無効化 (招待制)

**Files:**
- Modify: `apps/web/app/auth/signup/page.tsx` (リダイレクトに変更)
- Modify: `apps/web/app/auth/login/page.tsx` (サインアップリンク削除)
- Modify: `apps/web/components/auth-form.tsx` (signup モード削除)
- Modify: `apps/api/src/db/seed.ts` (自分のアカウント作成)

**Step 1: サインアップページをリダイレクト**

`apps/web/app/auth/signup/page.tsx`:
```ts
import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/auth/login");
}
```

**Step 2: ログインページからサインアップリンクを削除**

`apps/web/app/auth/login/page.tsx`:
「アカウントをお持ちでない方」リンクを削除。

**Step 3: auth-form.tsx から signup モードを削除**

signup 関連のコードを削除し、login のみに簡素化。

**Step 4: seed スクリプトで自分のアカウントを作成**

`apps/api/src/db/seed.ts` を修正し、Better Auth の API を使って自分のアカウントを seed に含める。
メールアドレスとパスワードは環境変数 (`SEED_USER_EMAIL`, `SEED_USER_PASSWORD`) から取得。

**Step 5: テスト**

ログインページにアクセスしてログインできること、`/auth/signup` がログインにリダイレクトされることを確認。

**Step 6: コミット**

```
feat: サインアップ無効化 (招待制に変更)
```

---

### Task 7: Docker Compose 廃止とセットアップ更新

**Files:**
- Delete: `docker-compose.yml`
- Delete: `scripts/setup.ts`
- Modify: `package.json` (scripts 更新)
- Create: `.env.example` (最終版)
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: docker-compose.yml を削除**

**Step 2: scripts/setup.ts を削除**

**Step 3: package.json の scripts を更新**

- `setup` スクリプトを削除
- `db:push` / `db:seed` は Supabase ローカル DB に対して実行されるため維持
- `dev` スクリプトは不要 (vercel dev を直接使う)

**Step 4: .env.example を最終版にする**

Task 2 で作成したものを最終確認。

**Step 5: README.md を更新**

セットアップ手順を `supabase start` + `vercel dev` に書き換え。
Docker 関連の記述を削除。

**Step 6: CLAUDE.md を更新**

技術スタック、開発環境、コマンドの記述を更新。

**Step 7: コミット**

```
chore: Docker Compose 廃止と開発環境を Supabase + Vercel に移行
```

---

### Task 8: Vercel デプロイ

**Files:**
- Create: `vercel.json` (必要に応じて)
- Modify: `apps/web/next.config.ts` (必要に応じて)

**Step 1: Vercel に GitHub リポジトリを接続**

Vercel Dashboard でプロジェクトを作成:
- Import Git Repository
- Root Directory: `apps/web`
- Framework Preset: Next.js
- Build Command: デフォルト (`next build`)
- Install Command: `bun install` (ルートから実行されるよう調整)

**Step 2: 環境変数を設定**

Vercel Dashboard > Settings > Environment Variables:
- `DATABASE_URL`: Supabase の Transaction pooler URL
- `BETTER_AUTH_SECRET`: 本番用シークレット (ランダム生成)
- `BETTER_AUTH_BASE_URL`: Vercel のデプロイ URL
- `FRONTEND_URL`: Vercel のデプロイ URL
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase プロジェクトの API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase プロジェクトの anon key

**Step 3: Supabase クラウドにスキーマを反映**

`MIGRATION_URL` に Supabase の Direct connection URL を設定し:
Run: `MIGRATION_URL=<direct_url> bun run db:push`

**Step 4: Supabase クラウドに seed データを投入**

Run: `DATABASE_URL=<pooler_url> SEED_USER_EMAIL=<email> SEED_USER_PASSWORD=<password> bun run db:seed`

**Step 5: デプロイ実行**

Run: `git push` (Vercel が自動デプロイ)
または Vercel Dashboard から手動デプロイ

**Step 6: 動作確認**

- ログインできるか
- 旅行の作成・編集・削除ができるか
- Realtime (Broadcast + Presence) が動作するか
- 共有リンクが機能するか

**Step 7: コミット (vercel.json など追加があれば)**

```
chore: Vercel デプロイ設定
```

---

## Verification

1. `supabase start` + `vercel dev` でローカル開発が動作する
2. ログイン/ログアウトが機能する (`/auth/signup` はリダイレクト)
3. 旅行 CRUD が Supabase PostgreSQL で動作する
4. Supabase Realtime で Broadcast + Presence が動作する
5. Vercel にデプロイされ、本番環境で全機能が動作する
6. `bun run test` で全テストが PASS する
7. `bun run check` + `bun run check-types` が通る
