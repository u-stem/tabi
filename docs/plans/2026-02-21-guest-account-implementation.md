# Guest Account Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to try the app without registration via Better Auth anonymous plugin, with 7-day expiry and upgrade to full account.

**Architecture:** Better Auth anonymous plugin handles guest creation/session/upgrade. Custom middleware enforces guest restrictions (1 trip, no friends/groups/sharing). Header banner shows guest status and upgrade prompt.

**Tech Stack:** Better Auth anonymous plugin, Drizzle ORM, Hono middleware, React (Next.js)

---

## Task 1: DB schema — add guestExpiresAt column

**Files:**
- Modify: `apps/api/src/db/schema.ts` (users table, around line 82)

**Step 1: Add guestExpiresAt column to users table**

In `apps/api/src/db/schema.ts`, add after the `updatedAt` column in the users table:

```ts
guestExpiresAt: timestamp("guest_expires_at", { withTimezone: true }),
```

**Step 2: Generate and run migration**

```bash
bun run db:generate
bun run db:push
```

**Step 3: Commit**

```
feat: add guestExpiresAt column to users table
```

---

## Task 2: Better Auth — add anonymous plugin (server)

**Files:**
- Modify: `apps/api/src/lib/auth.ts`

**Step 1: Write failing test for anonymous sign-in**

Create `apps/api/src/__tests__/guest.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { testClient } from "./helpers";

describe("Guest account", () => {
  it("allows anonymous sign-in via Better Auth", async () => {
    const res = await testClient.post("/api/auth/sign-in/anonymous");
    expect(res.status).toBe(200);
  });
});
```

Run: `bun run --filter @sugara/api test -- --run src/__tests__/guest.test.ts`
Expected: FAIL (anonymous endpoint not registered)

**Step 2: Add anonymous plugin to auth config**

In `apps/api/src/lib/auth.ts`:

```ts
// Add import at line 4
import { anonymous } from "better-auth/plugins";

// Update plugins array at line 59
plugins: [
  anonymous({
    emailDomainName: "guest.sugara.local",
  }),
  username({ minUsernameLength: 3, maxUsernameLength: 20 }),
],

// Add rate limit rule inside customRules (line 20)
"/api/auth/sign-in/anonymous": { window: 60, max: 3 },
```

Run: `bun run db:generate && bun run db:push` (anonymous plugin adds `isAnonymous` column)

**Step 3: Run test to verify it passes**

Run: `bun run --filter @sugara/api test -- --run src/__tests__/guest.test.ts`
Expected: PASS

**Step 4: Commit**

```
feat: add Better Auth anonymous plugin for guest accounts
```

---

## Task 3: Better Auth — add anonymous plugin (client)

**Files:**
- Modify: `apps/web/lib/auth-client.ts`

**Step 1: Add anonymousClient plugin**

```ts
import { anonymousClient } from "better-auth/client/plugins";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  plugins: [anonymousClient(), usernameClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

export type SessionUser = NonNullable<ReturnType<typeof useSession>["data"]>["user"];
```

**Step 2: Verify types**

Run: `bun run check-types`
Expected: PASS

**Step 3: Commit**

```
feat: add anonymousClient plugin to auth client
```

---

## Task 4: Server — requireNonGuest middleware + guest expiry check

**Files:**
- Create: `apps/api/src/middleware/require-non-guest.ts`
- Modify: `apps/api/src/middleware/auth.ts`

**Step 1: Write failing tests**

Add to `apps/api/src/__tests__/guest.test.ts`:

```ts
it("returns 403 when guest accesses friends", async () => {
  // Sign in as anonymous
  const anonRes = await testClient.post("/api/auth/sign-in/anonymous");
  const cookies = extractCookies(anonRes);

  const res = await testClient.get("/api/friends", {
    headers: { Cookie: cookies },
  });
  expect(res.status).toBe(403);
});

it("returns 403 when guest accesses groups", async () => {
  const anonRes = await testClient.post("/api/auth/sign-in/anonymous");
  const cookies = extractCookies(anonRes);

  const res = await testClient.get("/api/groups", {
    headers: { Cookie: cookies },
  });
  expect(res.status).toBe(403);
});

it("returns 401 when guest session is expired", async () => {
  // Create guest, then manually set guestExpiresAt to past
  // Then try to access an authenticated route
  // ...
});
```

