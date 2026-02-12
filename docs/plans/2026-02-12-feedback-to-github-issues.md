# Feedback to GitHub Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** アプリ内からフィードバックを送信し、GitHub Issue を自動作成する

**Architecture:** Hono API に `POST /api/feedback` を追加。サーバーサイドで GitHub API を `fetch` で呼び出し Issue を作成する。DB 保存なし（GitHub Issue が Single Source of Truth）。フロントはヘッダーメニュー内のフィードバック項目からダイアログを開く。

**Tech Stack:** Hono, Zod, GitHub REST API (fetch), shadcn/ui Dialog, Textarea

---

## Task 1: Zod スキーマ

**Files:**
- Create: `packages/shared/src/schemas/feedback.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Create schema file**

```ts
// packages/shared/src/schemas/feedback.ts
import { z } from "zod";

export const FEEDBACK_BODY_MAX_LENGTH = 1000;

export const createFeedbackSchema = z.object({
  body: z.string().min(1).max(FEEDBACK_BODY_MAX_LENGTH),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
```

**Step 2: Add export**

`packages/shared/src/schemas/index.ts` に追加:
```ts
export * from "./feedback";
```

**Step 3: Verify types**

Run: `bun run --filter @sugara/shared check-types`
Expected: PASS

**Step 4: Commit**

```
feat: フィードバック用 Zod スキーマを追加
```

---

## Task 2: API エンドポイント（テスト）

**Files:**
- Create: `apps/api/src/__tests__/feedback.test.ts`

**Step 1: Write tests**

```ts
// apps/api/src/__tests__/feedback.test.ts
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockFetch } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { feedbackRoutes } from "../routes/feedback";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };

function createApp() {
  const app = new Hono();
  app.route("/api", feedbackRoutes);
  return app;
}

describe("Feedback routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 without auth", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = createApp();
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Bug report" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty body", async () => {
    const app = createApp();
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for body exceeding max length", async () => {
    const app = createApp();
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "a".repeat(1001) }),
    });
    expect(res.status).toBe(400);
  });

  it("creates GitHub issue and returns 201", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ html_url: "https://github.com/owner/repo/issues/1" }), {
        status: 201,
      }),
    );
    const app = createApp();
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Something is broken" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.url).toBe("https://github.com/owner/repo/issues/1");

    // Verify GitHub API was called correctly
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/repos/");
    expect(url).toContain("/issues");
    expect(options.method).toBe("POST");
    const reqBody = JSON.parse(options.body);
    expect(reqBody.title).toBe("Something is broken");
    expect(reqBody.labels).toEqual(["feedback"]);
  });

  it("truncates title to 50 chars with ellipsis", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ html_url: "https://github.com/owner/repo/issues/2" }), {
        status: 201,
      }),
    );
    const app = createApp();
    const longBody = "a".repeat(60);
    await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: longBody }),
    });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(reqBody.title).toBe("a".repeat(50) + "...");
  });

  it("returns 502 when GitHub API fails", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }),
    );
    const app = createApp();
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Test feedback" }),
    });
    expect(res.status).toBe(502);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- feedback`
Expected: FAIL (feedbackRoutes not found)

---

## Task 3: API エンドポイント（実装）

**Files:**
- Create: `apps/api/src/routes/feedback.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/lib/constants.ts`

**Step 1: Add error message constant**

`apps/api/src/lib/constants.ts` の `ERROR_MSG` に追加:
```ts
GITHUB_API_FAILED: "Failed to create feedback issue",
GITHUB_NOT_CONFIGURED: "Feedback is not configured",
```

**Step 2: Create route file**

```ts
// apps/api/src/routes/feedback.ts
import { Hono } from "hono";
import { createFeedbackSchema } from "@sugara/shared";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";

const TITLE_MAX_LENGTH = 50;

export const feedbackRoutes = new Hono();

feedbackRoutes.use("*", requireAuth);

