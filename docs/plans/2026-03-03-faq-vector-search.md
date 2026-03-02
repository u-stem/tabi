# FAQ ベクトル検索 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 静的ハードコードのFAQをDBに移行し、Minisearch（BM25 + 日本語bigramトークナイザー）によるクライアントサイド検索UIに完全移行する。

**Architecture:** `faqs` テーブルをSupabase PostgreSQLに追加。`GET /api/faqs` エンドポイントで全件返す。Server ComponentがDB直接クエリ→Client Component（FaqSearch）にprops渡し。FaqSearchはマウント時にMinisearchインデックスを構築し、以降のすべての検索はブラウザ内で完結する。

**Tech Stack:** Drizzle ORM, Hono, Minisearch, Next.js 15 App Router, shadcn/ui Card, Vitest

---

### Task 1: `faqs` テーブルをスキーマに追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`（末尾に追加）

**Step 1: Write the failing test**

まずmigrationが必要なため、先にスキーマを追加してからmigrationを生成する。テストはTask 4で書く。

**Step 2: スキーマを追加する**

`apps/api/src/db/schema.ts` の末尾（最後のexportの後）に追加：

```typescript
export const faqs = pgTable("faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

注意: `.enableRLS()` は不要（FAQは認証不要のpublicデータ）

**Step 3: migration を生成・適用する**

```bash
bun run db:generate
bun run db:migrate
```

Expected: migration ファイルが `apps/api/src/db/migrations/` に生成され、ローカルDBに適用される

**Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrations/
git commit -m "feat: faqs テーブルをスキーマに追加"
```

---

### Task 2: Shared Zod スキーマを追加

**Files:**
- Create: `packages/shared/src/schemas/faq.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write the failing test**

型チェックのみで十分。Zodスキーマは実行時バリデーション用として定義する。

**Step 2: スキーマファイルを作成する**

`packages/shared/src/schemas/faq.ts` を作成：

```typescript
import { z } from "zod";

export const faqSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number().int(),
});

export type Faq = z.infer<typeof faqSchema>;
```

**Step 3: index.ts に追加する**

`packages/shared/src/schemas/index.ts` に追加（他のexportの後）：

```typescript
export * from "./faq";
```

**Step 4: 型チェックを実行する**

```bash
bun run --filter @sugara/shared check-types
```

Expected: エラーなし

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/faq.ts packages/shared/src/schemas/index.ts
git commit -m "feat: Faq shared スキーマを追加"
```

---

### Task 3: `GET /api/faqs` Hono ルートのテストを書く（Red）

**Files:**
- Create: `apps/api/src/__tests__/faqs.test.ts`

**Step 1: テストを書く**

`apps/api/src/__tests__/faqs.test.ts` を作成：

```typescript
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const mockOrderBy = vi.fn();
const mockFrom = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("../db/index", () => ({
  db: { select: mockSelect },
}));

import { faqRoutes } from "../routes/faqs";

function createApp() {
  const app = new Hono();
  app.route("/", faqRoutes);
  return app;
}

describe("GET /api/faqs", () => {
  it("returns FAQ items sorted by sort_order", async () => {
    const items = [
      { id: "00000000-0000-0000-0000-000000000001", question: "Q1", answer: "A1", sortOrder: 0 },
      { id: "00000000-0000-0000-0000-000000000002", question: "Q2", answer: "A2", sortOrder: 1 },
    ];
    mockOrderBy.mockResolvedValue(items);

    const app = createApp();
    const res = await app.request("/api/faqs");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(items);
  });

  it("returns 200 with empty array when no FAQs exist", async () => {
    mockOrderBy.mockResolvedValue([]);

    const app = createApp();
    const res = await app.request("/api/faqs");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
```

**Step 2: テストが失敗することを確認する**

```bash
bun run --filter @sugara/api test
```

Expected: FAIL（`../routes/faqs` が存在しないため）

---

### Task 4: `GET /api/faqs` Hono ルートを実装する（Green）

**Files:**
- Create: `apps/api/src/routes/faqs.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: ルートファイルを作成する**

`apps/api/src/routes/faqs.ts` を作成：

```typescript
import { asc } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { faqs } from "../db/schema";

const faqRoutes = new Hono();