Run: `bun run --filter @sugara/api test -- --run src/__tests__/guest.test.ts`
Expected: FAIL

**Step 2: Create requireNonGuest middleware**

`apps/api/src/middleware/require-non-guest.ts`:

```ts
import type { Context, Next } from "hono";
import { ERROR_MSG } from "../lib/constants";

export async function requireNonGuest(c: Context, next: Next) {
  const user = c.get("user");
  if (user.isAnonymous) {
    return c.json({ error: ERROR_MSG.GUEST_NOT_ALLOWED }, 403);
  }
  await next();
}
```

**Step 3: Add guest expiry check to requireAuth**

In `apps/api/src/middleware/auth.ts`, after `c.set("user", session.user)` (line 15):

```ts
if (session.user.guestExpiresAt && new Date(session.user.guestExpiresAt) < new Date()) {
  return c.json({ error: ERROR_MSG.GUEST_EXPIRED }, 401);
}
```

**Step 4: Add error messages**

In `apps/api/src/lib/constants.ts`, add to ERROR_MSG:

```ts
GUEST_NOT_ALLOWED: "This feature is not available for guest accounts",
GUEST_TRIP_LIMIT: "Guest accounts can only create 1 trip",
GUEST_EXPIRED: "Guest account has expired",
```

**Step 5: Apply requireNonGuest to routes**

In `apps/api/src/routes/friends.ts`, after `friendRoutes.use("*", requireAuth)` (line 15):
```ts
friendRoutes.use("*", requireNonGuest);
```

In `apps/api/src/routes/groups.ts`, after `groupRoutes.use("*", requireAuth)` (line 19):
```ts
groupRoutes.use("*", requireNonGuest);
```

In `apps/api/src/routes/share.ts`, add `requireNonGuest` to POST and PUT handlers (lines 23, 79):
```ts
shareRoutes.post("/api/trips:id/share", requireAuth, requireNonGuest, requireTripAccess("owner", "id"), async (c) => {
shareRoutes.put("/api/trips:id/share", requireAuth, requireNonGuest, requireTripAccess("owner", "id"), async (c) => {
```

**Step 6: Run tests**

Run: `bun run --filter @sugara/api test -- --run src/__tests__/guest.test.ts`
Expected: PASS

**Step 7: Commit**

```
feat: add requireNonGuest middleware and guest expiry check
```

---

## Task 5: Server — guest trip limit (1 trip)

**Files:**
- Modify: `apps/api/src/routes/trips.ts`

**Step 1: Write failing test**

Add to `apps/api/src/__tests__/guest.test.ts`:

```ts
it("allows guest to create 1 trip", async () => {
  const anonRes = await testClient.post("/api/auth/sign-in/anonymous");
  const cookies = extractCookies(anonRes);

  const res = await testClient.post("/api/trips", {
    headers: { Cookie: cookies },
    body: JSON.stringify({ title: "Test Trip", startDate: "2026-03-01", endDate: "2026-03-02" }),
  });
  expect(res.status).toBe(200);
});

it("returns 403 when guest tries to create 2nd trip", async () => {
  const anonRes = await testClient.post("/api/auth/sign-in/anonymous");
  const cookies = extractCookies(anonRes);

  // Create first trip
  await testClient.post("/api/trips", {
    headers: { Cookie: cookies },
    body: JSON.stringify({ title: "Trip 1", startDate: "2026-03-01", endDate: "2026-03-02" }),
  });

  // Try to create second trip
  const res = await testClient.post("/api/trips", {
    headers: { Cookie: cookies },
    body: JSON.stringify({ title: "Trip 2", startDate: "2026-04-01", endDate: "2026-04-02" }),
  });
  expect(res.status).toBe(403);
});
```

Run: `bun run --filter @sugara/api test -- --run src/__tests__/guest.test.ts`
Expected: FAIL (2nd trip creation succeeds)

**Step 2: Add trip limit check**

In `apps/api/src/routes/trips.ts`, at the top of `tripRoutes.post("/", ...)` handler (after line 70 `const user = c.get("user")`):