feedbackRoutes.post("/feedback", async (c) => {
  const body = await c.req.json();
  const parsed = createFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { body: feedbackBody } = parsed.data;

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO;
  if (!token || !repo) {
    return c.json({ error: ERROR_MSG.GITHUB_NOT_CONFIGURED }, 500);
  }

  const title =
    feedbackBody.length > TITLE_MAX_LENGTH
      ? `${feedbackBody.slice(0, TITLE_MAX_LENGTH)}...`
      : feedbackBody;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body: feedbackBody,
      labels: ["feedback"],
    }),
  });

  if (!res.ok) {
    return c.json({ error: ERROR_MSG.GITHUB_API_FAILED }, 502);
  }

  const data = await res.json();
  return c.json({ url: data.html_url }, 201);
});
```

**Step 3: Register route**

`apps/api/src/app.ts` に追加:
```ts
import { feedbackRoutes } from "./routes/feedback";
// ...
app.route("/api", feedbackRoutes);
```

Note: 他のルートは `app.route("/api/trips", ...)` だが、feedback は trip に紐づかないので `/api` にマウント。

**Step 4: Run tests**

Run: `bun run --filter @sugara/api test -- feedback`
Expected: ALL PASS

**Step 5: Run full checks**

Run: `bun run check && bun run check-types`
Expected: PASS

**Step 6: Commit**

```
feat: フィードバック API エンドポイントを追加
```

---

## Task 4: フロントエンド メッセージ定数

**Files:**
- Modify: `apps/web/lib/messages.ts`

**Step 1: Add messages**

`apps/web/lib/messages.ts` に追加:
```ts
// Feedback
FEEDBACK_SENT: "フィードバックを送信しました",
FEEDBACK_SEND_FAILED: "フィードバックの送信に失敗しました",
```

**Step 2: Verify types**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

---

## Task 5: フィードバックダイアログ

**Files:**
- Create: `apps/web/components/feedback-dialog.tsx`

**Step 1: Create component**

```tsx
// apps/web/components/feedback-dialog.tsx
"use client";

import { FEEDBACK_BODY_MAX_LENGTH } from "@sugara/shared";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const COOLDOWN_MS = 5000;

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || cooldown) return;
    setError(null);
    setLoading(true);

    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
      });
      toast.success(MSG.FEEDBACK_SENT);
      setBody("");
      onOpenChange(false);

      // Cooldown to prevent rapid re-submission
      setCooldown(true);
      cooldownTimer.current = setTimeout(() => setCooldown(false), COOLDOWN_MS);
    } catch {
      setError(MSG.FEEDBACK_SEND_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>フィードバック</DialogTitle>
          <DialogDescription>バグ報告や改善要望をお聞かせください</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="バグ報告や改善要望など"
            maxLength={FEEDBACK_BODY_MAX_LENGTH}
            rows={5}
            required
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {body.length}/{FEEDBACK_BODY_MAX_LENGTH}
          </p>
          {error && (
            <div
              role="alert"
              className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading || !body.trim() || cooldown}>
              {loading ? "送信中..." : "送信"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify types**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

---

## Task 6: ヘッダーにフィードバック項目追加

**Files:**
- Modify: `apps/web/components/header.tsx`

**Step 1: Add imports**

```ts
import { MessageSquare } from "lucide-react";  // add to existing import
import { FeedbackDialog } from "@/components/feedback-dialog";
```

**Step 2: Add state**

`Header` コンポーネント内に追加:
```ts
const [feedbackOpen, setFeedbackOpen] = useState(false);
```

**Step 3: Desktop DropdownMenu に追加**

`<DropdownMenuItem asChild>` (設定 Link) の直後に追加:
```tsx
<DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
  <MessageSquare className="h-4 w-4" />
  フィードバック
</DropdownMenuItem>
```

**Step 4: Mobile Sheet に追加**

設定の `<Link>` の直後に追加:
```tsx
<button
  type="button"
  onClick={() => {
    setFeedbackOpen(true);
    setMobileMenuOpen(false);
  }}
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
>
  <MessageSquare className="h-4 w-4" />
  フィードバック
</button>
```

**Step 5: FeedbackDialog をレンダー**

`</header>` の直前に追加:
```tsx
<FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
```

**Step 6: Verify**

Run: `bun run check && bun run check-types`
Expected: PASS

**Step 7: Commit**

```
feat: フィードバックダイアログとヘッダーメニュー項目を追加
```

---

## Task 7: 環境変数ドキュメント

**Files:**
- Modify: `apps/api/.env.example` (if accessible, otherwise note in commit)

**Step 1: Add env vars**

`.env.example` に追加:
```
GITHUB_TOKEN=
GITHUB_FEEDBACK_REPO=owner/repo
```

**Step 2: Commit**

```
chore: フィードバック用の環境変数を .env.example に追加
```

---

## Task 8: 最終検証

**Step 1: Full test suite**

Run: `bun run test`
Expected: ALL PASS

**Step 2: Full checks**

Run: `bun run check && bun run check-types`
Expected: PASS

**Step 3: Squash commit (optional)**

必要に応じてコミットをまとめる。
