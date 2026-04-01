---
name: feature-update
description: 機能追加・変更時の付随作業チェックリスト（FAQ、お知らせ、ドキュメント）
---

# 機能追加・変更時の付随作業

機能を追加・変更したときは、コードの変更と**同じコミット**で以下を対応する。

## 1. FAQ の更新

対象ファイル: `apps/api/src/db/seed-faqs.ts`

- 新機能 → `JA_FAQS` と `EN_FAQS` の両方に新しいエントリを追加
- 仕様変更 → 既存エントリの `answer` を ja/en 両方で更新
- 機能削除 → 該当エントリを ja/en 両方で削除
- カテゴリ追加 → `resolveCategory` の sortOrder マッピングと `messages/{ja,en}.json` の `faq.category` を更新

更新後:

```bash
bun run db:seed-faqs
```

## 2. お知らせ記事の作成

ファイル配置:
- `apps/web/content/news/ja/YYYY-MM-DD-<topic>.md`
- `apps/web/content/news/en/YYYY-MM-DD-<topic>.md`

既存の記事で記述が古くなったもの（機能の場所が変わった等）も ja/en 両方を修正する。

## 3. ドキュメントの更新

- `CLAUDE.md` — コマンド、技術スタック、主要パターンに変更がないか確認
- `docs/architecture/overview.md` — アーキテクチャに影響する場合
- `README.md` — メジャーバージョン更新時はバッジを更新

## 4. 確認

```bash
bun run check
bun run check-types
bun run test
```
