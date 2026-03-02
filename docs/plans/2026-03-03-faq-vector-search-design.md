# FAQ ベクトル検索設計

**Goal:** 静的ハードコードのFAQをDBに移行し、Minisearch（BM25 + 日本語bigramトークナイザー）によるクライアントサイド全文検索UIを実装する。AIや外部検索APIは使用しない。

**Architecture:** FAQデータをSupabase PostgreSQLの`faqs`テーブルに移行。ページロード時にServer ComponentがDBから全件取得してClient Componentに渡す。Client ComponentでMinisearchインデックスを構築し、以降の検索はブラウザ内で完結する。

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Minisearch, Tailwind CSS v4, shadcn/ui Card

---

## データ層

### DBスキーマ

```sql
CREATE TABLE faqs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `sort_order` で表示順を制御
- FAQの追加・更新は `apps/api/src/db/seeds/faqs.ts` で管理（`bun run db:seed` で投入）
- スキーマ変更は migration 経由（`db:generate` → `db:migrate`）

### Drizzle スキーマ

`apps/api/src/db/schema.ts` に `faqs` テーブルを追加。

---

## API層

### `GET /api/faqs`

- 認証不要（`requireAuth` ミドルウェアなし）
- `sort_order` 昇順で全件返す
- レスポンス: `{ id, question, answer, sortOrder }[]`

Zodスキーマは `packages/shared/src/schemas/faq.ts` に定義し、APIとフロントエンドで共有する。

---

## 検索層

### Minisearch設定

```typescript
const miniSearch = new MiniSearch({
  fields: ['question', 'answer'],
  storeFields: ['question', 'answer'],
  tokenize: (text) => {
    // Japanese bigram: "メンバー追加" → ["メン", "ンバ", "バー", "ー追", "追加"]
    const normalized = text.toLowerCase().replace(/\s+/g, '')
    const ngrams: string[] = []
    for (let i = 0; i < normalized.length - 1; i++) {
      ngrams.push(normalized.slice(i, i + 2))
    }
    if (normalized.length === 1) ngrams.push(normalized)
    return ngrams
  },
  searchOptions: {
    boost: { question: 2 }, // 質問フィールドのマッチを優先
    fuzzy: 0.1,
    prefix: true,
  },
})
```

- ページロード時（`useMemo`）に全FAQをインデックス化
- 以降の検索はAPIコールなし、即時レスポンス

---

## UIコンポーネント構成

```
apps/web/app/faq/
├── page.tsx                  # Server Component: DB直接クエリ → props渡し
└── _components/
    └── faq-search.tsx        # Client Component: Minisearch + 検索UI
```

### 画面仕様

- 上部に検索テキストボックス（プレースホルダー: 「質問を入力...」）
- 入力debounce: 150ms
- **未入力時**: 全FAQをカード一覧で表示（`sort_order` 順）
- **入力時**: スコア上位5件をカード形式で表示
- **0件時**: 「見つかりませんでした」メッセージを表示
- 既存のアコーディオンUIは完全廃止

### カードUI

shadcn/ui の `Card` コンポーネントを使用。質問をタイトル、回答を本文として表示。

---

## テスト方針

| テスト | 内容 |
|---|---|
| `GET /api/faqs` | 200・配列を返すこと、sort_order順であること |
| Minisearch tokenizer | bigram分割が正しいこと（単体テスト） |
| FaqSearch | 未入力時に全FAQ表示 |
| FaqSearch | クエリ入力で絞り込み結果表示 |
| FaqSearch | 0件時に「見つかりませんでした」表示 |

---

## 移行手順

1. `faqs` テーブルのスキーマ追加 + migration生成・適用
2. seed スクリプトに既存19件のFAQデータを移行
3. `GET /api/faqs` APIエンドポイント実装
4. `FaqSearch` Client Component実装（Minisearch導入）
5. `faq/page.tsx` をServer Component化し、ハードコードFAQデータを削除
6. Accordion依存をFAQページから除去

## 実装しないこと

- 管理画面（FAQのCRUD UI）: seedスクリプトで管理
- AI/LLMによるセマンティック検索
- バックエンドサイドの検索処理（全件取得 + クライアント検索で十分）
- ハイライト表示（マッチ箇所の強調）
