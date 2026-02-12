import { beforeEach, describe, expect, it, vi } from "vitest";

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
