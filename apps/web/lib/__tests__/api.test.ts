import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api", () => {
  it("sends GET request with credentials", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "test" }),
    });

    const result = await api("/api/trips");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/trips",
      expect.objectContaining({
        credentials: "include",
        headers: {},
      }),
    );
    expect(result).toEqual({ data: "test" });
  });

  it("appends query params to URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    await api("/api/trips", { params: { status: "active" } });

    expect(mockFetch).toHaveBeenCalledWith("/api/trips?status=active", expect.any(Object));
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Trip not found" }),
    });

    await expect(api("/api/trips/123")).rejects.toThrow(ApiError);
    await expect(api("/api/trips/123")).rejects.toMatchObject({
      message: "Trip not found",
      status: 404,
    });
  });

  it("handles non-JSON error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(api("/api/trips")).rejects.toMatchObject({
      message: "Unknown error",
      status: 500,
    });
  });

  it("returns undefined for 204 responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await api("/api/trips/123");
    expect(result).toBeUndefined();
  });

  it("sends POST request with body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "new-trip" }),
    });

    const body = JSON.stringify({ title: "Test" });
    await api("/api/trips", { method: "POST", body });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/trips",
      expect.objectContaining({
        method: "POST",
        body,
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});

describe("ApiError", () => {
  it("has correct name and status", () => {
    const error = new ApiError("Not found", 404);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("Not found");
    expect(error.status).toBe(404);
    expect(error).toBeInstanceOf(Error);
  });
});
