# Chat Message Edit/Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add edit and delete functionality for own chat messages in the strategy meeting feature.

**Architecture:** Add `editedAt` column to chatMessages, PATCH/DELETE API endpoints with author-only access, realtime broadcast for sync, and mobile (long-press + ActionSheet) / desktop (hover + DropdownMenu) UI with optimistic updates.

**Tech Stack:** Drizzle ORM, Hono, Zod, React Query (infinite query), Supabase Realtime, shadcn/ui (ActionSheet, DropdownMenu, ResponsiveAlertDialog)

---

### Task 1: Shared Schema & Types

**Files:**
- Modify: `packages/shared/src/schemas/chat.ts`
- Modify: `packages/shared/src/types.ts`

**Step 1: Add `updateChatMessageSchema` to shared schemas**

In `packages/shared/src/schemas/chat.ts`, add after `sendChatMessageSchema`:

```typescript
export const updateChatMessageSchema = z.object({
  content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
});
```

**Step 2: Add `editedAt` to `ChatMessageResponse`**

In `packages/shared/src/types.ts`, add `editedAt` field to `ChatMessageResponse`:

```typescript
export type ChatMessageResponse = {
  id: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  content: string;
  createdAt: string;
  editedAt?: string;
};
```

**Step 3: Commit**

```bash
git add packages/shared/src/schemas/chat.ts packages/shared/src/types.ts
git commit -m "feat: ChatMessageResponse に editedAt と updateChatMessageSchema を追加"
```

---

### Task 2: DB Schema

**Files:**
- Modify: `apps/api/src/db/schema.ts` (chatMessages table, around line 467-483)

**Step 1: Add `editedAt` column to chatMessages**

In the `chatMessages` table definition, add after `createdAt`:

```typescript
editedAt: timestamp("edited_at", { withTimezone: true }),
```

**Step 2: Push schema to DB**

```bash
bun run db:push
```

**Step 3: Commit**

```bash
git add apps/api/src/db/schema.ts
git commit -m "feat: chatMessages テーブルに editedAt カラムを追加"
```

---

### Task 3: API Tests (Red)

**Files:**
- Modify: `apps/api/src/__tests__/chat.test.ts`

**Step 1: Add mockDbQuery for chatMessages**

In the `vi.hoisted` block, add `chatMessages` to `mockDbQuery`:

```typescript
mockDbQuery: {
  chatSessions: { findFirst: vi.fn() },
  chatMessages: { findFirst: vi.fn() },
  tripMembers: { findFirst: vi.fn() },
},
```

**Step 2: Write PATCH tests**

Add after the `POST /:tripId/chat/messages` describe block:

```typescript
describe("PATCH /:tripId/chat/messages/:messageId", () => {
  it("updates message content and returns 200", async () => {
    const now = new Date();
    mockDbQuery.chatMessages.findFirst.mockResolvedValue({
      id: "msg-1",
      sessionId,
      userId: TEST_USER.id,
      content: "original",
      createdAt: now,
      editedAt: null,
    });
    const updatedAt = new Date();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "msg-1",
              sessionId,
              userId: TEST_USER.id,
              content: "updated",
              createdAt: now,
              editedAt: updatedAt,
            },
          ]),
        }),
      }),
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ name: TEST_USER.name, image: null }]),
        }),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "updated" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content).toBe("updated");
    expect(data.editedAt).toBeDefined();
  });

  it("returns 404 if message not found", async () => {
    mockDbQuery.chatMessages.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "updated" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 if not message author", async () => {
    mockDbQuery.chatMessages.findFirst.mockResolvedValue({
      id: "msg-1",
      sessionId,
      userId: "other-user-id",
      content: "original",
      createdAt: new Date(),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "updated" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for empty content", async () => {
    const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "" }),
    });
    expect(res.status).toBe(400);
  });
});
```

**Step 3: Write DELETE tests**

```typescript
describe("DELETE /:tripId/chat/messages/:messageId", () => {
  it("deletes message and returns 204", async () => {
    mockDbQuery.chatMessages.findFirst.mockResolvedValue({
      id: "msg-1",
      sessionId,
      userId: TEST_USER.id,
      content: "to delete",
      createdAt: new Date(),
    });
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 if message not found", async () => {
    mockDbQuery.chatMessages.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 if not message author", async () => {
    mockDbQuery.chatMessages.findFirst.mockResolvedValue({
      id: "msg-1",
      sessionId,
      userId: "other-user-id",
      content: "someone else's",
      createdAt: new Date(),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });
});
```

**Step 4: Run tests to verify they fail**

```bash
bun run --filter @sugara/api test
```