```ts
if (user.isAnonymous) {
  const existingTrips = await db
    .select({ id: trips.id })
    .from(trips)
    .innerJoin(tripMembers, and(eq(tripMembers.tripId, trips.id), eq(tripMembers.userId, user.id)))
    .limit(1);
  if (existingTrips.length >= 1) {
    return c.json({ error: ERROR_MSG.GUEST_TRIP_LIMIT }, 403);
  }
}
```

Import `tripMembers` and `and` if not already imported.

**Step 3: Run tests**

Run: `bun run --filter @sugara/api test -- --run src/__tests__/guest.test.ts`
Expected: PASS

**Step 4: Run all tests**

Run: `bun run --filter @sugara/api test`
Expected: All pass (existing tests unaffected)

**Step 5: Commit**

```
feat: limit guest accounts to 1 trip
```

---

## Task 6: Server — set guestExpiresAt on anonymous sign-in

**Files:**
- Modify: `apps/api/src/lib/auth.ts`

**Step 1: Add databaseHooks for guest user creation**

In `apps/api/src/lib/auth.ts`, extend the existing `databaseHooks.user` to also handle `create`:

```ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        if (user.isAnonymous) {
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await db
            .update(schema.users)
            .set({ guestExpiresAt: expiresAt })
            .where(eq(schema.users.id, user.id));
        }
      },
    },
    update: {
      before: async (userData) => {
        if (userData.image && !isValidAvatarUrl(userData.image)) {
          return false;
        }
      },
    },
  },
},
```

Add `import { eq } from "drizzle-orm"` at top.

**Step 2: Write test to verify guestExpiresAt is set**

Add to `apps/api/src/__tests__/guest.test.ts`:

```ts
it("sets guestExpiresAt on anonymous sign-in", async () => {
  const anonRes = await testClient.post("/api/auth/sign-in/anonymous");
  const cookies = extractCookies(anonRes);

  // Fetch session to get user info
  const sessionRes = await testClient.get("/api/auth/get-session", {
    headers: { Cookie: cookies },
  });
  const session = await sessionRes.json();
  expect(session.user.isAnonymous).toBe(true);
  expect(session.user.guestExpiresAt).toBeTruthy();

  const expiresAt = new Date(session.user.guestExpiresAt);
  const now = new Date();
  const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  expect(diffDays).toBeGreaterThan(6);
  expect(diffDays).toBeLessThanOrEqual(7);
});
```

**Step 3: Run tests**

Run: `bun run --filter @sugara/api test -- --run src/__tests__/guest.test.ts`
Expected: PASS

**Step 4: Commit**

```
feat: set guestExpiresAt on anonymous user creation
```

---

## Task 7: Server — onLinkAccount data transfer

**Files:**
- Modify: `apps/api/src/lib/auth.ts`

**Step 1: Add onLinkAccount callback**

In anonymous plugin config:

```ts
anonymous({
  emailDomainName: "guest.sugara.local",
  onLinkAccount: async ({ anonymousUser, newUser }) => {
    // Transfer trip ownership from anonymous user to new user
    await db
      .update(schema.trips)
      .set({ ownerId: newUser.id })
      .where(eq(schema.trips.ownerId, anonymousUser.id));

    // Transfer trip_members
    await db
      .update(schema.tripMembers)
      .set({ userId: newUser.id })
      .where(eq(schema.tripMembers.userId, anonymousUser.id));
  },
}),
```

**Step 2: Commit**

```
feat: add onLinkAccount to transfer guest data on upgrade
```

---

## Task 8: Frontend — guest button on auth pages

**Files:**
- Create: `apps/web/components/guest-button.tsx`
- Modify: `apps/web/components/auth-form.tsx`
- Modify: `apps/web/components/signup-form.tsx`
- Modify: `apps/web/lib/messages.ts`

**Step 1: Add messages**

In `apps/web/lib/messages.ts`, add after `AUTH_PASSWORD_TOO_WEAK` (line 105):

```ts
AUTH_GUEST_STARTED: "ゲストモードで開始しました",
AUTH_GUEST_FAILED: "ゲストアカウントの作成に失敗しました",
AUTH_GUEST_UPGRADE_SUCCESS: "アカウント登録が完了しました",
AUTH_GUEST_UPGRADE_FAILED: "アカウント登録に失敗しました",
AUTH_GUEST_FEATURE_UNAVAILABLE: "この機能を使うにはアカウント登録が必要です",
AUTH_GUEST_TRIP_LIMIT: "ゲストモードでは旅行を1件まで作成できます",
```

