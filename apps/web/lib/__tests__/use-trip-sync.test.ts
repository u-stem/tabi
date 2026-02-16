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

const mockRemoveChannel = vi.fn();
let mockChannels: ReturnType<typeof createMockChannel>[] = [];

vi.mock("../supabase", () => ({
  supabase: {
    channel: vi.fn(() => {
      const ch = createMockChannel();
      mockChannels.push(ch);
      return ch;
    }),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
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

describe("useTripSync retry on TIMED_OUT / CHANNEL_ERROR", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix jitter: random()=0.5 -> delay = base * (0.5 + 0.5*0.5) = base * 0.75
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    mockChannels = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries after TIMED_OUT with jittered backoff", async () => {
    const { result } = renderHook(() => useTripSync("trip-1", user, onSync));
    expect(mockChannels).toHaveLength(1);
    expect(result.current.isConnected).toBe(false);

    act(() => mockChannels[0]._emitStatus("TIMED_OUT"));

    // random()=0.5 -> delay = 1000 * (0.5 + 0.5*0.5) = 750ms
    await act(async () => vi.advanceTimersByTime(749));
    expect(mockChannels).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(1));
    expect(mockChannels).toHaveLength(2);
  });

  it("retries after CHANNEL_ERROR", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    expect(mockChannels).toHaveLength(1);

    act(() => mockChannels[0]._emitStatus("CHANNEL_ERROR"));

    // 750ms with jitter
    await act(async () => vi.advanceTimersByTime(750));
    expect(mockChannels).toHaveLength(2);
  });

  it("uses exponential backoff with jitter: 750, 1500, 3000, 6000, 7500", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    // Delays with random()=0.5: base * 0.75
    // 1s*0.75=750, 2s*0.75=1500, 4s*0.75=3000, 8s*0.75=6000, 10s(cap)*0.75=7500
    const expectedDelays = [750, 1500, 3000, 6000, 7500];

    for (let i = 0; i < expectedDelays.length; i++) {
      act(() => mockChannels[i]._emitStatus("TIMED_OUT"));
      await act(async () => vi.advanceTimersByTime(expectedDelays[i] - 1));
      expect(mockChannels).toHaveLength(i + 1);
      await act(async () => vi.advanceTimersByTime(1));
      expect(mockChannels).toHaveLength(i + 2);
    }
  });

  it("stops retrying after 5 retries and shows toast", async () => {
    const { toast } = await import("sonner");
    renderHook(() => useTripSync("trip-1", user, onSync));

    const delays = [750, 1500, 3000, 6000, 7500];
    for (let i = 0; i < delays.length; i++) {
      act(() => mockChannels[i]._emitStatus("TIMED_OUT"));
      await act(async () => vi.advanceTimersByTime(delays[i]));
    }

    // 6th failure (initial + 5 retries exhausted) -> toast, no more retry
    const countBefore = mockChannels.length;
    act(() => mockChannels[countBefore - 1]._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(mockChannels).toHaveLength(countBefore);
    expect(toast.error).toHaveBeenCalled();
  });

  it("caps delay at RETRY_MAX_MS (10s)", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    // Advance to 5th retry (index 4) where base = min(10000, 2^4*1000) = 10000
    const delays = [750, 1500, 3000, 6000];
    for (let i = 0; i < delays.length; i++) {
      act(() => mockChannels[i]._emitStatus("TIMED_OUT"));
      await act(async () => vi.advanceTimersByTime(delays[i]));
    }

    // 5th retry: base = min(10000, 16000) = 10000, jittered = 7500
    act(() => mockChannels[4]._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(7499));
    expect(mockChannels).toHaveLength(5);
    await act(async () => vi.advanceTimersByTime(1));
    expect(mockChannels).toHaveLength(6);
  });

  it("resets retry count on successful SUBSCRIBED", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    // Fail then retry
    act(() => mockChannels[0]._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(750));
    expect(mockChannels).toHaveLength(2);

    // Succeed
    act(() => mockChannels[1]._emitStatus("SUBSCRIBED"));

    // Fail again -> 1st retry delay (750ms), not 2nd (1500ms)
    act(() => mockChannels[1]._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(749));
    expect(mockChannels).toHaveLength(2);
    await act(async () => vi.advanceTimersByTime(1));
    expect(mockChannels).toHaveLength(3);
  });

  it("removes previous channel before retrying", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    const firstChannel = mockChannels[0];

    act(() => firstChannel._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(750));

    expect(mockRemoveChannel).toHaveBeenCalledWith(firstChannel);
  });

  it("does not show toast during retries", async () => {
    const { toast } = await import("sonner");
    renderHook(() => useTripSync("trip-1", user, onSync));

    act(() => mockChannels[0]._emitStatus("TIMED_OUT"));
    expect(toast.error).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(750));

    act(() => mockChannels[1]._emitStatus("TIMED_OUT"));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useTripSync visibility change", () => {
  let hiddenValue = false;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    mockChannels = [];
    vi.clearAllMocks();
    hiddenValue = false;
    Object.defineProperty(document, "hidden", {
      get: () => hiddenValue,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("disconnects when tab becomes hidden", () => {
    renderHook(() => useTripSync("trip-1", user, onSync));
    const channel = mockChannels[0];

    hiddenValue = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  it("resets retry count and reconnects on tab restore", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    // Fail twice to advance retry count
    act(() => mockChannels[0]._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(750));
    act(() => mockChannels[1]._emitStatus("TIMED_OUT"));

    // Hide then restore tab
    hiddenValue = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    hiddenValue = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    // Next failure should use 1st retry delay (750ms), not 3rd
    const latestIdx = mockChannels.length - 1;
    act(() => mockChannels[latestIdx]._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(749));
    expect(mockChannels).toHaveLength(latestIdx + 1);
    await act(async () => vi.advanceTimersByTime(1));
    expect(mockChannels).toHaveLength(latestIdx + 2);
  });

  it("cancels retry timer when tab becomes hidden", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    act(() => mockChannels[0]._emitStatus("TIMED_OUT"));

    // Hide tab during retry backoff
    hiddenValue = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    // Advance past retry delay - no retry should fire
    const countBefore = mockChannels.length;
    await act(async () => vi.advanceTimersByTime(2000));
    expect(mockChannels).toHaveLength(countBefore);
  });
});

describe("useTripSync network recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    mockChannels = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resets retry count and reconnects on online event after retries exhausted", async () => {
    renderHook(() => useTripSync("trip-1", user, onSync));

    // Exhaust all retries
    const delays = [750, 1500, 3000, 6000, 7500];
    for (let i = 0; i < delays.length; i++) {
      act(() => mockChannels[i]._emitStatus("TIMED_OUT"));
      await act(async () => vi.advanceTimersByTime(delays[i]));
    }
    act(() => mockChannels[5]._emitStatus("TIMED_OUT"));
    const countAfterExhaust = mockChannels.length;

    // Network comes back
    act(() => window.dispatchEvent(new Event("online")));
    expect(mockChannels).toHaveLength(countAfterExhaust + 1);

    // Should be able to retry again from count 0
    act(() => mockChannels[mockChannels.length - 1]._emitStatus("TIMED_OUT"));
    await act(async () => vi.advanceTimersByTime(750));
    expect(mockChannels).toHaveLength(countAfterExhaust + 2);
  });
});
