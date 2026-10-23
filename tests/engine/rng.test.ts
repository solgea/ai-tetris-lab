import { describe, expect, it } from "vitest";
import { nextRandom, shuffled } from "../../src/engine/rng";
import { PIECE_TYPES } from "../../src/engine/constants";

describe("tohumlanabilir rastgelelik", () => {
  it("aynı tohum aynı değer dizisini üretir", () => {
    const a = [0, 1, 2].reduce<{ values: number[]; state: number }>(
      (acc) => {
        const r = nextRandom(acc.state);
        return { values: [...acc.values, r.value], state: r.state };
      },
      { values: [], state: 42 },
    );
    const b = [0, 1, 2].reduce<{ values: number[]; state: number }>(
      (acc) => {
        const r = nextRandom(acc.state);
        return { values: [...acc.values, r.value], state: r.state };
      },
      { values: [], state: 42 },
    );
    expect(a.values).toEqual(b.values);
    expect(a.state).toBe(b.state);
  });

  it("farklı tohumlar farklı diziler üretir", () => {
    expect(nextRandom(1).value).not.toBe(nextRandom(2).value);
  });

  it("karıştırma tohumla tekrarlanabilir ve tüm elemanları korur", () => {
    const first = shuffled(PIECE_TYPES, 1234);
    const second = shuffled(PIECE_TYPES, 1234);
    expect(first.items).toEqual(second.items);
    expect([...first.items].sort()).toEqual([...PIECE_TYPES].sort());
  });

  it("değerler [0,1) aralığındadır", () => {
    let state = 7;
    for (let i = 0; i < 1000; i++) {
      const r = nextRandom(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      state = r.state;
    }
  });
});
