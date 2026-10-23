import { BOARD_HEIGHT, BOARD_WIDTH } from "../engine";
import type { Board } from "../engine";
import type { BoardMetrics, MetricName } from "./types";

/**
 * Tahta değerlendirici: bir tahtanın açıklanabilir ölçütlerini hesaplar.
 * Tüm fonksiyonlar saftır ve girdi tahtayı değiştirmez.
 */

/** Sütun yükseklikleri: en üstteki dolu hücreden tabana uzaklık (satır). */
export function columnHeights(board: Board): number[] {
  const heights: number[] = [];
  for (let c = 0; c < BOARD_WIDTH; c++) {
    heights.push(0);
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (board[r][c] !== null) {
        heights[c] = BOARD_HEIGHT - r;
        break;
      }
    }
  }
  return heights;
}

/** Delik sayısı: aynı sütunda üstünde dolu hücre bulunan boş hücreler. */
export function countHoles(board: Board): number {
  let holes = 0;
  for (let c = 0; c < BOARD_WIDTH; c++) {
    let seenFilled = false;
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (board[r][c] !== null) {
        seenFilled = true;
      } else if (seenFilled) {
        holes += 1;
      }
    }
  }
  return holes;
}

/** Tahtanın tüm ölçütlerini tek geçişte hesaplar. */
export function evaluateBoard(board: Board): BoardMetrics {
  const heights = columnHeights(board);
  const aggregateHeight = heights.reduce((a, b) => a + b, 0);
  const maxHeight = Math.max(...heights);
  let bumpiness = 0;
  for (let c = 0; c < BOARD_WIDTH - 1; c++) {
    bumpiness += Math.abs(heights[c] - heights[c + 1]);
  }
  return {
    linesCleared: 0, // simülatör temizleme sonrası doldurur
    holes: countHoles(board),
    aggregateHeight,
    maxHeight,
    bumpiness,
    columnHeights: heights,
  };
}

export function metricValue(metrics: BoardMetrics, name: MetricName): number {
  return metrics[name];
}
