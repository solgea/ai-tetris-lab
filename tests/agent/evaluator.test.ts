import { describe, expect, it } from "vitest";
import {
  boardFingerprint,
  createEmptyBoard,
} from "../../src/engine";
import {
  columnHeights,
  countHoles,
  evaluateBoard,
  metricValue,
} from "../../src/agent/evaluator";

describe("tahta değerlendirici", () => {
  it("boş tahtada tüm ölçütler sıfırdır", () => {
    const metrics = evaluateBoard(createEmptyBoard());
    expect(metrics.columnHeights).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(metrics.holes).toBe(0);
    expect(metrics.aggregateHeight).toBe(0);
    expect(metrics.maxHeight).toBe(0);
    expect(metrics.bumpiness).toBe(0);
  });

  it("sütun yükseklikleri doğru hesaplanır", () => {
    const board = createEmptyBoard();
    board[18][0] = "I"; // sütun 0 yüksekliği 2
    board[19][0] = "I";
    board[19][1] = "I"; // sütun 1 yüksekliği 1
    board[19][2] = "I"; // sütun 2 yüksekliği 1
    expect(columnHeights(board)).toEqual([2, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("toplam ve tepe yükseklik ile düzensizlik doğru hesaplanır", () => {
    const board = createEmptyBoard();
    board[18][0] = "I";
    board[19][0] = "I";
    board[19][1] = "I";
    board[19][2] = "I";
    const metrics = evaluateBoard(board);
    expect(metrics.aggregateHeight).toBe(4);
    expect(metrics.maxHeight).toBe(2);
    // [2,1,1,0,...] → |2-1| + |1-1| + |1-0| + 7×|0-0| = 2
    expect(metrics.bumpiness).toBe(2);
  });

  it("delik sayısı: dolu hücre altındaki boş hücreler sayılır", () => {
    const board = createEmptyBoard();
    board[17][0] = "I";
    board[19][0] = "I"; // 18. satır boş → 1 delik
    board[19][5] = "I"; // delik değil (üstünde dolu yok)
    expect(countHoles(board)).toBe(1);
  });

  it("üstü dolu olmayan hücreler delik sayılmaz", () => {
    const board = createEmptyBoard();
    board[18][5] = "I";
    board[19][5] = "I"; // altı dolu → delik değil
    board[19][3] = "I"; // taban hücresi → delik değil
    expect(countHoles(board)).toBe(0);
  });

  it("metricValue ölçüte göre değer döndürür", () => {
    const board = createEmptyBoard();
    board[19][0] = "I";
    const metrics = evaluateBoard(board);
    expect(metricValue(metrics, "aggregateHeight")).toBe(1);
    expect(metricValue(metrics, "holes")).toBe(0);
  });

  it("parmak izi kayıtlar için kararlıdır", () => {
    const board = createEmptyBoard();
    board[19][0] = "I";
    expect(boardFingerprint(board)).toBe(boardFingerprint(board));
  });
});