faqRoutes.get("/api/faqs", async (c) => {
  const rows = await db
    .select({
      id: faqs.id,
      question: faqs.question,
      answer: faqs.answer,
      sortOrder: faqs.sortOrder,
    })
    .from(faqs)
    .orderBy(asc(faqs.sortOrder));
  return c.json(rows);
});

export { faqRoutes };
```

**Step 2: `app.ts` に登録する**

`apps/api/src/app.ts` で、他のimportの後（アルファベット順）に追加：

```typescript
import { faqRoutes } from "./routes/faqs";
```

`app.route("/", adminRoutes);` の後に追加：

```typescript
app.route("/", faqRoutes);
```

**Step 3: テストが通ることを確認する**

```bash
bun run --filter @sugara/api test
```

Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/routes/faqs.ts apps/api/src/app.ts apps/api/src/__tests__/faqs.test.ts
git commit -m "feat: GET /api/faqs エンドポイントを追加"
```

---

### Task 5: `getFaqs` ライブラリ関数を追加

**Files:**
- Create: `apps/api/src/lib/faqs.ts`
- Modify: `apps/api/package.json`

**Step 1: ライブラリ関数を作成する**

`apps/api/src/lib/faqs.ts` を作成：

```typescript
import { asc } from "drizzle-orm";
import { db } from "../db/index";
import { faqs } from "../db/schema";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export async function getFaqs(): Promise<FaqItem[]> {
  return db
    .select({
      id: faqs.id,
      question: faqs.question,
      answer: faqs.answer,
      sortOrder: faqs.sortOrder,
    })
    .from(faqs)
    .orderBy(asc(faqs.sortOrder));
}
```

**Step 2: `package.json` の exports に追加する**

`apps/api/package.json` の `"exports"` フィールドに追加：

```json
"./lib/faqs": "./src/lib/faqs.ts"
```

（既存の `"./lib/app-settings"` の後）

**Step 3: 型チェックを実行する**

```bash
bun run check-types
```

Expected: エラーなし

**Step 4: Commit**

```bash
git add apps/api/src/lib/faqs.ts apps/api/package.json
git commit -m "feat: getFaqs ライブラリ関数を追加"
```

---

### Task 6: FAQ seed スクリプトを作成する

**Files:**
- Create: `apps/api/src/db/seed-faqs.ts`
- Modify: `apps/api/package.json`

**Step 1: seed スクリプトを作成する**

`apps/api/src/db/seed-faqs.ts` を作成（既存の19件のFAQデータをDBに投入）：

