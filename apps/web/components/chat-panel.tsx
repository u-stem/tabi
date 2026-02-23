"use client";

import type { ChatMessageResponse, ChatSessionResponse } from "@sugara/shared";
import { CHAT_MESSAGE_MAX_LENGTH } from "@sugara/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type ChatPanelProps = {
  tripId: string;
  canEdit: boolean;
  /** When true, messages fill the container and input is fixed above bottom nav */
  mobile?: boolean;
  onBroadcastMessage?: (message: ChatMessageResponse) => void;
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

export function ChatPanel({
  tripId,
  canEdit,
  mobile = false,
  onBroadcastMessage,
  onBroadcastSession,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

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
      toast.success(MSG.CHAT_SESSION_STARTED);
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

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    sendMessage.mutate(trimmed);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
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
        <div className="flex justify-end">
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>
        <Skeleton className="h-24 w-full rounded-md border border-dashed" />
      </div>
    );
  }

  if (isSessionLoading) return null;

  const isActive = !!chatSession;

  return (
    <div className={mobile ? "flex flex-col" : ""}>
      {/* Header: session action button */}
      {canEdit && (
        <div className="mb-2 flex justify-end">
          {isActive ? (
            <Button
              variant="outline"
              onClick={() => setEndConfirmOpen(true)}
              disabled={endSession.isPending}
              size="sm"
            >
              {endSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              作戦会議を終了
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => startSession.mutate()}
              disabled={startSession.isPending}
              size="sm"
            >
              {startSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              作戦会議を開始
            </Button>
          )}
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className={
          mobile
            ? "flex flex-col overflow-y-auto p-3"
            : "min-h-24 max-h-80 overflow-y-auto rounded-md border border-dashed p-3"
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
              return isGrouped ? (
                <div key={msg.id} className="pl-9 mt-0.5">
                  <p className="text-sm break-all whitespace-pre-wrap">{linkify(msg.content)}</p>
                </div>
              ) : (
                <div key={msg.id} className={`flex gap-2 ${i > 0 ? "mt-3" : ""}`}>
                  <UserAvatar
                    name={msg.userName}
                    image={msg.userImage}
                    className="h-7 w-7 shrink-0 mt-0.5"
                    fallbackClassName="text-xs"
                  />
                  <div className="min-w-0">
                    <p className="mb-0.5 text-xs">
                      <span className="font-medium">{msg.userName}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground/60">
                        {formatTime(msg.createdAt)}
                      </span>
                    </p>
                    <p className="text-sm break-all whitespace-pre-wrap">{linkify(msg.content)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area: always visible, disabled when no session */}
      {canEdit && (
        <div
          className={
            mobile
              ? "fixed right-0 left-0 z-20 flex items-end gap-2 border-t bg-background px-4 py-2"
              : "mt-2 flex items-end gap-2"
          }
          style={mobile ? { bottom: "calc(3rem + env(safe-area-inset-bottom, 0px))" } : undefined}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={1}
            disabled={!isActive}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!isActive || !input.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      <AlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>作戦会議を終了しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              すべてのメッセージが削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction
              onClick={() => {
                setEndConfirmOpen(false);
                endSession.mutate();
              }}
            >
              <X className="h-4 w-4" />
              終了する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
