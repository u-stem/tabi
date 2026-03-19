# 全体設計

## システム構成図

```mermaid
graph LR
    subgraph client["クライアント"]
        Web["Web ブラウザ<br/>(PWA / Web Push)"]
        Desktop["デスクトップアプリ<br/>(Tauri v2)"]
    end

    subgraph vercel["Vercel"]
        NextJS["Next.js 16<br/>(App Router / SSR)"]
        Hono["Hono API<br/>(Route Handler / Better Auth)"]
        NextJS --> Hono
    end

    subgraph supabase["Supabase"]
        PG[("PostgreSQL<br/>(Drizzle ORM)")]
        Realtime["Realtime<br/>(Broadcast / Presence)"]
        Storage["Storage"]
    end

    subgraph external["外部サービス"]
        Edge["Vercel Edge Config"]
        Maps["Google Maps API"]
        GitHub["GitHub API"]
    end

    Web -->|HTTPS| NextJS
    Desktop -->|HTTPS| NextJS
    Web <-.->|WebSocket| Realtime
    Hono -->|SQL| PG
    Hono -->|REST| Storage
    Hono -->|REST| Edge
    Hono -->|REST| Maps
    Hono -->|REST| GitHub
```

```mermaid
graph LR
    subgraph cicd["CI/CD"]
        Actions["GitHub Actions"]
        Dependabot["Dependabot<br/>(npm / Cargo / Actions)"]
    end

    Actions -.->|deploy| Vercel["Vercel"]
    Actions -.->|release| Desktop["デスクトップアプリ"]
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| API | Hono (Next.js Route Handler として統合) |
| データベース | Supabase PostgreSQL + Drizzle ORM |
| リアルタイム | Supabase Realtime (Broadcast + Presence) |
| 認証 | Better Auth (メール/パスワード、管理者が新規登録を制御) |
| バリデーション | Zod (shared パッケージで共有) |
| デスクトップ | Tauri (macOS + Windows) |
| CI/CD | GitHub Actions, Vercel, Dependabot |
| リンター | Biome |
| テスト | Vitest (単体/結合), Playwright (E2E) |

## モノレポ構成

```
sugara/
  apps/
    web/          Next.js フロントエンド + API ルートハンドラ
    api/          Hono API ルート, DB スキーマ, 認証
    desktop/      Tauri デスクトップアプリ (WebView ラッパー)
  packages/
    shared/       Zod スキーマ, 型定義, 定数
```

`apps/web` がデプロイ対象。`apps/api` は `apps/web/app/api/[[...route]]/route.ts` で Route Handler として統合される。`packages/shared` で型とバリデーションスキーマを共有。

## リクエストフロー

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant M as Next.js Middleware<br/>(proxy.ts)
    participant P as Next.js ページ<br/>(SSR/CSR)
    participant H as Hono API<br/>(Route Handler)
    participant DB as PostgreSQL

    B->>M: GET /home
    M->>M: /api/auth/get-session でセッション確認
    M->>P: 認証済み → ページ描画
    P->>B: HTML + JS

    B->>H: GET /api/trips
    H->>H: requireAuth ミドルウェア
    H->>DB: SELECT trips...
    DB-->>H: rows
    H-->>B: JSON レスポンス
```

## リアルタイム通信

認証ユーザーと共有リンク閲覧者を2種類のチャンネルで分離:

```mermaid
graph TB
    subgraph members["認証ユーザー (旅行メンバー)"]
        M1[メンバー A]
        M2[メンバー B]
        CH1["trip:{tripId}"]
    end

    subgraph shared["共有リンク閲覧者"]
        SV[閲覧者]
        CH2["trip-shared:{shareToken}"]
    end

    M1 <-->|Presence + Broadcast| CH1
    M2 <-->|Presence + Broadcast| CH1
    SV -->|Broadcast 受信のみ| CH2
    M1 -.->|broadcastChange| CH2
```

- `trip:{tripId}` -- メンバー専用チャンネル。Presence (オンライン状況) と相互 Broadcast
- `trip-shared:{shareToken}` -- 共有閲覧者が更新通知を受信。tripId を知らないため Presence 汚染を防止

## 認証モデル

- **Better Auth** によるメール/パスワード認証
- サインアップは管理者が開放/停止を制御 (appSettings テーブル)
- ゲストアカウント: 旅行1件まで、フレンド/ブックマーク/グループは利用不可
- 管理者: 環境変数 `ADMIN_USER_ID` で識別

## デプロイ

```mermaid
graph TD
    Push[git push main] --> CI[GitHub Actions<br/>lint + 型チェック + テスト]
    Push --> Vercel[Vercel Build<br/>migrate + seed-faqs + next build]
    Push --> Tag{version 変更?}
    Tag -->|yes| TagCI[desktop-tag.yml<br/>タグ作成]
    TagCI --> Build[desktop-build.yml<br/>Tauri ビルド]
    Build --> Release[GitHub Release<br/>公開リポジトリ]
```

- Web: main への push で Vercel が自動デプロイ。`turbo-ignore` で関連変更がなければスキップ
- デスクトップ: `tauri.conf.json` のバージョン変更 → タグ作成 → ビルド → リリース
- DB マイグレーションは Vercel ビルド時に `MIGRATION_URL` (Direct Connection) 経由で自動実行
