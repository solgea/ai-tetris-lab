import { LINE_SCORES, LINES_PER_LEVEL } from "./constants";
import type { ClearEvent } from "./types";

/** Temizlenen satır sayısına göre puan (seviye çarpanlı). */
export function lineScore(linesCleared: number, level: number): number {
  const idx = Math.min(Math.max(linesCleared, 0), LINE_SCORES.length - 1);
  return LINE_SCORES[idx] * Math.max(level, 1);
}

/** Toplam temizlenen satırdan seviye hesabı. */
export function levelForLines(lines: number): number {
  return Math.floor(Math.max(lines, 0) / LINES_PER_LEVEL) + 1;
}

export function clearEventFor(linesCleared: number): ClearEvent {
  switch (linesCleared) {
    case 1:
      return { lines: 1, type: "single" };
    case 2:
      return { lines: 2, type: "double" };
    case 3:
      return { lines: 3, type: "triple" };
    case 4:
      return { lines: 4, type: "tetris" };
    default:
      return { lines: linesCleared, type: null };
  }
}
