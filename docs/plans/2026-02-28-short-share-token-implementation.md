# Short Share Token Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shorten share tokens from 64 characters to 11 characters, and add rate limiting to the two public shared-content endpoints.

**Architecture:** Change `generateShareToken()` to use `crypto.randomBytes(8).toString('base64url')`. No DB migration needed — `varchar(64)` accepts shorter values, and existing long tokens expire naturally within 7 days. Add `rateLimitByIp({ window: 60, max: 30 })` to `GET /api/shared/:token` and `GET /api/polls/shared/:token`.

**Tech Stack:** Hono, Node.js `crypto`, Vitest

---

## Reference

- Design doc: `docs/plans/2026-02-28-short-share-token-design.md`
- Token generation: `apps/api/src/lib/share-token.ts`
- Trip share route: `apps/api/src/routes/share.ts`
- Poll share route: `apps/api/src/routes/poll-share.ts`
- Rate limit middleware: `apps/api/src/middleware/rate-limit.ts`
- Run tests: `bun run --filter @sugara/api test`
- Run lint: `bun run --filter @sugara/api check`
- Run type check: `bun run check-types`

---

## Task 1: Shorten Share Token

**Files:**
- Create: `apps/api/src/__tests__/share-token.test.ts`
- Modify: `apps/api/src/lib/share-token.ts`

**Step 1: Write the failing test**

Create `apps/api/src/__tests__/share-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateShareToken } from "../lib/share-token";

describe("generateShareToken", () => {
  it("generates an 11-character token", () => {
    const token = generateShareToken();
    expect(token).toHaveLength(11);
  });

  it("uses only base64url characters", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateShareToken));
    expect(tokens.size).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/api test share-token
```

Expected: FAIL — token has length 64 and contains hex characters only.

**Step 3: Update generateShareToken**

Edit `apps/api/src/lib/share-token.ts` line 6:

```ts
import crypto from "node:crypto";

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateShareToken(): string {
  return crypto.randomBytes(8).toString("base64url");
}

export function shareExpiresAt(): Date {
  return new Date(Date.now() + SHARE_LINK_TTL_MS);
}
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/api test share-token
```

Expected: 3 tests pass.

**Step 5: Run full test suite to confirm no regressions**

```bash
bun run --filter @sugara/api test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add apps/api/src/__tests__/share-token.test.ts apps/api/src/lib/share-token.ts
git commit -m "feat(share): 共有トークンを64文字から11文字に短縮"
```

---

## Task 2: Rate Limit on GET /api/shared/:token

**Files:**
- Modify: `apps/api/src/__tests__/share.test.ts`
- Modify: `apps/api/src/routes/share.ts`

**Step 1: Add a failing test**

Open `apps/api/src/__tests__/share.test.ts`. At the end of the file (inside `describe("Share routes", ...)`), add a new `describe` block:

```ts
describe("GET /api/shared/:token rate limiting", () => {
  it("returns 429 after 30 requests from the same IP", async () => {
    mockDbQuery.trips.findFirst.mockResolvedValue({
      id: "trip-1",
      title: "Test Trip",
      destination: "Tokyo",
      startDate: null,
      endDate: null,
      shareToken: "valid-token",
      shareTokenExpiresAt: new Date("2099-01-01"),
      tripMembers: [],
      tripDays: [],
      ownerId: "user-1",
    });

    const app = createTestApp(shareRoutes, "/");
    const headers = { "x-forwarded-for": "10.0.0.1" };

    for (let i = 0; i < 30; i++) {
      await app.request("/api/shared/valid-token", { headers });
    }

    const res = await app.request("/api/shared/valid-token", { headers });
    expect(res.status).toBe(429);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/api test share
```

Expected: new test FAIL — returns 200 on the 31st request, not 429.

**Step 3: Add rate limit to the route**

Open `apps/api/src/routes/share.ts`. Add the import and apply the middleware:

```ts
// Add after existing imports (around line 8):
import { rateLimitByIp } from "../middleware/rate-limit";

// Add before the existing async handler on the GET /api/shared/:token route:
const sharedTripRateLimit = rateLimitByIp({ window: 60, max: 30 });
```

Then update the route definition (around line 101):

```ts
// Before:
shareRoutes.get("/api/shared/:token", async (c) => {

// After:
shareRoutes.get("/api/shared/:token", sharedTripRateLimit, async (c) => {
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/api test share
```

Expected: all tests pass.

**Step 5: Lint and type check**

```bash
bun run --filter @sugara/api check
bun run check-types
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/api/src/__tests__/share.test.ts apps/api/src/routes/share.ts
git commit -m "feat(share): 共有旅行エンドポイントにレートリミットを追加"
```

---

## Task 3: Rate Limit on GET /api/polls/shared/:token

**Files:**
- Modify: `apps/api/src/__tests__/poll-share.test.ts`
- Modify: `apps/api/src/routes/poll-share.ts`

**Step 1: Add a failing test**

Open `apps/api/src/__tests__/poll-share.test.ts`. At the end of the file (inside the top-level `describe`), add:

```ts
describe("GET /api/polls/shared/:token rate limiting", () => {
  it("returns 429 after 30 requests from the same IP", async () => {
    mockDbQuery.schedulePolls.findFirst.mockResolvedValue({
      id: "poll-1",
      trip: { title: "Trip Poll", destination: "Kyoto" },
      note: null,
      status: "open",
      deadline: null,
      confirmedOptionId: null,
      shareTokenExpiresAt: new Date("2099-01-01"),
      options: [],
      participants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createTestApp(pollShareRoutes, "/");
    const headers = { "x-forwarded-for": "10.0.0.2" };

    for (let i = 0; i < 30; i++) {
      await app.request("/api/polls/shared/valid-token", { headers });
    }

    const res = await app.request("/api/polls/shared/valid-token", { headers });
    expect(res.status).toBe(429);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/api test poll-share
```

Expected: new test FAIL — returns 200 on the 31st request, not 429.

**Step 3: Add rate limit to the route**

Open `apps/api/src/routes/poll-share.ts`. Add the import and apply the middleware:

```ts
// Add after existing imports:
import { rateLimitByIp } from "../middleware/rate-limit";

// Add before the route definition:
const sharedPollRateLimit = rateLimitByIp({ window: 60, max: 30 });
```

Then update the route definition (line 10):

```ts
// Before:
pollShareRoutes.get("/api/polls/shared/:token", async (c) => {

// After:
pollShareRoutes.get("/api/polls/shared/:token", sharedPollRateLimit, async (c) => {
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/api test poll-share
```

Expected: all tests pass.

**Step 5: Run full test suite**

```bash
bun run --filter @sugara/api test
```

Expected: all tests pass.

**Step 6: Lint and type check**

```bash
bun run --filter @sugara/api check
bun run check-types
```

Expected: no errors.

**Step 7: Commit**

```bash
git add apps/api/src/__tests__/poll-share.test.ts apps/api/src/routes/poll-share.ts
git commit -m "feat(share): 共有ポーリングエンドポイントにレートリミットを追加"
```