**Step 2: Create GuestButton component**

`apps/web/components/guest-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { MSG } from "@/lib/messages";

export function GuestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGuest() {
    setLoading(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        toast.error(MSG.AUTH_GUEST_FAILED);
        return;
      }
      toast.success(MSG.AUTH_GUEST_STARTED);
      router.push("/home");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" className="h-11 w-full" onClick={handleGuest} disabled={loading}>
      {loading ? "作成中..." : "ゲストで試す"}
    </Button>
  );
}
```

**Step 3: Add GuestButton to AuthForm**

In `apps/web/components/auth-form.tsx`, after the closing `</form>` (line 104) and before closing `</CardContent>`:

```tsx
<div className="mt-4 flex items-center gap-4">
  <div className="flex-1 border-t" />
  <span className="text-xs text-muted-foreground">または</span>
  <div className="flex-1 border-t" />
</div>
<div className="mt-4">
  <GuestButton />
</div>
```

Add import: `import { GuestButton } from "@/components/guest-button";`

**Step 4: Add GuestButton to SignupForm**

Same pattern in `apps/web/components/signup-form.tsx`, after `</form>` (line 206) and before closing `</CardContent>`.

**Step 5: Verify**

Run: `bun run check-types && bun run check`
Expected: PASS

**Step 6: Commit**

```
feat: add guest button to login and signup pages
```

---

## Task 9: Frontend — guest banner in header

**Files:**
- Create: `apps/web/components/guest-banner.tsx`
- Modify: `apps/web/components/header.tsx`

**Step 1: Create GuestBanner component**

`apps/web/components/guest-banner.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { GuestUpgradeDialog } from "@/components/guest-upgrade-dialog";

export function GuestBanner() {
  const { data: session } = useSession();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (!session?.user?.isAnonymous || !session.user.guestExpiresAt) return null;

  const expiresAt = new Date(session.user.guestExpiresAt);
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <>
      <div className="border-b bg-amber-50 dark:bg-amber-950/30">
        <div className="container flex items-center justify-between px-4 py-1.5 text-sm">
          <span className="text-amber-900 dark:text-amber-200">
            ゲストモード（残り{daysRemaining}日）
          </span>
          <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => setUpgradeOpen(true)}>
            アカウント登録
          </Button>
        </div>
      </div>
      <GuestUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
```

**Step 2: Add GuestBanner to Header**

In `apps/web/components/header.tsx`, after `<OfflineBanner />` (line 73):

```tsx
<GuestBanner />
```

Add import: `import { GuestBanner } from "@/components/guest-banner";`

**Step 3: Hide friend request polling for guests**

In `apps/web/components/header.tsx`, change the useQuery `enabled` condition (line 57):

```ts
enabled: !!session?.user && !session.user.isAnonymous,
```

**Step 4: Commit (without GuestUpgradeDialog — created in next task)**

Create a placeholder `guest-upgrade-dialog.tsx` first:

```tsx
"use client";

export function GuestUpgradeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  // Implemented in next task
  return null;
}
```

Run: `bun run check-types && bun run check`

```
feat: add guest banner to header
```

---

## Task 10: Frontend — guest upgrade dialog

**Files:**
- Modify: `apps/web/components/guest-upgrade-dialog.tsx`

