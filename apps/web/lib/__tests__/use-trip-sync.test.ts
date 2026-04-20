import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTripSync } from "../hooks/use-trip-sync";

// --- Mocks ---

type SubscribeCallback = (status: string) => void;

function createMockChannel() {
  let subscribeCallback: SubscribeCallback = () => {};
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((cb: SubscribeCallback) => {
      subscribeCallback = cb;
      return channel;
    }),
    track: vi.fn(),
    send: vi.fn(),
    presenceState: vi.fn().mockReturnValue({}),
    _emitStatus(status: string) {
      subscribeCallback(status);
    },
  };
  return channel;
}

// Simulate real SDK behavior: removeChannel triggers CLOSED on the channel
const mockRemoveChannel = vi.fn((ch: ReturnType<typeof createMockChannel>) => {
  ch._emitStatus("CLOSED");
});
let mockChannels: ReturnType<typeof createMockChannel>[] = [];

vi.mock("../supabase", () => ({
  supabase: {
    channel: vi.fn(() => {
      const ch = createMockChannel();
      mockChannels.push(ch);
      return ch;
    }),
    removeChannel: (ch: ReturnType<typeof createMockChannel>) => mockRemoveChannel(ch),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const user = { id: "user-1", name: "Test User" };
const onSync = vi.fn();

describe("useTripSync SDK-managed reconnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChannels = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not create a new channel on TIMED_OUT (SDK handles rejoin)", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    expect(mockChannels).toHaveLength(1);

    act(() => mockChannels[0]._emitStatus("TIMED_OUT"));

    // SDK handles rejoin internally; no new channel should be created
    expect(mockChannels).toHaveLength(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it("does not create a new channel on CHANNEL_ERROR (SDK handles rejoin)", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    expect(mockChannels).toHaveLength(1);

    act(() => mockChannels[0]._emitStatus("CHANNEL_ERROR"));

    expect(mockChannels).toHaveLength(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it("recreates channel on CLOSED after backoff (SDK removes channel from list)", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    const firstChannel = mockChannels[0];

    act(() => firstChannel._emitStatus("CLOSED"));
    // Reconnect is scheduled, not immediate.
    expect(mockChannels).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockRemoveChannel).toHaveBeenCalledWith(firstChannel);
    expect(mockChannels).toHaveLength(2);
  });

  it("applies exponential backoff on consecutive CLOSED events", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    // attempt 1: delay 1000ms
    act(() => mockChannels[0]._emitStatus("CLOSED"));
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(mockChannels).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockChannels).toHaveLength(2);

    // attempt 2: delay 2000ms
    act(() => mockChannels[1]._emitStatus("CLOSED"));
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(mockChannels).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockChannels).toHaveLength(3);
  });

  it("ignores CLOSED from a stale channel after reconnect", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    const firstChannel = mockChannels[0];

    // First CLOSED schedules a reconnect; advance timer to create channel B.
    act(() => firstChannel._emitStatus("CLOSED"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockChannels).toHaveLength(2);

    // Stale CLOSED from channel A must not create a 3rd channel even after backoff.
    act(() => firstChannel._emitStatus("CLOSED"));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(mockChannels).toHaveLength(2);
  });

  it("sets isConnected on SUBSCRIBED and dismisses error toast", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useTripSync("trip-1", user, onSync));
    expect(result.current.isConnected).toBe(false);

    act(() => mockChannels[0]._emitStatus("SUBSCRIBED"));

    expect(result.current.isConnected).toBe(true);
    expect(toast.dismiss).toHaveBeenCalledWith("realtime-error");
  });

  it("tracks presence on SUBSCRIBED when lastPresence exists", () => {
    const { result } = renderHook(() => useTripSync("trip-1", user, onSync));

    // Set presence first
    act(() => result.current.updatePresence("day-1", null));

    act(() => mockChannels[0]._emitStatus("SUBSCRIBED"));

    expect(mockChannels[0].track).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Test User",
      image: undefined,
      dayId: "day-1",
      patternId: null,
    });
  });
});

describe("useTripSync visibility change", () => {
  let visibilityState: string;

  beforeEach(() => {
    vi.useFakeTimers();
    mockChannels = [];
    vi.clearAllMocks();
    visibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      get: () => visibilityState,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not disconnect when tab becomes hidden", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    visibilityState = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    // Should NOT remove channel; worker keeps heartbeat alive
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it("calls onSync when tab becomes visible to refetch stale data", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    onSync.mockClear();

    visibilityState = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(onSync).not.toHaveBeenCalled();

    visibilityState = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("does not create a new channel on tab restore", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    expect(mockChannels).toHaveLength(1);

    visibilityState = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    visibilityState = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    // No new channel; the existing one stays connected via worker
    expect(mockChannels).toHaveLength(1);
  });
});

describe("useTripSync network recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChannels = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("recreates channel and calls onSync on online event", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    const firstChannel = mockChannels[0];
    onSync.mockClear();

    act(() => window.dispatchEvent(new Event("online")));

    expect(mockRemoveChannel).toHaveBeenCalledWith(firstChannel);
    expect(mockChannels).toHaveLength(2);
    expect(onSync).toHaveBeenCalledTimes(1);
  });
});

describe("useTripSync channel exposure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChannels = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exposes channel ref", () => {
    const { result } = renderHook(() => useTripSync("trip-1", user, onSync));
    act(() => mockChannels[0]._emitStatus("SUBSCRIBED"));
    expect(result.current.channel).toBe(mockChannels[0]);
  });
});

describe("useTripSync cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChannels = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("removes channel on unmount", () => {
    const { unmount } = renderHook(() => useTripSync("trip-1", user, onSync));
    const channel = mockChannels[0];

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  it("cancels pending backoff timer on unmount", () => {
    const { unmount } = renderHook(() => useTripSync("trip-1", user, onSync));

    // Schedule a reconnect via CLOSED
    act(() => mockChannels[0]._emitStatus("CLOSED"));
    // removeChannel from CLOSED handling + cleanup → 2 calls; channel count stays at 1
    const channelsBeforeUnmount = mockChannels.length;

    unmount();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // No new channel should be created after unmount
    expect(mockChannels).toHaveLength(channelsBeforeUnmount);
  });

  it("cancels pending backoff timer when online event fires mid-backoff", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    // CLOSED → 1s backoff scheduled
    act(() => mockChannels[0]._emitStatus("CLOSED"));
    // Advance partway through backoff
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // online event cancels pending timer and connects fresh
    act(() => window.dispatchEvent(new Event("online")));
    const channelsAfterOnline = mockChannels.length;

    // Let the original backoff elapse — it must not create a 3rd channel
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockChannels).toHaveLength(channelsAfterOnline);
  });
});
