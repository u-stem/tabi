import { describe, expect, it } from "vitest";
import { app } from "../app";

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await app.request("/health");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
