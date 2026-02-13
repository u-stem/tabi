import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, TEST_USER } from "./test-helpers";

const { mockGetSession, mockFetch } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { feedbackRoutes } from "../routes/feedback";

const fakeUser = TEST_USER;

describe("Feedback routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
    vi.stubEnv("GITHUB_FEEDBACK_REPO", "owner/repo");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns 401 without auth", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = createTestApp(feedbackRoutes, "/api");
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Bug report" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty body", async () => {
    const app = createTestApp(feedbackRoutes, "/api");
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for body exceeding max length", async () => {
    const app = createTestApp(feedbackRoutes, "/api");
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "a".repeat(1001) }),
    });
    expect(res.status).toBe(400);
  });

  it("creates GitHub issue and returns 201", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ html_url: "https://github.com/owner/repo/issues/1" }), {
        status: 201,
      }),
    );
    const app = createTestApp(feedbackRoutes, "/api");
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Something is broken" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.url).toBe("https://github.com/owner/repo/issues/1");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues");
    expect(options.method).toBe("POST");
    const reqBody = JSON.parse(options.body);
    expect(reqBody.title).toBe("Something is broken");
    expect(reqBody.labels).toEqual(["feedback"]);
  });

  it("truncates title to 50 chars with ellipsis", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ html_url: "https://github.com/owner/repo/issues/2" }), {
        status: 201,
      }),
    );
    const app = createTestApp(feedbackRoutes, "/api");
    const longBody = "a".repeat(60);
    await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: longBody }),
    });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(reqBody.title).toBe(`${"a".repeat(50)}...`);
  });

  it("returns 502 when GitHub API fails", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }),
    );
    const app = createTestApp(feedbackRoutes, "/api");
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Test feedback" }),
    });
    expect(res.status).toBe(502);
  });

  it("returns 500 when GitHub env vars are not configured", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_FEEDBACK_REPO", "");
    const app = createTestApp(feedbackRoutes, "/api");
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Test feedback" }),
    });
    expect(res.status).toBe(500);
  });
});
