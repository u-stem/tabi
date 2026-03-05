import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbSelect = vi.fn();

vi.mock("../db/index", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { resolveIsAdmin } from "../lib/resolve-is-admin";

describe("resolveIsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when ADMIN_USERNAME is not set", async () => {
    delete process.env.ADMIN_USERNAME;
    const result = await resolveIsAdmin({ id: "user-1", username: "anyone" });
    expect(result).toBe(false);
  });

  it("returns true when username matches ADMIN_USERNAME", async () => {
    process.env.ADMIN_USERNAME = "adminuser";
    const result = await resolveIsAdmin({ id: "user-1", username: "adminuser" });
    expect(result).toBe(true);
  });

  it("returns false when username does not match ADMIN_USERNAME", async () => {
    process.env.ADMIN_USERNAME = "adminuser";
    const result = await resolveIsAdmin({ id: "user-1", username: "regularuser" });
    expect(result).toBe(false);
  });

  it("falls back to DB lookup when username is absent from session", async () => {
    process.env.ADMIN_USERNAME = "adminuser";
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ username: "adminuser" }]),
        }),
      }),
    });
    const result = await resolveIsAdmin({ id: "user-1" });
    expect(result).toBe(true);
    expect(mockDbSelect).toHaveBeenCalledOnce();
  });

  it("returns false when DB lookup returns no matching username", async () => {
    process.env.ADMIN_USERNAME = "adminuser";
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ username: "other" }]),
        }),
      }),
    });
    const result = await resolveIsAdmin({ id: "user-1" });
    expect(result).toBe(false);
  });
});