```typescript
import { sql } from "drizzle-orm";
import { db } from "./index";
import { faqs } from "./schema";

const FAQ_ITEMS = [
  {
    question: "sugaraで何ができますか？",
    answer:
      "旅行計画を作成し、メンバーと共同編集できるWebアプリです。日程・行き先の管理、日程調整の投票、費用管理、お土産リスト、ブックマークの保存、Excel/CSV出力、印刷に対応しています。スマートフォンからのアクセスにも対応しています。",
    sortOrder: 0,
  },
  {
    question: "「パターン」とは何ですか？",
    answer:
      "1日の行程に対して最大3つの代替プランを作成できる機能です。「晴れの日プラン」「雨の日プラン」のように、状況に応じた候補を並行して管理できます。",
    sortOrder: 1,
  },
  {
    question: "「候補」と「予定」は何が違いますか？",
    answer:
      "「候補」はまだ日程に割り当てていない行き先のストックです。気になる場所をとりあえず追加しておき、後からドラッグ&ドロップで日程に配置すると「予定」になります。",
    sortOrder: 2,
  },
  {
    question: "旅行のステータスが自動で変わるのはなぜですか？",
    answer:
      "旅行の開始日・終了日に基づいて、ステータスが自動的に「計画済み → 進行中 → 完了」と遷移します。手動で変更することもできます。",
    sortOrder: 3,
  },
  {
    question: "「日程調整」とは何ですか？",
    answer:
      "旅行の日程をメンバーと投票で決められる機能です。複数の日程案を提示し、参加者が「OK / たぶん / NG」で回答します。結果を見てオーナーが日程を確定すると、旅行の日付が自動設定されます。",
    sortOrder: 4,
  },
  {
    question: "日程調整に参加者を招待するにはどうすればよいですか？",
    answer:
      "通常の旅行と同じように、メンバー管理からユーザーを追加します。旅行のメンバーは日程調整にアクセスすると自動的に回答できるようになります。共有リンクを発行すると回答状況を外部に公開できますが、リンク経由では投票できません（閲覧専用）。日程確定後、投票参加者は自動的に旅行のメンバー（編集者）に追加されます。",
    sortOrder: 5,
  },
  {
    question: "メンバーの「編集者」と「閲覧者」は何が違いますか？",
    answer:
      "「編集者」は予定の追加・編集・削除ができます。「閲覧者」は旅行の内容を見ることだけできます。メンバーの管理（追加・削除・ロール変更）はオーナーのみ行えます。",
    sortOrder: 6,
  },
  {
    question: "メンバーを追加するにはどうすればよいですか？",
    answer:
      "旅行の詳細画面からメンバー管理を開き、相手の「ユーザーID」を入力して追加します。ユーザーIDは設定画面で確認できます。フレンド登録済みの相手は、フレンドリストやグループからまとめて追加できます。",
    sortOrder: 7,
  },
  {
    question: "共有リンクとメンバー招待はどう使い分けますか？",
    answer:
      "共有リンクは、リンクを知っている人なら誰でも旅行の内容を閲覧できます（読み取り専用）。メンバー招待は、特定のユーザーに編集権限を含むロールを付与できます。一緒に計画を作るならメンバー招待、完成した計画を見せるだけなら共有リンクが便利です。",
    sortOrder: 8,
  },
  {
    question: "複数人で同時に編集できますか？",
    answer:
      "はい。メンバーが同時にアクセスしている場合、他のメンバーの変更がリアルタイムで反映されます。誰がどの日程を閲覧中かも表示されます。",
    sortOrder: 9,
  },
  {
    question: "「フレンド」とは何ですか？",
    answer:
      "よく一緒に旅行する相手をフレンド登録しておける機能です。フレンドリストから旅行へ直接メンバーを追加できます。追加するには相手の「ユーザーID」を検索してリクエストを送り、承認されるとフレンドになります。ユーザーIDはお互いの設定画面で確認できます。",
    sortOrder: 10,
  },
  {
    question: "「グループ」は何に使いますか？",
    answer:
      "よく一緒に旅行するメンバーをグループにまとめておくと、旅行にメンバーを追加する際にグループから一括追加できます。",
    sortOrder: 11,
  },
  {
    question: "「ブックマーク」とは何ですか？",
    answer:
      "行き先をリストにまとめて保存・共有できる機能です。気になる場所をブックマークに保存しておき、旅行の候補として一括追加できます。リストの公開範囲は「非公開」「フレンドのみ」「公開」から選べます。",
    sortOrder: 12,
  },
  {
    question: "「費用」タブとは何ですか？",
    answer:
      "旅行中の支出を記録し、メンバー間の精算を自動計算する機能です。誰がいくら支払ったかを入力すると、誰が誰にいくら返せばよいかが一覧で表示されます。費用は旅行のメンバー全員に共有されます。",
    sortOrder: 13,
  },
  {
    question: "「お土産」リストとは何ですか？",
    answer:
      "旅行ごとに購入したいお土産を管理できる機能です。品名・対象・購入場所・URLなどを記録し、チェックボックスで購入済みにマークできます。お土産リストは自分だけに表示され、他のメンバーとは共有されません。",
    sortOrder: 14,
  },
  {
    question: "旅行の計画を書き出せますか？",
    answer:
      "Excel (.xlsx) または CSV 形式でエクスポートできます。CSVは区切り文字や改行コードをカスタマイズ可能です。また、印刷用レイアウトでブラウザから印刷・PDF保存もできます。",
    sortOrder: 15,
  },
  {
    question: "スマートフォンでも使えますか？",
    answer:
      "はい。スマートフォンのブラウザからアクセスすると、タッチ操作に最適化された専用画面に自動で切り替わります。ボトムナビゲーションで主要ページにすばやくアクセスでき、旅行詳細ではスワイプでタブを切り替えられます。ヘッダーのメニューから「PC版で表示」を選ぶと、いつでもデスクトップ向け画面に切り替えられます。",
    sortOrder: 16,
  },
  {
    question: "キーボードショートカットはありますか？",
    answer:
      "はい。「?」キーでショートカット一覧を表示できます。日程の切り替え（数字キー・[ ]キー）、予定の追加（aキー）、候補の追加（cキー）などが使えます。",
    sortOrder: 17,
  },
  {
    question: "旅行や予定に上限はありますか？",
    answer:
      "旅行は1ユーザーあたり10件、予定は1旅行あたり300件、メンバーは1旅行あたり20人、パターンは1日あたり3つ、ブックマークリストは5件、フレンドは100人、グループは10件、お土産は1旅行あたり100件までです。",
    sortOrder: 18,
  },
];

async function main() {
  console.log("Seeding FAQs...");

  // Delete all existing FAQs and re-insert to reflect latest content
  await db.delete(faqs);
  await db.insert(faqs).values(FAQ_ITEMS);

  console.log(`Inserted ${FAQ_ITEMS.length} FAQ items.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 2: `package.json` の scripts に追加する**

