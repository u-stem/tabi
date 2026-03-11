import { describe, expect, it } from "vitest";
import { pickRandom } from "../roulette";

describe("pickRandom", () => {
  it("returns an item from the candidates", () => {
    const candidates = ["A", "B", "C"];
    const result = pickRandom(candidates);
    expect(candidates).toContain(result);
  });

  it("throws when candidates is empty", () => {
    expect(() => pickRandom([])).toThrow();
  });
});
