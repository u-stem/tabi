import { describe, expect, it } from "vitest";
import { buildTransportUrl } from "../transport-link";

describe("buildTransportUrl", () => {
  it("returns null when from is missing", () => {
    expect(buildTransportUrl({ from: "", to: "大阪", method: "train" })).toBeNull();
  });

  it("returns null when to is missing", () => {
    expect(buildTransportUrl({ from: "東京", to: "", method: "train" })).toBeNull();
  });

  describe("Yahoo Transit (train, shinkansen, bus, airplane)", () => {
    it("builds Yahoo Transit URL for train with all params", () => {
      const url = buildTransportUrl({
        from: "東京",
        to: "大阪",
        method: "train",
        date: "2026-03-20",
        time: "10:30",
      });

      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      expect(parsed.hostname).toBe("transit.yahoo.co.jp");
      expect(parsed.searchParams.get("from")).toBe("東京");
      expect(parsed.searchParams.get("to")).toBe("大阪");
      expect(parsed.searchParams.get("y")).toBe("2026");
      expect(parsed.searchParams.get("m")).toBe("03");
      expect(parsed.searchParams.get("d")).toBe("20");
      expect(parsed.searchParams.get("hh")).toBe("10");
      expect(parsed.searchParams.get("type")).toBe("1");
      expect(parsed.searchParams.get("ticket")).toBe("ic");
    });

    it("includes shin=1 for shinkansen", () => {
      const url = buildTransportUrl({ from: "東京", to: "大阪", method: "shinkansen" });
      const parsed = new URL(url!);
      expect(parsed.searchParams.get("shin")).toBe("1");
    });

    it("includes hb=1 and lb=1 for bus", () => {
      const url = buildTransportUrl({ from: "京都", to: "嵐山", method: "bus" });
      const parsed = new URL(url!);
      expect(parsed.searchParams.get("hb")).toBe("1");
      expect(parsed.searchParams.get("lb")).toBe("1");
    });

    it("includes al=1 for airplane", () => {
      const url = buildTransportUrl({ from: "東京", to: "福岡", method: "airplane" });
      const parsed = new URL(url!);
      expect(parsed.searchParams.get("al")).toBe("1");
    });

    it("builds URL without date and time", () => {
      const url = buildTransportUrl({ from: "渋谷", to: "新宿", method: "train" });
      const parsed = new URL(url!);
      expect(parsed.searchParams.has("y")).toBe(false);
      expect(parsed.searchParams.has("hh")).toBe(false);
    });
  });

  describe("Google Maps (walk, car, taxi)", () => {
    it("builds Google Maps walking URL for walk", () => {
      const url = buildTransportUrl({ from: "清水寺", to: "祇園", method: "walk" });
      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      expect(parsed.hostname).toBe("www.google.com");
      expect(parsed.pathname).toBe("/maps/dir/");
      expect(parsed.searchParams.get("api")).toBe("1");
      expect(parsed.searchParams.get("origin")).toBe("清水寺");
      expect(parsed.searchParams.get("destination")).toBe("祇園");
      expect(parsed.searchParams.get("travelmode")).toBe("walking");
    });

    it("builds Google Maps driving URL for car", () => {
      const url = buildTransportUrl({ from: "京都駅", to: "嵐山", method: "car" });
      const parsed = new URL(url!);
      expect(parsed.searchParams.get("travelmode")).toBe("driving");
    });

    it("builds Google Maps driving URL for taxi", () => {
      const url = buildTransportUrl({ from: "祇園", to: "京都駅", method: "taxi" });
      const parsed = new URL(url!);
      expect(parsed.searchParams.get("travelmode")).toBe("driving");
    });

    it("ignores date and time for Google Maps", () => {
      const url = buildTransportUrl({
        from: "清水寺",
        to: "祇園",
        method: "walk",
        date: "2026-03-20",
        time: "16:00",
      });
      const parsed = new URL(url!);
      expect(parsed.searchParams.has("y")).toBe(false);
      expect(parsed.searchParams.has("hh")).toBe(false);
    });
  });

  describe("no method specified", () => {
    it("falls back to Yahoo Transit when method is undefined", () => {
      const url = buildTransportUrl({ from: "東京", to: "大阪" });
      const parsed = new URL(url!);
      expect(parsed.hostname).toBe("transit.yahoo.co.jp");
    });

    it("falls back to Yahoo Transit when method is null", () => {
      const url = buildTransportUrl({ from: "東京", to: "大阪", method: null });
      const parsed = new URL(url!);
      expect(parsed.hostname).toBe("transit.yahoo.co.jp");
    });
  });
});
