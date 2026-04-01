---
name: db-schema-change
description: DB スキーマ変更の手順（schema.ts 編集 → migration 生成 → 適用 → テスト）
---

# DB スキーマ変更ワークフロー

以下の手順を順番に実行する。

## 1. スキーマを編集

`apps/api/src/db/schema.ts` を編集する。

## 2. 型チェック

```bash
bun run --filter @sugara/api check-types
```

型エラーがあれば修正する。スキーマ変更に伴い API ルートやテストで型エラーが出る場合、ここで合わせて修正する。

## 3. マイグレーションファイルを生成

```bash
bun run db:generate
```

生成された SQL ファイル (`apps/api/drizzle/` 配下) の内容を確認し、意図通りか検証する。

## 4. ローカル DB に適用

```bash
bun run db:migrate
```

## 5. テスト

```bash
bun run --filter @sugara/api test
```

結合テストが必要な場合:

```bash
bun run --filter @sugara/api test:integration
```

## 6. 関連コードの更新

スキーマ変更に伴い、以下を確認・更新する:

- API ルート (`apps/api/src/routes/`)
- Zod スキーマ (`packages/shared/src/schemas/`)
- フロントエンドの型参照 (`apps/web/`)
- シードデータ (`apps/api/src/db/seed.ts`)

## 注意事項

- `db:push` は使わない（migration 追跡が壊れる）
- 本番 DB への適用は Vercel デプロイ時に自動実行される
- `MIGRATION_URL` は Direct Connection (port 5432) を使う。Transaction Pooler (6543) だと advisory lock が機能しない
