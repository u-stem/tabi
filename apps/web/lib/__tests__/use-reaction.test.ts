import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReaction } from "../hooks/use-reaction";

// --- Mock channel ---
function createMockChannel() {
  const handlers = new Map<string, (payload: { payload: unknown }) => void>();
  const channel = {
    on: vi.fn(
      (
        type: string,
        filter: { event: string },
        handler: (payload: { payload: unknown }) => void,
      ) => {
        if (type === "broadcast") handlers.set(filter.event, handler);
        return channel;
      },
    ),
    send: vi.fn(),
    _emit(event: string, payload: unknown) {
      handlers.get(event)?.({ payload });
    },
  };
  return channel;
}

const user = {
  id: "user-1",
  name: "Test User",
  image: undefined,
  color: "bg-blue-500",
};

describe("useReaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("sendReaction broadcasts event with correct payload", () => {
    const channel = createMockChannel();
    const { result } = renderHook(() => useReaction(channel as never, user));

    act(() => result.current.sendReaction("🎉"));

    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "trip:reaction",
      payload: {
        emoji: "🎉",
        userId: "user-1",
        name: "Test User",
        image: undefined,
        color: "bg-blue-500",
      },
    });
  });

  it("receiving a broadcast event adds a FloatingReaction to state", () => {
    const channel = createMockChannel();
    const { result } = renderHook(() => useReaction(channel as never, user));

    act(() => {
      channel._emit("trip:reaction", {
        emoji: "❤️",
        userId: "user-2",
        name: "Other User",
        color: "bg-emerald-500",
      });
    });

    expect(result.current.reactions).toHaveLength(1);
    expect(result.current.reactions[0]).toMatchObject({
      emoji: "❤️",
      name: "Other User",
      color: "bg-emerald-500",
    });
    expect(result.current.reactions[0].x).toBeGreaterThanOrEqual(10);
    expect(result.current.reactions[0].x).toBeLessThanOrEqual(90);
  });

  it("removeReaction removes the reaction from state", () => {
    const channel = createMockChannel();
    const { result } = renderHook(() => useReaction(channel as never, user));

    act(() => {
      channel._emit("trip:reaction", {
        emoji: "👍",
        userId: "user-2",
        name: "Other",
        color: "bg-rose-500",
      });
    });
    const id = result.current.reactions[0].id;

    act(() => result.current.removeReaction(id));

    expect(result.current.reactions).toHaveLength(0);
  });

  it("sendReaction is no-op during 1s cooldown", () => {
    vi.useFakeTimers();
    const channel = createMockChannel();
    const { result } = renderHook(() => useReaction(channel as never, user));

    act(() => result.current.sendReaction("🎉"));
    channel.send.mockClear();

    act(() => result.current.sendReaction("❤️"));
    expect(channel.send).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("cooldown flag resets after 1s", () => {
    vi.useFakeTimers();
    const channel = createMockChannel();
    const { result } = renderHook(() => useReaction(channel as never, user));

    act(() => result.current.sendReaction("🎉"));
    expect(result.current.cooldown).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.cooldown).toBe(false);

    vi.useRealTimers();
  });

  it("caps active reactions at 20 — oldest removed when exceeded", () => {
    const channel = createMockChannel();
    const { result } = renderHook(() => useReaction(channel as never, user));

    act(() => {
      for (let i = 0; i < 25; i++) {
        channel._emit("trip:reaction", {
          emoji: "🔥",
          userId: `user-${i}`,
          name: `User ${i}`,
          color: "bg-blue-500",
        });
      }
    });

    expect(result.current.reactions).toHaveLength(20);
    expect(result.current.reactions[0].name).toBe("User 5");
  });

  it("does not send when channel is null", () => {
    const { result } = renderHook(() => useReaction(null, user));

    act(() => result.current.sendReaction("🎉"));

    expect(result.current.reactions).toHaveLength(0);
  });
});
