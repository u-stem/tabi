# QR Scanner for Friend Requests

## Overview

Add an in-app QR code scanner to the My Page so users can scan friend-request QR codes without leaving the app. Supports both camera-based real-time scanning and image file upload (e.g., screenshots).

## Motivation

Currently, scanning a friend-request QR code requires launching the device's native camera app, which switches context away from sugara. An in-app scanner keeps the flow seamless.

## Scope

- Friend request QR codes only (`/friends/add?userId=<uuid>`)
- Trip sharing and quick poll QR codes are out of scope for this iteration

## Technology

- **Library**: `html5-qrcode` (npm)
- **API used**: `Html5Qrcode` class (low-level API, not the scanner widget) for full UI control with shadcn/ui
- **Bundle**: ~150KB raw / ~50KB gzipped

## UI Design

### Entry Point

My Page header (`apps/web/app/(sp)/sp/my/page.tsx`), next to the existing "QRコード" button:

```
[編集] [QRコード] [QR読み取り(new)]
```

- Icon: `ScanLine` from lucide-react
- Button style: same as existing QR button (`variant="outline" size="sm" rounded-full`)
- Tooltip: "QRコードを読み取る"

### Scanner Dialog

New component: `apps/web/components/qr-scanner-dialog.tsx`

Uses `ResponsiveDialog` (Drawer on mobile, Dialog on desktop) — same pattern as `my-qr-dialog.tsx`.

**Layout:**

```
+----------------------------------+
| QRコードを読み取る          [x] |
+----------------------------------+
| [カメラ] [画像]    <- Tabs       |
|                                  |
|  +----------------------------+  |
|  |                            |  |
|  |   Camera view / Upload     |  |
|  |          area              |  |
|  |                            |  |
|  +----------------------------+  |
|                                  |
|  (error message area)           |
+----------------------------------+
```

**Camera tab (default):**
- On dialog open, request camera permission and start scanning
- Fixed aspect ratio viewport with scan region
- On successful QR detection, stop camera and navigate

**Image tab:**
- File input (`accept="image/*"`) with a styled upload area
- On file selection, decode QR from image using `Html5Qrcode.scanFileV2()`
- On success, navigate; on failure, show error

**Tab component:** shadcn/ui `Tabs`

### Dialog Max Width

`sm:max-w-sm` — slightly wider than the QR display dialog (`sm:max-w-xs`) to accommodate the camera viewport.

## Scan Flow

```
QR detected
  → Extract URL string
  → Validate: matches `{window.location.origin}/friends/add?userId={uuid}`
  → Valid: router.push(`/friends/add?userId={uuid}`)
  → Invalid: show error in dialog, allow retry
```

### Validation Rules

1. Decoded text must be a valid URL
2. Origin must match `window.location.origin`
3. Pathname must be `/friends/add`
4. `userId` query parameter must be a valid UUID (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)
5. If any check fails, display an error message and allow re-scan

### URL Validation Helper

Extract into a pure function `parseQrFriendUrl(text: string, origin: string): string | null` that returns the userId or null. This is testable independently.

## Error Handling

| Scenario | Message |
|---|---|
| Camera permission denied | "カメラへのアクセスが許可されていません。画像アップロードをお試しください" |
| Invalid QR code | "このQRコードはフレンド申請には使用できません" |
| No QR in image | "QRコードを検出できませんでした。別の画像を試してください" |
| Camera not available | "カメラが見つかりません。画像アップロードをお試しください" |

Errors display below the scan area as a styled message (muted-foreground text).

## Cleanup

- On dialog close: stop camera, release media stream
- On tab switch from camera to image: stop camera
- On tab switch from image to camera: start camera
- On unmount: stop camera (safety net)

## New Files

| File | Purpose |
|---|---|
| `apps/web/components/qr-scanner-dialog.tsx` | Scanner dialog component |
| `apps/web/lib/qr-utils.ts` | `parseQrFriendUrl()` helper |
| `apps/web/lib/__tests__/qr-utils.test.ts` | Tests for URL validation |

## Modified Files

| File | Change |
|---|---|
| `apps/web/app/(sp)/sp/my/page.tsx` | Add QR scanner button next to existing QR button |
| `apps/web/package.json` | Add `html5-qrcode` dependency |

## Dependencies

- `html5-qrcode` (new) — QR code scanning from camera and image files

## Testing Strategy

- **Unit tests**: `parseQrFriendUrl()` — valid URLs, wrong origin, wrong path, missing userId, invalid UUID, non-URL text
- **Component behavior**: Manual testing for camera integration (camera APIs cannot be unit-tested meaningfully)

## Out of Scope

- Scanning QR codes for trip sharing or quick polls
- Clipboard paste functionality
- QR code scanning from other pages (friends tab, etc.)