Expected: FAIL (routes not implemented yet)

**Step 5: Commit**

```bash
git add apps/api/src/__tests__/chat.test.ts
git commit -m "test: メッセージ編集・削除APIのテストを追加 (Red)"
```

---

### Task 4: API Implementation (Green)

**Files:**
- Modify: `apps/api/src/routes/chat.ts`
- Modify: `apps/api/src/lib/constants.ts`

**Step 1: Add error messages**

In `apps/api/src/lib/constants.ts`, add to `ERROR_MSG`:

```typescript
CHAT_MESSAGE_NOT_FOUND: "Chat message not found",
CHAT_MESSAGE_NOT_AUTHOR: "Not the message author",
```

**Step 2: Add PATCH route**

In `apps/api/src/routes/chat.ts`, add `updateChatMessageSchema` to imports and add after the POST messages route:

```typescript
// PATCH /:tripId/chat/messages/:messageId
chatRoutes.patch("/:tripId/chat/messages/:messageId", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const messageId = c.req.param("messageId");

  const body = await c.req.json();
  const parsed = updateChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, messageId),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CHAT_MESSAGE_NOT_FOUND }, 404);
  }
  if (existing.userId !== user.id) {
    return c.json({ error: ERROR_MSG.CHAT_MESSAGE_NOT_AUTHOR }, 403);
  }

  const [updated] = await db
    .update(chatMessages)
    .set({ content: parsed.data.content, editedAt: new Date() })
    .where(eq(chatMessages.id, messageId))
    .returning();

  const [dbUser] = await db
    .select({ name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return c.json({
    id: updated.id,
    userId: user.id,
    userName: dbUser.name,
    userImage: dbUser.image,
    content: updated.content,
    createdAt: updated.createdAt.toISOString(),
    editedAt: updated.editedAt?.toISOString(),
  });
});
```

**Step 3: Add DELETE route**

```typescript
// DELETE /:tripId/chat/messages/:messageId
chatRoutes.delete("/:tripId/chat/messages/:messageId", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const messageId = c.req.param("messageId");

  const existing = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, messageId),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CHAT_MESSAGE_NOT_FOUND }, 404);
  }
  if (existing.userId !== user.id) {
    return c.json({ error: ERROR_MSG.CHAT_MESSAGE_NOT_AUTHOR }, 403);
  }

  await db.delete(chatMessages).where(eq(chatMessages.id, messageId));

  return c.body(null, 204);
});
```

**Step 4: Update GET messages to include editedAt**

In the GET `/:tripId/chat/messages` route, add `editedAt` to the select:

```typescript
editedAt: chatMessages.editedAt,
```

And in the response mapping:

```typescript
items: items.map((m) => ({
  ...m,
  createdAt: m.createdAt.toISOString(),
  editedAt: m.editedAt?.toISOString(),
})),
```

**Step 5: Run tests**

```bash
bun run --filter @sugara/api test
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/api/src/routes/chat.ts apps/api/src/lib/constants.ts
git commit -m "feat: メッセージ編集(PATCH)・削除(DELETE) APIを実装"
```

---

### Task 5: Realtime Broadcast Events

**Files:**
- Modify: `apps/web/lib/hooks/use-trip-sync.ts`
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Modify: `apps/web/components/chat-panel.tsx`

**Step 1: Add new broadcast events to `use-trip-sync.ts`**

Add two new events in the channel subscription (after `chat:message`):

```typescript
.on("broadcast", { event: "chat:message:edit" }, ({ payload }) => {
  onChatMessageEditRef.current?.(payload);
})
.on("broadcast", { event: "chat:message:delete" }, ({ payload }) => {
  onChatMessageDeleteRef.current?.(payload);
})
```

Add corresponding refs, options, and broadcast functions following the existing `broadcastChatMessage` pattern.

Add to `TripSyncOptions`:
```typescript
onChatMessageEdit?: (payload: unknown) => void;
onChatMessageDelete?: (payload: unknown) => void;
```

Add to return value:
```typescript
broadcastChatMessageEdit: (payload: unknown) => void;
broadcastChatMessageDelete: (payload: unknown) => void;
```

**Step 2: Wire up in trip detail page**

In `apps/web/app/(authenticated)/trips/[id]/page.tsx`:

- Add `onChatMessageEdit` and `onChatMessageDelete` callbacks that update the React Query cache
- Pass `broadcastChatMessageEdit` and `broadcastChatMessageDelete` through to ChatPanel

**Step 3: Update ChatPanel props**

Add to `ChatPanelProps`:

