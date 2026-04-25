import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useTripDragAndDrop } from "./use-trip-drag-and-drop";

vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue(undefined),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@dnd-kit/core", () => ({
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  MouseSensor: class {},
  TouchSensor: class {},
  closestCorners: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    result.splice(to, 0, result.splice(from, 1)[0]);
    return result;
  }),
}));

vi.mock("@/lib/merge-timeline", () => ({
  buildMergedTimeline: vi.fn((schedules: unknown[]) =>
    schedules.map((s) => ({ type: "schedule", schedule: s })),
  ),
  timelineSortableIds: vi.fn((items: Array<{ schedule: { id: string } }>) =>
    items.map((i) => i.schedule.id),
  ),
  timelineScheduleOrder: vi.fn((items: Array<{ type: string; schedule: unknown }>) =>
    items.filter((i) => i.type === "schedule").map((i) => i.schedule),
  ),
}));

// Minimal schedule shape needed for hook initialization
function makeSchedule(id: string) {
  return {
    id,
    name: `Schedule ${id}`,
    category: "sightseeing" as const,
    color: "blue" as const,
    address: null,
    startTime: null,
    endTime: null,
    sortOrder: 0,
    memo: null,
    urls: [],
    departurePlace: null,
    arrivalPlace: null,
    transportMethod: null,
    endDayOffset: 0,
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

const s1 = makeSchedule("s1");
const s2 = makeSchedule("s2");
const s3 = makeSchedule("s3");

describe("useTripDragAndDrop — null-based snapshot isolation", () => {
  afterEach(() => vi.clearAllMocks());

  it("updates localSchedules when schedules prop changes while NOT dragging", () => {
    const { result, rerender } = renderHook(
      ({ schedules }) =>
        useTripDragAndDrop({
          tripId: "trip1",
          currentDayId: null,
          currentPatternId: null,
          schedules,
          candidates: [],
          onDone: vi.fn(),
        }),
      { initialProps: { schedules: [s1, s2] } },
    );

    expect(result.current.localSchedules).toHaveLength(2);

    rerender({ schedules: [s1, s2, s3] });

    expect(result.current.localSchedules).toHaveLength(3);
  });

  it("does NOT update localSchedules when schedules prop changes while dragging", async () => {
    const { result, rerender } = renderHook(
      ({ schedules }) =>
        useTripDragAndDrop({
          tripId: "trip1",
          currentDayId: null,
          currentPatternId: null,
          schedules,
          candidates: [],
          onDone: vi.fn(),
        }),
      { initialProps: { schedules: [s1, s2] } },
    );

    // Simulate drag start — sets activeDragItem to non-null
    act(() => {
      result.current.handleDragStart({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        activatorEvent: new PointerEvent("pointerdown"),
      } as Parameters<typeof result.current.handleDragStart>[0]);
    });

    // Schedules prop changes while drag is in progress
    rerender({ schedules: [s1, s2, s3] });

    // localSchedules must remain unchanged during drag
    expect(result.current.localSchedules).toHaveLength(2);

    // Simulate drag end (currentPatternId is null → returns early, no API call)
    await act(async () => {
      await result.current.handleDragEnd({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        over: null,
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointerup"),
        collisions: null,
      } as Parameters<typeof result.current.handleDragEnd>[0]);
    });

    // After drag ends, sync resumes on next prop change
    rerender({ schedules: [s1, s2, s3] });
    expect(result.current.localSchedules).toHaveLength(3);
  });

  it("does not snap back to old order while API call is pending", () => {
    // Give the API a never-resolving promise so we can inspect mid-flight state
    vi.mocked(api).mockImplementationOnce(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useTripDragAndDrop({
        tripId: "trip1",
        currentDayId: "day1",
        currentPatternId: "pattern1",
        schedules: [s1, s2],
        candidates: [],
        onDone: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleDragStart({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        activatorEvent: new PointerEvent("pointerdown"),
      } as Parameters<typeof result.current.handleDragStart>[0]);
    });

    // Trigger drag end (non-awaited — API hangs)
    act(() => {
      result.current.handleDragEnd({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: "s2",
          data: { current: { type: "schedule" } },
          rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 },
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointerup"),
        collisions: null,
      } as Parameters<typeof result.current.handleDragEnd>[0]);
    });

    // Optimistic reorder should be visible while the API call is in-flight
    expect(result.current.localSchedules[0].id).toBe("s2");
    expect(result.current.localSchedules[1].id).toBe("s1");
  });

  it("keeps overScheduleId when pointer moves to timeline gap between items", () => {
    const { result } = renderHook(() =>
      useTripDragAndDrop({
        tripId: "trip1",
        currentDayId: "day1",
        currentPatternId: "pattern1",
        schedules: [s1, s2],
        candidates: [],
        onDone: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleDragStart({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        activatorEvent: new PointerEvent("pointerdown"),
      } as Parameters<typeof result.current.handleDragStart>[0]);
    });

    // Hover over s2
    act(() => {
      result.current.handleDragOver({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: "s2",
          data: { current: { type: "schedule" } },
          rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 },
          disabled: false,
        },
        collisions: null,
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointermove"),
      } as Parameters<typeof result.current.handleDragOver>[0]);
    });

    expect(result.current.overScheduleId).toBe("s2");

    // Pointer moves to timeline droppable (gap between items)
    act(() => {
      result.current.handleDragOver({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: "timeline",
          data: { current: { type: "timeline" } },
          rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 },
          disabled: false,
        },
        collisions: null,
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointermove"),
      } as Parameters<typeof result.current.handleDragOver>[0]);
    });

    // overScheduleId should still be "s2" (not reset to null)
    expect(result.current.overScheduleId).toBe("s2");
  });

  it("keeps overScheduleId when over becomes null during drag", () => {
    const { result } = renderHook(() =>
      useTripDragAndDrop({
        tripId: "trip1",
        currentDayId: "day1",
        currentPatternId: "pattern1",
        schedules: [s1, s2],
        candidates: [],
        onDone: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleDragStart({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        activatorEvent: new PointerEvent("pointerdown"),
      } as Parameters<typeof result.current.handleDragStart>[0]);
    });

    // Hover over s2
    act(() => {
      result.current.handleDragOver({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: "s2",
          data: { current: { type: "schedule" } },
          rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 },
          disabled: false,
        },
        collisions: null,
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointermove"),
      } as Parameters<typeof result.current.handleDragOver>[0]);
    });

    expect(result.current.overScheduleId).toBe("s2");

    // over becomes null (pointer briefly leaves all drop targets)
    act(() => {
      result.current.handleDragOver({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        over: null,
        collisions: null,
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointermove"),
      } as Parameters<typeof result.current.handleDragOver>[0]);
    });

    // overScheduleId should still be "s2" (not reset to null)
    expect(result.current.overScheduleId).toBe("s2");
  });

  it("does not snap back to old order while onDone (refetch) is pending after reorderSchedule", async () => {
    // onDone returns a pending promise — simulates an in-flight refetch.
    let resolveOnDone: (() => void) | undefined;
    const onDone = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveOnDone = res;
        }),
    );

    const { result } = renderHook(() =>
      useTripDragAndDrop({
        tripId: "trip1",
        currentDayId: "day1",
        currentPatternId: "pattern1",
        schedules: [s1, s2],
        candidates: [],
        onDone,
      }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.reorderSchedule("s2", "up");
    });

    // Flush microtasks so the optimistic setLocalSchedules and the awaited
    // api() both settle. `onDone` is still pending.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Bug repro: while the refetch driven by onDone is pending, the schedules
    // prop has not been updated yet. If finally runs before onDone resolves,
    // localSchedules falls back to the stale prop (= old order [s1, s2]),
    // causing a brief snap-back before the refetch completes.
    expect(result.current.localSchedules.map((s) => s.id)).toEqual(["s2", "s1"]);

    await act(async () => {
      resolveOnDone?.();
      await pending;
    });
  });

  it("falls back to server data after the API call resolves", async () => {
    // Default mock resolves immediately (mockResolvedValue(undefined))
    const { result } = renderHook(() =>
      useTripDragAndDrop({
        tripId: "trip1",
        currentDayId: "day1",
        currentPatternId: "pattern1",
        schedules: [s1, s2],
        candidates: [],
        onDone: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleDragStart({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        activatorEvent: new PointerEvent("pointerdown"),
      } as Parameters<typeof result.current.handleDragStart>[0]);
    });

    await act(async () => {
      await result.current.handleDragEnd({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: "s2",
          data: { current: { type: "schedule" } },
          rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 },
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointerup"),
        collisions: null,
      } as Parameters<typeof result.current.handleDragEnd>[0]);
    });

    // After API resolves, finally resets local state to null → falls back to schedules prop
    expect(result.current.localSchedules).toStrictEqual([s1, s2]);
  });
});
