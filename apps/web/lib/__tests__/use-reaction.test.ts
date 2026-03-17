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
});