```typescript
onBroadcastEdit?: (message: ChatMessageResponse) => void;
onBroadcastDelete?: (payload: { messageId: string }) => void;
```

**Step 4: Commit**

```bash
git add apps/web/lib/hooks/use-trip-sync.ts 'apps/web/app/(authenticated)/trips/[id]/page.tsx' apps/web/components/chat-panel.tsx
git commit -m "feat: メッセージ編集・削除のリアルタイム同期イベントを追加"
```

---

### Task 6: useLongPress Hook

**Files:**
- Create: `apps/web/lib/hooks/use-long-press.ts`

**Step 1: Create the hook**

```typescript
import { useCallback, useRef } from "react";

const LONG_PRESS_DURATION = 500;
const MOVE_THRESHOLD = 10;

type UseLongPressOptions = {
  onLongPress: () => void;
  disabled?: boolean;
};

export function useLongPress({ onLongPress, disabled }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPos.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      firedRef.current = false;
      const touch = e.touches[0];
      startPos.current = { x: touch.clientX, y: touch.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        onLongPress();
      }, LONG_PRESS_DURATION);
    },
    [onLongPress, disabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPos.current || !timerRef.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPos.current.x);
      const dy = Math.abs(touch.clientY - startPos.current.y);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        clear();
      }
    },
    [clear],
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
```

**Step 2: Commit**

```bash
git add apps/web/lib/hooks/use-long-press.ts
git commit -m "feat: useLongPress フックを追加"
```

---

### Task 7: Frontend Messages

**Files:**
- Modify: `apps/web/lib/messages.ts`

**Step 1: Add message constants**

```typescript
CHAT_MESSAGE_EDIT_FAILED: "メッセージの編集に失敗しました",
CHAT_MESSAGE_DELETE_FAILED: "メッセージの削除に失敗しました",
```

**Step 2: Commit**

```bash
git add apps/web/lib/messages.ts
git commit -m "feat: メッセージ編集・削除のエラーメッセージを追加"
```

---

### Task 8: ChatPanel UI - Edit & Delete

**Files:**
- Modify: `apps/web/components/chat-panel.tsx`

This is the largest task. It adds:
1. `currentUserId` prop (from `useSession` in parent)
2. Edit/delete mutations with optimistic updates
3. Edit mode state (`editingMessage`)
4. Mobile: long-press → ActionSheet
5. Desktop: hover → DropdownMenu with Pencil/Trash2 icons
6. Delete confirmation via ResponsiveAlertDialog
7. Edit bar above input ("editing message" indicator)
8. `(edited)` label on edited messages

**Step 1: Add imports**

Add to existing imports:

```typescript
import { Pencil, Trash2 } from "lucide-react";
import { ActionSheet } from "@/components/action-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useLongPress } from "@/lib/hooks/use-long-press";
import { useSession } from "@/lib/auth-client";
```

**Step 2: Add edit/delete state and mutations**

Inside `ChatPanel` function:

```typescript
const { data: session } = useSession();
const currentUserId = session?.user?.id;
const isMobile = useIsMobile();
const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
const [actionSheetOpen, setActionSheetOpen] = useState(false);
const [actionSheetTarget, setActionSheetTarget] = useState<ChatMessageResponse | null>(null);
```

