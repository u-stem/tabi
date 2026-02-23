"use client";

import type { ChatMessageResponse, ChatSessionResponse } from "@sugara/shared";
import { CHAT_MESSAGE_MAX_LENGTH } from "@sugara/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisVertical, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useLongPress } from "@/lib/hooks/use-long-press";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type ChatPanelProps = {
  tripId: string;
  canEdit: boolean;
  /** When true, messages fill the container and input is fixed above bottom nav */
  mobile?: boolean;
  onBroadcastMessage?: (message: ChatMessageResponse) => void;
  onBroadcastEdit?: (message: ChatMessageResponse) => void;
  onBroadcastDelete?: (payload: { messageId: string }) => void;
  onBroadcastSession?: (action: "started" | "ended") => void;
};

type SessionResponse = {
  session: ChatSessionResponse | null;
};

type MessagesResponse = {
  items: ChatMessageResponse[];
  nextCursor: string | null;
};

const MESSAGE_GROUP_THRESHOLD_MS = 60 * 1000;
const SCROLL_BOTTOM_THRESHOLD = 50;

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)}\]]/g;

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const index = match.index;
    if (!isValidHttpUrl(url)) continue;
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="underline">
        {url}
      </a>,
    );
    lastIndex = index + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// Sub-component for message content with action triggers