`apps/api/package.json` の `"scripts"` に追加：

```json
"db:seed-faqs": "bun run src/db/seed-faqs.ts"
```

**Step 3: seed を実行する（ローカルDBが起動していること）**

```bash
bun run --filter @sugara/api db:seed-faqs
```

Expected: `Inserted 19 FAQ items.`

**Step 4: Commit**

```bash
git add apps/api/src/db/seed-faqs.ts apps/api/package.json
git commit -m "feat: FAQ seed スクリプトを追加"
```

---

### Task 7: Minisearch を導入してtokenizerのテストを書く（Red → Green）

**Files:**
- Create: `apps/web/lib/faq-search.ts`
- Create: `apps/web/lib/__tests__/faq-search.test.ts`

**Step 1: minisearch をインストールする**

```bash
bun add --filter @sugara/web minisearch
```

**Step 2: テストを書く（Red）**

`apps/web/lib/__tests__/faq-search.test.ts` を作成：

```typescript
import { describe, expect, it } from "vitest";
import { buildFaqIndex, createBigramTokenizer } from "../faq-search";

describe("createBigramTokenizer", () => {
  it("returns bigrams for Japanese text", () => {
    expect(createBigramTokenizer("メンバー")).toEqual(["メン", "ンバ", "バー"]);
  });

  it("returns single char for 1-char input", () => {
    expect(createBigramTokenizer("A")).toEqual(["a"]);
  });

  it("returns empty array for empty string", () => {
    expect(createBigramTokenizer("")).toEqual([]);
  });

  it("ignores whitespace between characters", () => {
    expect(createBigramTokenizer("AB")).toEqual(["ab"]);
  });
});

describe("buildFaqIndex", () => {
  const faqs = [
    {
      id: "1",
      question: "メンバーを追加するには？",
      answer: "ユーザーIDを入力します",
      sortOrder: 0,
    },
    {
      id: "2",
      question: "フレンドとは何ですか？",
      answer: "よく一緒に旅行する相手",
      sortOrder: 1,
    },
  ];

  it("returns matching FAQ for relevant query", () => {
    const index = buildFaqIndex(faqs);
    const results = index.search("メンバー");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("1");
  });

  it("returns empty array when query has no match", () => {
    const index = buildFaqIndex(faqs);
    const results = index.search("zzzzzzzzzzz");
    expect(results).toHaveLength(0);
  });
});
```

**Step 3: テストが失敗することを確認する**

```bash
bun run --filter @sugara/web test
```

Expected: FAIL（`../faq-search` が存在しないため）

**Step 4: 実装する（Green）**

`apps/web/lib/faq-search.ts` を作成：

```typescript
import MiniSearch from "minisearch";

export type SearchableFaq = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export function createBigramTokenizer(text: string): string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  if (normalized.length === 0) return [];
  if (normalized.length === 1) return [normalized];
  const ngrams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    ngrams.push(normalized.slice(i, i + 2));
  }
  return ngrams;
}

export function buildFaqIndex(faqs: SearchableFaq[]): MiniSearch<SearchableFaq> {
  const ms = new MiniSearch<SearchableFaq>({
    fields: ["question", "answer"],
    storeFields: ["id", "question", "answer", "sortOrder"],
    tokenize: createBigramTokenizer,
    searchOptions: {
      boost: { question: 2 },
      fuzzy: 0.1,
      prefix: true,
    },
  });
  ms.addAll(faqs);
  return ms;
}
```

