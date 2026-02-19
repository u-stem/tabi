import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatShortDate, formatShortDateRange } from "../lib/activity-logger";

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();

vi.mock("../db/index", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import { logActivity } from "../lib/activity-logger";

function setupSelectMock(ids: { id: string }[]) {
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(ids),
        }),
      }),
    }),
  });
}

describe("formatShortDate", () => {
  it("strips leading zeros from month and day", () => {
    expect(formatShortDate("2025-02-07")).toBe("2/7");
  });

  it("handles double-digit month and day", () => {
    expect(formatShortDate("2025-12-25")).toBe("12/25");
  });
});

describe("formatShortDateRange", () => {
  it("returns single date when start equals end", () => {
    expect(formatShortDateRange("2025-02-07", "2025-02-07")).toBe("2/7");
  });

  it("returns range when start differs from end", () => {
    expect(formatShortDateRange("2025-02-07", "2025-02-08")).toBe("2/7 - 2/8");
  });
});

describe("logActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("inserts a log entry", async () => {
    setupSelectMock([{ id: "log-1" }]);

    await logActivity({
      tripId: "trip-1",
      userId: "user-1",
      action: "created",
      entityType: "schedule",
      entityName: "Tokyo Tower",
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("does not delete when under the cap", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => ({ id: `log-${i}` }));
    setupSelectMock(ids);

    await logActivity({
      tripId: "trip-1",
      userId: "user-1",
      action: "created",
      entityType: "schedule",
    });

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes old entries when at the cap", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => ({ id: `log-${i}` }));
    setupSelectMock(ids);

    await logActivity({
      tripId: "trip-1",
      userId: "user-1",
      action: "created",
      entityType: "schedule",
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