function MessageContent({
  msg,
  isOwn,
  isMobile,
  onEdit,
  onDelete,
}: {
  msg: ChatMessageResponse;
  isOwn: boolean;
  isMobile: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const longPress = useLongPress({
    onLongPress: () => setSheetOpen(true),
    disabled: !isOwn || !isMobile,
  });

  const sheetActions = useMemo(
    () => [
      { label: "編集", icon: <Pencil className="h-4 w-4" />, onClick: onEdit },
      {
        label: "削除",
        icon: <Trash2 className="h-4 w-4" />,
        onClick: onDelete,
        variant: "destructive" as const,
      },
    ],
    [onEdit, onDelete],
  );

  return (
    <div className="group relative min-w-0">
      <div
        {...(isOwn && isMobile
          ? {
              onTouchStart: longPress.onTouchStart,
              onTouchMove: longPress.onTouchMove,
              onTouchEnd: longPress.onTouchEnd,
            }
          : {})}
      >
        <p className="text-sm break-all whitespace-pre-wrap">{linkify(msg.content)}</p>
        {msg.editedAt && <span className="text-[10px] text-muted-foreground/60">(編集済み)</span>}
      </div>

      {/* Desktop: hover action button */}
      {isOwn && !isMobile && (
        <div className="absolute -top-2 right-0 hidden group-hover:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <EllipsisVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Mobile: ActionSheet */}
      {isOwn && isMobile && (
        <ActionSheet open={sheetOpen} onOpenChange={setSheetOpen} actions={sheetActions} />
      )}
    </div>
  );
}

export function ChatPanel({
  tripId,
  canEdit,
  mobile = false,
  onBroadcastMessage,
  onBroadcastEdit,
  onBroadcastDelete,
  onBroadcastSession,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const isMobile = useIsMobile();
  const [input, setInput] = useState("");
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: sessionData, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.trips.chatSession(tripId),
    queryFn: () => api<SessionResponse>(`/api/trips/${tripId}/chat/session`),
  });

  const chatSession = sessionData?.session ?? null;

  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.trips.chatMessages(tripId),
    queryFn: ({ pageParam }) => {
      const params: Record<string, string> = {};
      if (pageParam) params.cursor = pageParam;
      return api<MessagesResponse>(`/api/trips/${tripId}/chat/messages`, { params });
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!chatSession,
  });

  // Messages come from API in desc order per page; reverse for display
  const messages = useMemo(
    () => (messagesData?.pages.flatMap((page) => page.items) ?? []).slice().reverse(),
    [messagesData],
  );

  const startSession = useMutation({
    mutationFn: () => api<SessionResponse>(`/api/trips/${tripId}/chat/session`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.trips.chatSession(tripId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
      onBroadcastSession?.("started");
    },
    onError: (err) => {
      toast.error(
        getApiErrorMessage(err, MSG.CHAT_SESSION_START_FAILED, {
          conflict: MSG.CHAT_SESSION_ALREADY_EXISTS,
        }),
      );
    },
  });

  const endSession = useMutation({
    mutationFn: () => api(`/api/trips/${tripId}/chat/session`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.trips.chatSession(tripId), { session: null });
      queryClient.removeQueries({ queryKey: queryKeys.trips.chatMessages(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
      toast.success(MSG.CHAT_SESSION_ENDED);
      onBroadcastSession?.("ended");
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, MSG.CHAT_SESSION_END_FAILED));
    },
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      api<ChatMessageResponse>(`/api/trips/${tripId}/chat/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (message) => {
      queryClient.setQueryData<{ pages: MessagesResponse[]; pageParams: string[] }>(
        queryKeys.trips.chatMessages(tripId),
        (old) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          return {
            ...old,
            pages: [{ ...firstPage, items: [message, ...firstPage.items] }, ...old.pages.slice(1)],
          };
        },
      );
      shouldAutoScroll.current = true;
      onBroadcastMessage?.(message);
    },
    onError: (err, content) => {
      setInput(content);
      toast.error(getApiErrorMessage(err, MSG.CHAT_MESSAGE_SEND_FAILED));
    },
  });

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

  const handleStartEdit = useCallback((msg: ChatMessageResponse) => {
    setEditingMessage({ id: msg.id, content: msg.content });
    setInput(msg.content);
    // Focus textarea after state update
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInput("");
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");

    if (editingMessage) {
      editMessage.mutate({ messageId: editingMessage.id, content: trimmed });
      setEditingMessage(null);
      return;
    }

    // Auto-start session on first message
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape" && editingMessage) {
        e.preventDefault();
        handleCancelEdit();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, editingMessage, handleCancelEdit],
  );

  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      SCROLL_BOTTOM_THRESHOLD;
    shouldAutoScroll.current = atBottom;
  }, []);

  const showSkeleton = useDelayedLoading(isSessionLoading);

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full rounded-md border border-dashed" />
      </div>
    );
  }

  if (isSessionLoading) return null;

  const isActive = !!chatSession;

  return (
    <div className={mobile ? "flex flex-col" : ""}>
      {/* Status bar */}
      {isActive && canEdit && (
        <div className="flex items-center justify-between rounded-t-md border-b bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">作戦会議中</span>
          <button
            type="button"
            onClick={() => setEndConfirmOpen(true)}
            disabled={endSession.isPending}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          >
            {endSession.isPending ? "終了中..." : "終了する"}
          </button>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className={
          mobile
            ? "flex flex-col overflow-y-auto overscroll-contain p-3"
            : "min-h-24 max-h-80 overflow-y-auto overscroll-contain rounded-md border border-dashed p-3"
        }
        style={mobile ? { height: "calc(100dvh - 16rem)" } : undefined}
        onScroll={handleScroll}
      >
        {isActive && hasNextPage && (
          <div className="pb-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "過去のメッセージ"
              )}
            </Button>
          </div>
        )}
        {!isActive || messages.length === 0 ? (
          <div className={`flex min-h-16 items-center justify-center ${mobile ? "mt-auto" : ""}`}>
            <p className="text-sm text-muted-foreground">{MSG.CHAT_EMPTY}</p>
          </div>
        ) : isMessagesLoading ? (
          <div className={`space-y-3 py-2 ${mobile ? "mt-auto" : ""}`}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-40 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={mobile ? "mt-auto" : ""}>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const timeDiff = prev
                ? new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()
                : 0;
              const isGrouped =
                prev?.userId === msg.userId && timeDiff < MESSAGE_GROUP_THRESHOLD_MS;
              const isOwn = msg.userId === currentUserId;
              return isGrouped ? (
                <div key={msg.id} className="pl-9 mt-0.5">
                  <MessageContent
                    msg={msg}
                    isOwn={isOwn}
                    isMobile={isMobile}
                    onEdit={() => handleStartEdit(msg)}
                    onDelete={() => setDeleteTarget(msg.id)}
                  />
                </div>
              ) : (
                <div key={msg.id} className={`flex gap-2 ${i > 0 ? "mt-3" : ""}`}>
                  <UserAvatar
                    name={msg.userName}
                    image={msg.userImage}
                    className="h-7 w-7 shrink-0 mt-0.5"
                    fallbackClassName="text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs">
                      <span className="font-medium">{msg.userName}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground/60">
                        {formatTime(msg.createdAt)}
                      </span>
                      {msg.editedAt && (
                        <span className="ml-1 text-[10px] text-muted-foreground/60">
                          (編集済み)
                        </span>
                      )}
                    </p>
                    <MessageContent
                      msg={msg}
                      isOwn={isOwn}
                      isMobile={isMobile}
                      onEdit={() => handleStartEdit(msg)}
                      onDelete={() => setDeleteTarget(msg.id)}
                    />
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      {canEdit && (
        <div
          className={mobile ? "fixed right-0 left-0 z-20 border-t bg-background px-4 py-2" : "mt-2"}
          style={mobile ? { bottom: "calc(3rem + env(safe-area-inset-bottom, 0px))" } : undefined}
        >
          {/* Edit mode bar */}
          {editingMessage && (
            <div className="mb-1 flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">メッセージを編集中</span>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              rows={1}
              disabled={startSession.isPending}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending || startSession.isPending}
            >
              {sendMessage.isPending || startSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* End session confirmation */}
      <ResponsiveAlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>作戦会議を終了しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              すべてのメッセージが削除されます。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>キャンセル</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => {
                setEndConfirmOpen(false);
                endSession.mutate();
              }}
            >
              <X className="h-4 w-4" />
              終了する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>

      {/* Delete message confirmation */}
      <ResponsiveAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
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
              <Trash2 className="h-4 w-4" />
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </div>
  );
}