Edit mutation:
```typescript
const editMessage = useMutation({
  mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
    api<ChatMessageResponse>(`/api/trips/${tripId}/chat/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),
  onMutate: async ({ messageId, content }) => {
    const previousData = queryClient.getQueryData(queryKeys.trips.chatMessages(tripId));
    queryClient.setQueryData<{ pages: MessagesResponse[]; pageParams: string[] }>(
      queryKeys.trips.chatMessages(tripId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) =>
              m.id === messageId ? { ...m, content, editedAt: new Date().toISOString() } : m,
            ),
          })),
        };
      },
    );
    return { previousData };
  },
  onError: (err, _, context) => {
    queryClient.setQueryData(queryKeys.trips.chatMessages(tripId), context?.previousData);
    toast.error(getApiErrorMessage(err, MSG.CHAT_MESSAGE_EDIT_FAILED));
  },
  onSuccess: (message) => {
    onBroadcastEdit?.(message);
  },
});
```

Delete mutation:
```typescript
const deleteMessage = useMutation({
  mutationFn: (messageId: string) =>
    api(`/api/trips/${tripId}/chat/messages/${messageId}`, { method: "DELETE" }),
  onMutate: async (messageId) => {
    const previousData = queryClient.getQueryData(queryKeys.trips.chatMessages(tripId));
    queryClient.setQueryData<{ pages: MessagesResponse[]; pageParams: string[] }>(
      queryKeys.trips.chatMessages(tripId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((m) => m.id !== messageId),
          })),
        };
      },
    );
    return { previousData };
  },
  onError: (err, _, context) => {
    queryClient.setQueryData(queryKeys.trips.chatMessages(tripId), context?.previousData);
    toast.error(getApiErrorMessage(err, MSG.CHAT_MESSAGE_DELETE_FAILED));
  },
  onSuccess: (_, messageId) => {
    onBroadcastDelete?.({ messageId });
  },
});
```

**Step 3: Modify handleSend for edit mode**

```typescript
const handleSend = useCallback(async () => {
  const trimmed = input.trim();
  if (!trimmed) return;
  setInput("");

  if (editingMessage) {
    editMessage.mutate({ messageId: editingMessage.id, content: trimmed });
    setEditingMessage(null);
    return;
  }

  if (!chatSession) {
    try {
      await startSession.mutateAsync();
    } catch {
      setInput(trimmed);
      return;
    }
  }
  sendMessage.mutate(trimmed);
}, [input, chatSession, startSession, sendMessage, editingMessage, editMessage]);
```

**Step 4: Create ChatMessage component with actions**

Extract message rendering into a sub-component within chat-panel.tsx that handles:
- Long press (mobile) → opens ActionSheet with edit/delete options
- Hover (desktop) → shows DropdownMenu trigger button
- `(edited)` label display

**Step 5: Add edit bar above input**

```tsx
{editingMessage && (
  <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
    <span className="text-xs text-muted-foreground">メッセージを編集中</span>
    <button
      type="button"
      onClick={() => {
        setEditingMessage(null);
        setInput("");
      }}
      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
)}
```

**Step 6: Add delete confirmation dialog**

```tsx
<ResponsiveAlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
  <ResponsiveAlertDialogContent>
    <ResponsiveAlertDialogHeader>
      <ResponsiveAlertDialogTitle>メッセージを削除しますか？</ResponsiveAlertDialogTitle>
      <ResponsiveAlertDialogDescription>
        この操作は取り消せません。
      </ResponsiveAlertDialogDescription>
    </ResponsiveAlertDialogHeader>
    <ResponsiveAlertDialogFooter>
      <ResponsiveAlertDialogCancel>キャンセル</ResponsiveAlertDialogCancel>
      <ResponsiveAlertDialogDestructiveAction
        onClick={() => {
          if (deleteTarget) deleteMessage.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      >
        削除する
      </ResponsiveAlertDialogDestructiveAction>
    </ResponsiveAlertDialogFooter>
  </ResponsiveAlertDialogContent>
</ResponsiveAlertDialog>
```

**Step 7: Commit**

```bash
git add apps/web/components/chat-panel.tsx
git commit -m "feat: メッセージ編集・削除UIを実装"
```

---

### Task 9: Wire Up Realtime in Trip Detail Page

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx`

**Step 1: Add onChatMessageEdit and onChatMessageDelete handlers**

In the trip detail page, add callbacks that update the infinite query cache when receiving broadcast events:

```typescript
const onChatMessageEdit = useCallback(
  (payload: unknown) => {
    const msg = payload as ChatMessageResponse;
    queryClient.setQueryData<{ pages: MessagesResponse[]; pageParams: string[] }>(
      queryKeys.trips.chatMessages(tripId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) => (m.id === msg.id ? msg : m)),
          })),
        };
      },
    );
  },
  [queryClient, tripId],
);

const onChatMessageDelete = useCallback(
  (payload: unknown) => {
    const { messageId } = payload as { messageId: string };
    queryClient.setQueryData<{ pages: MessagesResponse[]; pageParams: string[] }>(
      queryKeys.trips.chatMessages(tripId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((m) => m.id !== messageId),
          })),
        };
      },
    );
  },
  [queryClient, tripId],
);
```

Pass these to `useTripSync` options and pass broadcast functions to `ChatPanel`.

**Step 2: Update RightPanel to pass new props**

Add `onBroadcastEdit` and `onBroadcastDelete` props through RightPanel to ChatPanel.

**Step 3: Commit**

```bash
git add 'apps/web/app/(authenticated)/trips/[id]/page.tsx' 'apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx'
git commit -m "feat: メッセージ編集・削除のリアルタイム受信を接続"
```

---

### Task 10: Lint, Type Check, and Final Verification

**Step 1: Run type check**

```bash
bun run check-types
```

**Step 2: Run lint**

```bash
bun run check
```

**Step 3: Run all tests**

```bash
bun run test
```

**Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: lint・型エラーを修正"
```
