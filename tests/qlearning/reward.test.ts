import { describe, expect, it } from "vitest";
import { createEmptyBoard } from "../../src/engine";
import { computeReward } from "../../src/qlearning/reward";

describe("ödül fonksiyonu — sınır durumları", () => {
  it("değişiklik yoksa ödül 0'dır", () => {
    const board = createEmptyBoard();
    const result = computeReward({
      linesCleared: 0,
      boardBefore: board,
      boardAfter: board,
      gameOver: false,
    });
    expect(result.total).toBe(0);
    expect(result.lines).toBe(0);
    expect(result.holes).toBe(0);
    expect(result.height).toBe(0);
    expect(result.gameOver).toBe(0);
  });

  it("satır temizleme ödüllendirilir: 1 satır = 50", () => {
    const board = createEmptyBoard();
    const result = computeReward({
      linesCleared: 1,
      boardBefore: board,
      boardAfter: board,
      gameOver: false,
    });
    expect(result.lines).toBe(50);
    expect(result.total).toBe(50);
  });

  it("tetris bonusu uygulanır: 4 satır = 4×50 + 200", () => {
    const board = createEmptyBoard();
    const result = computeReward({
      linesCleared: 4,
      boardBefore: board,
      boardAfter: board,
      gameOver: false,
    });
    expect(result.lines).toBe(400);
  });

  it("delik artışı cezalandırılır", () => {
    const before = createEmptyBoard();
    const after = createEmptyBoard();
    after[17][0] = "I";
    after[19][0] = "I"; // 18. satır delik
    const result = computeReward({
      linesCleared: 0,
      boardBefore: before,
      boardAfter: after,
      gameOver: false,
    });
    expect(result.holes).toBe(-12);
    // tepe yüksekliği 3 arttı → -6
    expect(result.height).toBe(-6);
    expect(result.total).toBe(-18);
  });

  it("delik azalması ek ödül vermez (0'dan aşağı kırpılır)", () => {
    const before = createEmptyBoard();
    before[17][0] = "I";
    before[19][0] = "I"; // 1 delik
    const after = createEmptyBoard();
    const result = computeReward({
      linesCleared: 0,
      boardBefore: before,
      boardAfter: after,
      gameOver: false,
    });
    expect(result.holes).toBe(0); // azalış ödüllendirilmez
  });

  it("oyun sonu cezası eklenir", () => {
    const board = createEmptyBoard();
    const result = computeReward({
      linesCleared: 0,
      boardBefore: board,
      boardAfter: board,
      gameOver: true,
    });
    expect(result.gameOver).toBe(-200);
    expect(result.total).toBe(-200);
  });

  it("oyun sonu + satır temizliği birlikte toplanır", () => {
    const board = createEmptyBoard();
    const result = computeReward({
      linesCleared: 2,
      boardBefore: board,
      boardAfter: board,
      gameOver: true,
    });
    expect(result.total).toBe(100 - 200);
  });
});
