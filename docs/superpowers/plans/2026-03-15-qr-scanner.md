# QR Scanner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app QR code scanner to the My Page for reading friend-request QR codes via camera or image upload.

**Architecture:** Pure function `parseQrFriendUrl` handles URL validation (testable). `QrScannerDialog` is a self-contained trigger+dialog component using `html5-qrcode` for camera/image scanning, loaded via `next/dynamic` with `ssr: false`. Follows the same `ResponsiveDialog` pattern as the existing `MyQrDialog`.

**Tech Stack:** html5-qrcode, React 19, shadcn/ui (Tabs, ResponsiveDialog, Tooltip), Next.js dynamic import, Vitest

---

## Chunk 1: Core Logic and Integration

### Task 1: Install html5-qrcode

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dependency**

Run: `bun add html5-qrcode --cwd apps/web`

- [ ] **Step 2: Verify installation**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore: html5-qrcodeパッケージ追加"
```

---

### Task 2: QR URL validation helper (TDD)

**Files:**
- Create: `apps/web/lib/qr-utils.ts`
- Create: `apps/web/lib/__tests__/qr-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/lib/__tests__/qr-utils.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseQrFriendUrl } from "../qr-utils";

const ORIGIN = "https://sugara.vercel.app";

describe("parseQrFriendUrl", () => {
  it("returns userId from valid friend add URL", () => {
    const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const url = `${ORIGIN}/friends/add?userId=${userId}`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBe(userId);
  });

  it("returns null for wrong origin", () => {
    const url = "https://evil.com/friends/add?userId=a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null for wrong pathname", () => {
    const url = `${ORIGIN}/trips/add?userId=a1b2c3d4-e5f6-7890-abcd-ef1234567890`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null when userId param is missing", () => {
    const url = `${ORIGIN}/friends/add`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null for invalid UUID format", () => {
    const url = `${ORIGIN}/friends/add?userId=not-a-uuid`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null for non-URL text", () => {
    expect(parseQrFriendUrl("hello world", ORIGIN)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseQrFriendUrl("", ORIGIN)).toBeNull();
  });

  it("handles percent-encoded userId", () => {
    const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const url = `${ORIGIN}/friends/add?userId=${encodeURIComponent(userId)}`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBe(userId);
  });

  it("accepts case-insensitive UUID", () => {
    const userId = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890";
    const url = `${ORIGIN}/friends/add?userId=${userId}`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBe(userId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/web test -- lib/__tests__/qr-utils.test.ts`
Expected: FAIL — `parseQrFriendUrl` is not defined

- [ ] **Step 3: Implement parseQrFriendUrl**

Create `apps/web/lib/qr-utils.ts`:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract userId from a friend-add QR code URL.
 * Returns the userId string if valid, null otherwise.
 */
export function parseQrFriendUrl(
  text: string,
  origin: string,
): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.origin !== origin) return null;
  if (url.pathname !== "/friends/add") return null;

  const userId = url.searchParams.get("userId");
  if (!userId || !UUID_RE.test(userId)) return null;

  return userId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @sugara/web test -- lib/__tests__/qr-utils.test.ts`
Expected: PASS — all 9 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/qr-utils.ts apps/web/lib/__tests__/qr-utils.test.ts
git commit -m "feat: QRコードURL解析ヘルパー追加"
```

---

### Task 3: QR Scanner Dialog component

**Files:**
- Create: `apps/web/components/qr-scanner-dialog.tsx`

**Reference:**
- Pattern: `apps/web/components/my-qr-dialog.tsx` (self-contained trigger+dialog)
- UI: `apps/web/components/ui/responsive-dialog.tsx`, `apps/web/components/ui/tabs.tsx`, `apps/web/components/ui/tooltip.tsx`

- [ ] **Step 1: Create QrScannerDialog component**

Create `apps/web/components/qr-scanner-dialog.tsx`:

```tsx
"use client";

import { Html5Qrcode } from "html5-qrcode";
import { ImageIcon, ScanLine, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseQrFriendUrl } from "@/lib/qr-utils";

const READER_ID = "qr-reader";

export function QrScannerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("camera");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        const state = scanner.getState();
        // 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
          await scanner.stop();
        }
      } catch {
        // already stopped
      }
    }
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      const origin = window.location.origin;
      const userId = parseQrFriendUrl(decodedText, origin);
      if (userId) {
        setError(null);
        await stopScanner();
        setOpen(false);
        router.push(`/friends/add?userId=${encodeURIComponent(userId)}`);
      } else {
        setError("このQRコードはフレンド申請には使用できません");
      }
    },
    [router, stopScanner],
  );

  const startScanner = useCallback(async () => {
    setError(null);
    // Wait for the DOM element to be available
    await new Promise((r) => setTimeout(r, 100));

    const el = document.getElementById(READER_ID);
    if (!el) return;

    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // QR not found in frame — ignore
        },
      );
    } catch (err) {
      const isNotFound =
        err instanceof DOMException && err.name === "NotFoundError";
      setError(
        isNotFound
          ? "カメラが見つかりません。画像アップロードをお試しください"
          : "カメラへのアクセスが許可されていません。画像アップロードをお試しください",
      );
    }
  }, [handleScanSuccess]);

  // Start/stop camera based on dialog open state and active tab
  useEffect(() => {
    if (open && tab === "camera") {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [open, tab, startScanner, stopScanner]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Ensure scanner instance exists for file scanning
    let scanner = scannerRef.current;
    if (!scanner) {
      scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
    }

    try {
      const result = await scanner.scanFileV2(file, false);
      await handleScanSuccess(result.decodedText);
    } catch {
      setError("QRコードを検出できませんでした。別の画像を試してください");
    }

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
      setTab("camera");
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
            >
              <ScanLine className="h-3.5 w-3.5" />
              読み取り
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>QRコードを読み取る</TooltipContent>
      </Tooltip>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>QRコードを読み取る</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="camera" className="flex-1 gap-1.5">
              <Video className="h-3.5 w-3.5" />
              カメラ
            </TabsTrigger>
            <TabsTrigger value="image" className="flex-1 gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              画像
            </TabsTrigger>
          </TabsList>
          <TabsContent value="camera">
            <div
              id={READER_ID}
              className="aspect-square w-full overflow-hidden rounded-lg"
            />
          </TabsContent>
          <TabsContent value="image">
            <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-muted-foreground/50">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                タップして画像を選択
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </TabsContent>
        </Tabs>
        {error && (
          <p className="text-sm text-muted-foreground text-center">{error}</p>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `bun run --filter @sugara/web check`
Expected: PASS (fix any auto-fixable issues)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/qr-scanner-dialog.tsx
git commit -m "feat: QRスキャナーダイアログコンポーネント追加"
```

---

### Task 4: Integrate into My Page

**Files:**
- Modify: `apps/web/app/(sp)/sp/my/page.tsx`

- [ ] **Step 1: Add dynamic import and render QrScannerDialog**

In `apps/web/app/(sp)/sp/my/page.tsx`:

Add import at top (after existing imports):

```typescript
import dynamic from "next/dynamic";

const QrScannerDialog = dynamic(
  () =>
    import("@/components/qr-scanner-dialog").then((m) => ({
      default: m.QrScannerDialog,
    })),
  { ssr: false },
);
```

Then modify line 82, changing:

```tsx
{userId && <MyQrDialog userId={userId} />}
```

to:

```tsx
{userId && (
  <>
    <MyQrDialog userId={userId} />
    <QrScannerDialog />
  </>
)}
```

- [ ] **Step 2: Run type check**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `bun run --filter @sugara/web check`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `bun run test`
Expected: PASS — all existing tests still green

- [ ] **Step 5: Manual verification**

1. Open `http://localhost:3000/sp/my`
2. Verify the new scan button appears next to the "QRコード" button
3. Click the scan button — dialog opens with camera/image tabs
4. Camera tab: camera activates (or shows permission error)
5. Image tab: file upload area is shown
6. Close dialog — camera stops
7. Scan a valid QR code (from another device or screenshot) — navigates to `/friends/add?userId=...`
8. Scan an invalid QR code — error message appears in dialog

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(sp)/sp/my/page.tsx
git commit -m "feat: マイページにQRスキャナーボタン追加"
```
