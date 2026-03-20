# i18n Step 1: next-intl 導入 + ホーム画面の文字列切り出し

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** next-intl を導入し、ホーム画面 (`page.tsx`) と root layout のハードコード日本語文字列をメッセージファイルに切り出す

**Architecture:** Cookie ベースのロケール解決 (URL ルーティングなし)。`i18n/request.ts` で Cookie → Accept-Language の順にフォールバック。`createNextIntlPlugin` と既存の `withSerwistInit` を合成して next.config.ts に統合

**Tech Stack:** next-intl, Next.js 16 App Router, TypeScript

**Spec:** `docs/plans/i18n.md`

---

### Task 1: next-intl のインストールと基本設定

**Files:**
- Modify: `apps/web/package.json` (dependency 追加)
- Create: `apps/web/i18n/request.ts`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: next-intl をインストール**

```bash
bun add --filter @sugara/web next-intl
```

- [ ] **Step 2: `i18n/request.ts` を作成**

```ts
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const SUPPORTED_LOCALES = ["ja", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "ja";

function isSupported(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  // 1. Cookie (user's manual choice)
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  if (cookieLocale && isSupported(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default,
    };
  }

  // 2. Accept-Language header (first visit)
  const acceptLang = (await headers()).get("accept-language") ?? "";
  const preferred = acceptLang.split(",")[0]?.split("-")[0]?.trim();
  const locale = preferred && isSupported(preferred) ? preferred : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: `next.config.ts` に `createNextIntlPlugin` を追加**

既存の `withSerwistInit` と合成する。`next.config.ts` の末尾を変更:

```ts
// Add import at top
import createNextIntlPlugin from "next-intl/plugin";

// Replace the export default
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(
  withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
  })(nextConfig),
);
```

- [ ] **Step 4: コミット**

```bash
git add apps/web/package.json apps/web/i18n/request.ts apps/web/next.config.ts bun.lock
git commit -m "chore: next-intl をインストールし基本設定を追加"
```

---

### Task 2: メッセージファイルと型定義の作成

**Files:**
- Create: `apps/web/messages/ja.json`
- Create: `apps/web/global.d.ts`

- [ ] **Step 1: `ja.json` を作成**

ホーム画面 + metadata の文字列を集約:

```json
{
  "metadata": {
    "description": "旅行の計画を作成・共有できる共同編集アプリ。"
  },
  "home": {
    "heroTitle": "計画もまた、旅の楽しみだ。",
    "description": "旅行の計画を作成・共有できる共同編集アプリ。",
    "signup": "新規登録",
    "login": "ログイン",
    "signupDisabled": "現在、新規利用の受付を停止しています",
    "features": {
      "schedule": {
        "title": "スケジュール管理",
        "description": "日程ごとに行き先を整理。ドラッグで並べ替えも。"
      },
      "realtime": {
        "title": "リアルタイム共同編集",
        "description": "メンバーの変更がリアルタイムに反映。誰がどこを見ているかも分かる。"
      },
      "expense": {
        "title": "費用管理・精算",
        "description": "費用を記録して自動で割り勘計算。精算チェックで支払い状況も管理。"
      },
      "poll": {
        "title": "投票",
        "description": "日程調整やかんたん投票で意見を集約。リンク共有で外部の人も参加可能。"
      },
      "souvenir": {
        "title": "お土産リスト",
        "description": "贈り先ごとに買うものを整理。優先度や購入済みの管理も。"
      },
      "roulette": {
        "title": "ルーレット",
        "description": "迷ったらルーレットで決定。行き先選びに遊び心を。"
      }
    },
    "footer": {
      "faq": "よくある質問",
      "news": "お知らせ",
      "terms": "利用規約",
      "privacy": "プライバシーポリシー"
    }
  }
}
```

- [ ] **Step 2: `global.d.ts` を作成 (型安全性)**

```ts
import type messages from "./messages/ja.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
```

- [ ] **Step 3: 型チェックを実行**

```bash
bun run --filter @sugara/web check-types
```

Expected: PASS (`global.d.ts` が `ja.json` の型を読み込めること)

- [ ] **Step 4: コミット**

```bash
git add apps/web/messages/ja.json apps/web/global.d.ts
git commit -m "feat: ホーム画面用の日本語メッセージファイルと型定義を作成"
```

---

### Task 3: ロケール解決ロジックのテスト

**Files:**
- Create: `apps/web/i18n/__tests__/request.test.ts`

- [ ] **Step 1: テストを作成**

`i18n/request.ts` は `getRequestConfig` のコールバックとして実装されており、Next.js の `cookies()` / `headers()` に依存するため、ロケール解決ロジックを直接テスト可能な純粋関数として抽出し、テストする。

まず `i18n/request.ts` をリファクタリングして `resolveLocale` を export:

```ts
// Add to i18n/request.ts, before the getRequestConfig call:
export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string): Locale {
  if (cookieValue && isSupported(cookieValue)) {
    return cookieValue;
  }
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.trim();
  return preferred && isSupported(preferred) ? preferred : DEFAULT_LOCALE;
}
```

テストファイル:

```ts
import { describe, expect, it } from "vitest";
import { resolveLocale } from "../request";

