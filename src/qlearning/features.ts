import { BOARD_HEIGHT, BOARD_WIDTH } from "../engine";
import type { Board, PieceType } from "../engine";
import { countHoles } from "../agent/evaluator";

/**
 * Durum özellikleri — sürüm: "state-v1".
 * Durum temsili yönetilebilir büyüklükte tutulur: her özellik sepete
 * (bin) ayrıştırılır ve anahtar "state-v1|h,h,h,h|PIECE" biçimindedir.
 * Sepet eşiği değişirse sürüm yükseltilmelidir (eski Q tabloları reddedilir).
 */
export const FEATURE_VERSION = "state-v1";

export interface StateBins {
  aggregateHeight: number;
  holes: number;
  maxHeight: number;
  bumpiness: number;
}

/** Sepet eşikleri (dahil): değer > eşik ise sonraki sepete geçer. */
const THRESHOLDS = {
  aggregateHeight: [60, 100, 140], // 0..3 sepet (maks 200)
  holes: [1, 3, 6], // 0..3 sepet
  maxHeight: [6, 10, 14], // 0..3 sepet (maks 20)
  bumpiness: [10, 20, 35], // 0..3 sepet
} as const;

function binOf(value: number, thresholds: readonly number[]): number {
  let bin = 0;
  for (const threshold of thresholds) {
    if (value > threshold) bin += 1;
  }
  return bin;
}

/** Tahtayı ayrık özellik sepetlerine ayrıştırır. */
export function discretize(board: Board): StateBins {
  let aggregate = 0;
  let maxHeight = 0;
  let bumpiness = 0;
  for (let c = 0; c < BOARD_WIDTH; c++) {
    let height = 0;
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (board[r][c] !== null) {
        height = BOARD_HEIGHT - r;
        break;
      }
    }
    aggregate += height;
    if (height > maxHeight) maxHeight = height;
  }
  for (let c = 0; c < BOARD_WIDTH - 1; c++) {
    const h1 = columnHeight(board, c);
    const h2 = columnHeight(board, c + 1);
    bumpiness += Math.abs(h1 - h2);
  }
  return {
    aggregateHeight: binOf(aggregate, THRESHOLDS.aggregateHeight),
    holes: binOf(countHoles(board), THRESHOLDS.holes),
    maxHeight: binOf(maxHeight, THRESHOLDS.maxHeight),
    bumpiness: binOf(bumpiness, THRESHOLDS.bumpiness),
  };
}

function columnHeight(board: Board, column: number): number {
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    if (board[r][column] !== null) return BOARD_HEIGHT - r;
  }
  return 0;
}

/** Durum anahtarı: özellik sürümü + sepetler + parça tipi. */
export function stateKey(board: Board, pieceType: PieceType): string {
  const bins = discretize(board);
  return `${FEATURE_VERSION}|${bins.aggregateHeight},${bins.holes},${bins.maxHeight},${bins.bumpiness}|${pieceType}`;
}

/** Eylem anahtarı: "rotation:column" — ajan aday kimlikleriyle aynı biçim. */
export function actionKey(rotation: number, column: number): string {
  return `${rotation}:${column}`;
}
