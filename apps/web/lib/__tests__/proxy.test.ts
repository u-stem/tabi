import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../../proxy";

function makeRequest(
  pathname: string,
  opts: { viewMode?: string; ua?: string } = {},
): NextRequest {
  const url = `http://localhost${pathname}`;
  const headers: Record<string, string> = {};
  if (opts.ua) headers["user-agent"] = opts.ua;

  const req = new NextRequest(url, { headers });
  if (opts.viewMode) {
    req.cookies.set("x-view-mode", opts.viewMode);
  }
  return req;
}

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("proxy — SP redirect", () => {
  it("redirects /trips/[id] to /sp/trips/[id] in SP mode", async () => {
    const req = makeRequest("/trips/abc123", { viewMode: "sp" });
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/sp/trips/abc123");
  });

  it("does NOT redirect /trips/[id]/print to SP in SP mode", async () => {
    const req = makeRequest("/trips/abc123/print", { viewMode: "sp" });
    const res = await proxy(req);
    // Should pass through (no SP redirect), may redirect to /auth/login due to no session
    expect(res?.headers.get("location")).not.toContain("/sp/");
  });

  it("does NOT redirect /trips/[id]/export to SP in SP mode", async () => {
    const req = makeRequest("/trips/abc123/export", { viewMode: "sp" });
    const res = await proxy(req);
    expect(res?.headers.get("location")).not.toContain("/sp/");
  });

  it("redirects mobile UA with no cookie to SP for /trips", async () => {
    const req = makeRequest("/trips/abc123", { ua: MOBILE_UA });
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/sp/trips/abc123");
  });

  it("does NOT redirect mobile UA to SP for /trips/[id]/print", async () => {
    const req = makeRequest("/trips/abc123/print", { ua: MOBILE_UA });
    const res = await proxy(req);
    expect(res?.headers.get("location")).not.toContain("/sp/");
  });

  it("does NOT redirect mobile UA to SP for /trips/[id]/export", async () => {
    const req = makeRequest("/trips/abc123/export", { ua: MOBILE_UA });
    const res = await proxy(req);
    expect(res?.headers.get("location")).not.toContain("/sp/");
  });
});