describe("resolveLocale", () => {
  it("returns cookie locale when set to supported value", () => {
    expect(resolveLocale("en", "ja")).toBe("en");
  });

  it("ignores cookie when set to unsupported value", () => {
    expect(resolveLocale("fr", "en-US,ja;q=0.9")).toBe("en");
  });

  it("returns Accept-Language primary language when no cookie", () => {
    expect(resolveLocale(undefined, "en-US,ja;q=0.9")).toBe("en");
  });

  it("returns ja from Accept-Language header", () => {
    expect(resolveLocale(undefined, "ja,en;q=0.9")).toBe("ja");
  });

  it("falls back to ja when Accept-Language is unsupported", () => {
    expect(resolveLocale(undefined, "fr-FR,de;q=0.9")).toBe("ja");
  });

  it("falls back to ja when both cookie and Accept-Language are empty", () => {
    expect(resolveLocale(undefined, "")).toBe("ja");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
bun run --filter @sugara/web test -- i18n/__tests__/request.test.ts
```

Expected: FAIL (`resolveLocale` がまだ export されていないため)

- [ ] **Step 3: `i18n/request.ts` に `resolveLocale` を追加**

`i18n/request.ts` をリファクタリング:

```ts
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const SUPPORTED_LOCALES = ["ja", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "ja";

function isSupported(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string): Locale {
  if (cookieValue && isSupported(cookieValue)) {
    return cookieValue;
  }
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.trim();
  return preferred && isSupported(preferred) ? preferred : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const acceptLang = (await headers()).get("accept-language") ?? "";
  const locale = resolveLocale(cookieLocale, acceptLang);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
bun run --filter @sugara/web test -- i18n/__tests__/request.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: コミット**

```bash
git add apps/web/i18n/request.ts apps/web/i18n/__tests__/request.test.ts
git commit -m "test: ロケール解決ロジックのテストを追加"
```

---

### Task 4: root layout に next-intl を統合

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: layout.tsx を更新**

以下の変更を加える:

1. `getLocale` と `getMessages` を import
2. `<html lang="ja">` を `<html lang={locale}>` に変更
3. `NextIntlClientProvider` でラップ

```tsx
// Add imports
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

// In RootLayout function, add before return:
const locale = await getLocale();
const messages = await getMessages();

// Change <html lang="ja"> to:
<html lang={locale} suppressHydrationWarning>

// Wrap children with NextIntlClientProvider (inside ThemeProvider):
<SwProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"}>
  <NextIntlClientProvider messages={messages}>
    <QueryProvider>{children}</QueryProvider>
  </NextIntlClientProvider>
</SwProvider>
```

- [ ] **Step 2: metadata の description を `getTranslations` で動的生成**

```tsx
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const season = getSeason();
  const description = t("description");
  // ... rest stays the same
}
```

- [ ] **Step 3: 開発サーバーで動作確認**

```bash
bun run --filter @sugara/web dev
```

ブラウザで http://localhost:3000 を開き、表示が崩れていないことを確認。

- [ ] **Step 4: コミット**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: root layout に next-intl を統合し lang 属性を動的化"
```

---

### Task 5: ホーム画面のハードコード文字列を置き換え

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: page.tsx を `getTranslations` に書き換え**

`page.tsx` は Server Component なので `getTranslations` を使う:

```tsx
import { getAppSettings } from "@sugara/api/lib/app-settings";
import { ArrowRight, CalendarDays, Dices, Gift, LogIn, Receipt, Vote, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const FEATURE_KEYS = [
  { key: "schedule" as const, icon: CalendarDays },
  { key: "realtime" as const, icon: Zap },
  { key: "expense" as const, icon: Receipt },
  { key: "poll" as const, icon: Vote },
  { key: "souvenir" as const, icon: Gift },
  { key: "roulette" as const, icon: Dices },
];

export default async function HomePage() {
  const { signupEnabled } = await getAppSettings();
  const t = await getTranslations("home");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center sm:pt-32 sm:pb-20">
          <h1 className="text-2xl font-bold tracking-tight sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            {t("description")}
          </p>
          {signupEnabled ? (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/signup">
                  <ArrowRight className="h-4 w-4" />
                  {t("signup")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">
                  <LogIn className="h-4 w-4" />
                  {t("login")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">{t("signupDisabled")}</p>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">
                  <LogIn className="h-4 w-4" />
                  {t("login")}
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* Features */}
        <section className="container max-w-4xl px-4 pb-24 sm:pb-32">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_KEYS.map((f) => (
              <div key={f.key} className="rounded-lg border p-5">
                <div className="flex items-center gap-2">
                  <f.icon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-medium">{t(`features.${f.key}.title`)}</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`features.${f.key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.faq")}
        </Link>
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.news")}
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.terms")}
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.privacy")}
        </Link>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: `MSG.AUTH_SIGNUP_DISABLED` の import を削除**

`page.tsx` から `import { MSG } from "@/lib/messages"` を削除。`MSG.AUTH_SIGNUP_DISABLED` は `t("signupDisabled")` に置き換え済み。

注意: `MSG.AUTH_SIGNUP_DISABLED` は他のファイル (`apps/web/components/guest-button.tsx` 等) でも使われている可能性があるため、`MSG` オブジェクトからは削除しない。

- [ ] **Step 3: 型チェック**

```bash
bun run --filter @sugara/web check-types
```

Expected: PASS

- [ ] **Step 4: 開発サーバーで動作確認**

```bash
bun run --filter @sugara/web dev
```

http://localhost:3000 を開き、全ての文字列が正しく表示されることを確認。

- [ ] **Step 5: コミット**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: ホーム画面のハードコード文字列を next-intl に移行"
```

---

### Task 6: lint + 型チェック + テスト (全体検証)

**Files:** なし (検証のみ)

- [ ] **Step 1: Biome lint**

```bash
bun run --filter @sugara/web lint
```

Expected: PASS

- [ ] **Step 2: 型チェック**

```bash
bun run check-types
```

Expected: PASS (全パッケージ)

- [ ] **Step 3: テスト**

```bash
bun run test
```

Expected: PASS。既存テストが next-intl の導入で壊れていないことを確認。もし `NextIntlClientProvider` が必要で失敗するテストがあれば、テストファイル内でプロバイダーをラップして修正する。

- [ ] **Step 4: 修正があればコミット**

修正したファイルを個別に add:

```bash
git add <modified-test-files>
git commit -m "fix: next-intl 導入に伴うテスト修正"
```