**Step 5: テストが通ることを確認する**

```bash
bun run --filter @sugara/web test
```

Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/lib/faq-search.ts apps/web/lib/__tests__/faq-search.test.ts apps/web/package.json bun.lock
git commit -m "feat: Minisearch + bigram tokenizer を追加"
```

---

### Task 8: `FaqSearch` Client Component を実装する

**Files:**
- Create: `apps/web/app/faq/_components/faq-search.tsx`

**Step 1: コンポーネントを作成する**

`apps/web/app/faq/_components/faq-search.tsx` を作成：

```tsx
"use client";

import { useMemo, useState } from "react";
import type { SearchableFaq } from "@/lib/faq-search";
import { buildFaqIndex } from "@/lib/faq-search";

type Props = {
  faqs: SearchableFaq[];
};

export function FaqSearch({ faqs }: Props) {
  const [query, setQuery] = useState("");

  const index = useMemo(() => buildFaqIndex(faqs), [faqs]);

  const results = useMemo<SearchableFaq[]>(() => {
    if (!query.trim()) return faqs;
    return index.search(query) as unknown as SearchableFaq[];
  }, [index, faqs, query]);

  return (
    <div className="mt-6 space-y-4">
      <input
        type="search"
        placeholder="質問を入力..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {query.trim() !== "" && results.length === 0 && (
        <p className="text-sm text-muted-foreground">見つかりませんでした</p>
      )}

      <div className="space-y-3">
        {results.map((faq) => (
          <div key={faq.id} className="rounded-lg border bg-card p-4 text-card-foreground">
            <p className="font-medium">{faq.question}</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: 型チェックを実行する**

```bash
bun run --filter @sugara/web check-types
```

Expected: エラーなし

**Step 3: Commit**

```bash
git add apps/web/app/faq/_components/faq-search.tsx
git commit -m "feat: FaqSearch クライアントコンポーネントを追加"
```

---

### Task 9: `faq/page.tsx` を Server Component 化して完全移行する

**Files:**
- Modify: `apps/web/app/faq/page.tsx`

**Step 1: ページを書き換える**

`apps/web/app/faq/page.tsx` を完全に以下に置き換える：

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getFaqs } from "@sugara/api/lib/faqs";
import { Logo } from "@/components/logo";
import { pageTitle } from "@/lib/constants";
import { FaqSearch } from "./_components/faq-search";

export const metadata: Metadata = {
  title: pageTitle("よくある質問"),
};

export default async function FaqPage() {
  const faqs = await getFaqs();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">よくある質問</h1>
        <FaqSearch faqs={faqs} />
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          お知らせ
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          利用規約
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}
```

**Step 2: 型チェック + lint を実行する**

```bash
bun run check-types
bun run --filter @sugara/web check
```

Expected: エラーなし

**Step 3: 全テストを実行する**

```bash
bun run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/app/faq/page.tsx
git commit -m "feat: FAQ ページをDB+Minisearch検索に完全移行"
```

---

### Task 10: 動作確認

**Step 1: ローカルで起動してFAQページを確認する**

```bash
bun run --filter @sugara/web dev
```

ブラウザで `http://localhost:3000/faq` にアクセス：
- 全FAQがカード形式で表示されること
- 検索ボックスに「メンバー」と入力すると関連FAQに絞り込まれること
- 検索に一致しないワードを入力すると「見つかりませんでした」と表示されること

**Step 2: FAQデータをDBに投入する（まだ実施していない場合）**

```bash
bun run --filter @sugara/api db:seed-faqs
```

---

## 注意事項

- `apps/api/src/db/seed-faqs.ts` は既存データを削除してから再投入する。FAQ更新時は内容を変更してスクリプトを再実行する
- `MiniSearch` の `search()` の戻り値は `SearchResult[]` 型だが、`storeFields` に全フィールドを含めているため `SearchableFaq` にキャストして使用する
- `getFaqs()` は Server Component から呼び出すため、認証不要・クッキー不要
- Accordion コンポーネントは他のページでも使用されているため削除不要（`faq/page.tsx` からのimportを削除するだけ）
