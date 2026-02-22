"use client";

import type { ChatMessageResponse, ChatSessionResponse } from "@sugara/shared";
import { CHAT_MESSAGE_MAX_LENGTH } from "@sugara/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type ChatPanelProps = {
  tripId: string;
  canEdit: boolean;
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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function ChatPanel({
  tripId,
  canEdit,
  onBroadcastMessage,
  onBroadcastSession,
}: ChatPanelProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
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
  const messages = (messagesData?.pages.flatMap((page) => page.items) ?? []).slice().reverse();

  const startSession = useMutation({
    mutationFn: () => api<SessionResponse>(`/api/trips/${tripId}/chat/session`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.chatSession(tripId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.chatSession(tripId) });
      queryClient.setQueryData(queryKeys.trips.chatMessages(tripId), undefined);
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
      // Optimistically add message to cache
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
    onError: (err) => {
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Detect if user scrolled up
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    shouldAutoScroll.current = atBottom;
  }, []);

  const showSkeleton = useDelayedLoading(isSessionLoading);

  if (showSkeleton) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isSessionLoading) return null;

  // No active session
  if (!chatSession) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="mb-4 text-sm text-muted-foreground">{MSG.CHAT_NO_SESSION}</p>
        {canEdit && (
          <Button onClick={() => startSession.mutate()} disabled={startSession.isPending} size="sm">
            {startSession.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            作戦会議を開始
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col -mx-4 -mb-4">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2"
        onScroll={handleScroll}
      >
        {hasNextPage && (
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
        {isMessagesLoading ? (
          <div className="space-y-3 py-2">
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
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{MSG.CHAT_EMPTY}</p>
        ) : (
          <div className="space-y-3 py-2">
            {messages.map((msg) => {
              const isMe = msg.userId === session?.user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMe && (
                    <UserAvatar
                      name={msg.userName}
                      image={msg.userImage}
                      className="h-7 w-7 shrink-0"
                      fallbackClassName="text-xs"
                    />
                  )}
                  <div className={`max-w-[75%] ${isMe ? "text-right" : ""}`}>
                    {!isMe && (
                      <p className="mb-0.5 text-xs text-muted-foreground">{msg.userName}</p>
                    )}
                    <div
                      className={`inline-block rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* End session button + input area */}
      <div className="border-t px-3 py-2">
        {canEdit && (
          <div className="mb-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => endSession.mutate()}
              disabled={endSession.isPending}
            >
              <X className="h-3 w-3" />
              作戦会議を終了
            </Button>
          </div>
        )}
        {canEdit && (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