**Step 1: Implement upgrade dialog**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { signUp } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-error";
import { getPasswordRequirementsText, MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/constants";
import { MSG } from "@/lib/messages";

export function GuestUpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const name = formData.get("name") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const { valid, errors } = validatePassword(password);
    if (!valid) {
      setError(`${MSG.AUTH_PASSWORD_TOO_WEAK}: ${errors.join("、")}`);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(MSG.AUTH_SIGNUP_PASSWORD_MISMATCH);
      setLoading(false);
      return;
    }

    const result = await signUp.email({
      username,
      name,
      email: `${username}@sugara.local`,
      password,
    });

    if (result.error) {
      setError(translateAuthError(result.error, MSG.AUTH_GUEST_UPGRADE_FAILED));
      setLoading(false);
      return;
    }

    toast.success(MSG.AUTH_GUEST_UPGRADE_SUCCESS);
    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>アカウント登録</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            登録するとデータが保持され、全機能が使えるようになります。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="upgrade-username">ユーザー名</Label>
              <Input
                id="upgrade-username"
                name="username"
                pattern="^[a-zA-Z0-9_]+$"
                title="英数字とアンダースコアのみ"
                minLength={3}
                maxLength={20}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-name">表示名</Label>
              <Input id="upgrade-name" name="name" minLength={1} maxLength={50} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-password">パスワード</Label>
              <Input
                id="upgrade-password"
                name="password"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <p className="text-xs text-muted-foreground">{getPasswordRequirementsText()}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-confirmPassword">パスワード（確認）</Label>
              <Input
                id="upgrade-confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            {error && (
              <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "登録中..." : "登録"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
```

**Step 2: Verify**

Run: `bun run check-types && bun run check`
Expected: PASS

**Step 3: Commit**

```
feat: add guest upgrade dialog
```

---

## Task 11: Frontend — guest restriction UI

**Files:**
- Modify: `apps/web/components/header.tsx` (hide friend nav for guests)
- Modify: `apps/web/app/(authenticated)/home/page.tsx` (trip creation limit toast)
- Modify: `apps/web/lib/nav-links.ts` (conditionally hide links)

**Step 1: Investigate nav-links and bottom nav structure**

Read `apps/web/lib/nav-links.ts` and bottom nav component to understand how to conditionally hide friend/group links for guests.

**Step 2: Hide restricted nav links for guests**

In header.tsx, wrap the NAV_LINKS rendering to skip `/friends` when user is guest. Or show the link but redirect to a toast on click.

Preferred approach: show the links, but in the friends page and groups tab, show a message "アカウント登録するとご利用いただけます" when the API returns 403.

**Step 3: Trip creation limit handling**

In the home page, when `POST /api/trips` returns 403, show `MSG.AUTH_GUEST_TRIP_LIMIT` toast.

The existing error handling via `ApiError` class should already surface this. Just ensure the frontend message is user-friendly by checking for the specific error.

**Step 4: Verify**

Run: `bun run check-types && bun run check`

**Step 5: Commit**

```
feat: add guest restriction UI feedback
```

---

## Task 12: Cleanup script

**Files:**
- Create: `apps/api/src/db/cleanup-guests.ts`
- Modify: `apps/api/package.json` (add script)

**Step 1: Create cleanup script**

`apps/api/src/db/cleanup-guests.ts`:

```ts
import { and, eq, lt } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

async function main() {
  const now = new Date();
  const expired = await db
    .delete(users)
    .where(and(eq(users.isAnonymous, true), lt(users.guestExpiresAt, now)))
    .returning({ id: users.id });

  console.log(`Deleted ${expired.length} expired guest account(s)`);
  process.exit(0);
}

main();
```

Note: relies on CASCADE delete in DB for related tables (trips, trip_members, sessions, etc.). Verify CASCADE constraints exist or delete related records first.

**Step 2: Add script to package.json**

In `apps/api/package.json`:

```json
"db:cleanup-guests": "bun src/db/cleanup-guests.ts"
```

And in root `package.json`:

```json
"db:cleanup-guests": "bun run --filter @sugara/api db:cleanup-guests"
```

**Step 3: Commit**

```
feat: add expired guest cleanup script
```

---

## Task 13: Final verification

**Step 1: Run all checks**

```bash
bun run check-types
bun run check
bun run test
```

Expected: All pass

**Step 2: Manual browser test checklist**

- [ ] Login page shows "ゲストで試す" button
- [ ] Signup page shows "ゲストで試す" button
- [ ] Tapping guest button creates account and redirects to /home
- [ ] Header shows "ゲストモード（残り7日）" banner
- [ ] Guest can create 1 trip
- [ ] Guest cannot create 2nd trip (toast error)
- [ ] Friends page returns 403 (toast error)
- [ ] Groups page returns 403 (toast error)
- [ ] "アカウント登録" opens upgrade dialog
- [ ] Upgrade with username+password works, banner disappears
- [ ] Upgraded user retains trip data
- [ ] Desktop: banner and buttons display correctly

**Step 3: Commit any fixes, then final commit**

```
test: verify guest account end-to-end flow
```
