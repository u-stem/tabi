import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const { mockOrderBy, mockFrom, mockSelect } = vi.hoisted(() => {
  const mockOrderBy = vi.fn();
  const mockFrom = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  return { mockOrderBy, mockFrom, mockSelect };
});

vi.mock("../db/index", () => ({
  db: { select: mockSelect },
}));

import { faqRoutes } from "../routes/faqs";

function createApp() {
  const app = new Hono();
  app.route("/", faqRoutes);
  return app;
}

describe("GET /api/faqs", () => {
  it("returns FAQ items sorted by sort_order", async () => {
    const items = [
      { id: "00000000-0000-0000-0000-000000000001", question: "Q1", answer: "A1", sortOrder: 0 },
      { id: "00000000-0000-0000-0000-000000000002", question: "Q2", answer: "A2", sortOrder: 1 },
    ];
    mockOrderBy.mockResolvedValue(items);

    const app = createApp();
    const res = await app.request("/api/faqs");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(items);
  });

  it("returns 200 with empty array when no FAQs exist", async () => {
    mockOrderBy.mockResolvedValue([]);

    const app = createApp();
    const res = await app.request("/api/faqs");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
