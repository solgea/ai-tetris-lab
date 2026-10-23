import { collides, clearFullLines, mergePiece } from "../engine";
import type { ActivePiece, Board } from "../engine";
import { evaluateBoard } from "./evaluator";
import type { BoardMetrics } from "./types";

/**
 * Hamle simülatörü: bir parçanın motorun sert düşüşüyle birebir aynı
 * kurallarla tahtaya bırakılmasının sonucunu hesaplar. Girdi tahtayı
 * asla değiştirmez.
 */
export interface SimulationResult {
  /** Parça kilitlendikten ve satırlar temizlendikten sonraki tahta */
  board: Board;
  /** Temizlenen satır sayısı */
  linesCleared: number;
  /** Parça matrisinin üst kenarının kilitlendiği satır */
  landingY: number;
  /** Sonuç tahtasının ölçütleri (linesCleared dahil) */
  metrics: BoardMetrics;
}

/**
 * Parçayı mevcut konumundan dikey olarak en aşağı indirir, kilitler ve
 * satır temizliğini uygular. Başlangıç konumu çakışıyorsa null döner.
 */
export function simulateDrop(
  board: Board,
  piece: ActivePiece,
): SimulationResult | null {
  if (collides(board, piece)) {
    return null;
  }
  let landing = piece;
  for (;;) {
    const candidate: ActivePiece = { ...landing, y: landing.y + 1 };
    if (collides(board, candidate)) break;
    landing = candidate;
  }
  const merged = mergePiece(board, landing);
  const { board: cleared, clearedRows } = clearFullLines(merged);
  const metrics = evaluateBoard(cleared);
  metrics.linesCleared = clearedRows.length;
  return {
    board: cleared,
    linesCleared: clearedRows.length,
    landingY: landing.y,
    metrics,
  };
}
