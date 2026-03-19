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

## CI/CD

```mermaid
graph LR
    subgraph cicd["CI/CD"]
        Actions["GitHub Actions"]
        Dependabot["Dependabot<br/>(npm / Cargo / Actions)"]
    end

    Actions -.->|deploy| Vercel["Vercel"]
    Actions -.->|release| Desktop["デスクトップアプリ"]
```

- Web: main への push で Vercel が自動デプロイ。`turbo-ignore` で関連変更がなければスキップ
- デスクトップ: `tauri.conf.json` のバージョン変更 → タグ作成 → ビルド → リリース
- DB マイグレーションは Vercel ビルド時に `MIGRATION_URL` (Direct Connection) 経由で自動実行

## 認証モデル

- **Better Auth** によるメール/パスワード認証
- サインアップは管理者が開放/停止を制御 (appSettings テーブル)
- ゲストアカウント: 旅行1件まで、フレンド/ブックマーク/グループは利用不可
- 管理者: 環境変数 `ADMIN_USER_ID` で識別
