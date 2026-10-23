import { describe, expect, it } from "vitest";
import { createEmptyBoard } from "../../src/engine";
import { discretize, stateKey, actionKey, FEATURE_VERSION } from "../../src/qlearning/features";

describe("durum özellikleri", () => {
  it("boş tahta en düşük sepetlere ayrışır", () => {
    const bins = discretize(createEmptyBoard());
    expect(bins).toEqual({
      aggregateHeight: 0,
      holes: 0,
      maxHeight: 0,
      bumpiness: 0,
    });
  });

  it("yükseklik arttıkça sepet indeksi artar (monotonluk)", () => {
    const shallow = createEmptyBoard();
    for (let c = 0; c < 10; c++) shallow[19][c] = "I"; // 1 satır dolu
    const tall = createEmptyBoard();
    for (let r = 5; r < 20; r++) {
      for (let c = 0; c < 10; c++) tall[r][c] = "I"; // 15 satır dolu
    }
    const shallowBins = discretize(shallow);
    const tallBins = discretize(tall);
    expect(tallBins.maxHeight).toBeGreaterThan(shallowBins.maxHeight);
    expect(tallBins.aggregateHeight).toBeGreaterThan(
      shallowBins.aggregateHeight,
    );
  });

  it("delik arttıkça delik sepeti artar", () => {
    const one = createEmptyBoard();
    one[17][0] = "I";
    one[19][0] = "I";
    const many = createEmptyBoard();
    many[17][0] = "I";
    many[19][0] = "I";
    many[17][1] = "I";
    many[19][1] = "I";
    expect(discretize(many).holes).toBeGreaterThanOrEqual(
      discretize(one).holes,
    );
  });

  it("durum anahtarı sürüm içerir ve parça tipiyle ayrışır", () => {
    const board = createEmptyBoard();
    const keyT = stateKey(board, "T");
    const keyI = stateKey(board, "I");
    expect(keyT).toContain(FEATURE_VERSION);
    expect(keyT).not.toBe(keyI);
    expect(keyT).toBe(stateKey(board, "T")); // deterministik
  });

  it("eylem anahtarı biçimi kararlıdır", () => {
    expect(actionKey(2, 7)).toBe("2:7");
  });
});
