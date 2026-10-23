import type { PieceType } from "./types";

/** Tahta genişliği (sütun) */
export const BOARD_WIDTH = 10;
/** Tahta yüksekliği (görünür satır) */
export const BOARD_HEIGHT = 20;
/** Doğumdan sonra kuyrukta tutulacak parça sayısı (1 tanesi hemen doğar) */
export const PREVIEW_COUNT = 4;
export const PIECE_TYPES: readonly PieceType[] = [
  "I",
  "O",
  "T",
  "S",
  "Z",
  "J",
  "L",
];
/** 0, 1, 2, 3, 4 satır temizliği için taban puan (seviye ile çarpılır) */
export const LINE_SCORES: readonly number[] = [0, 100, 300, 500, 800];
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
/** Seviye atlamak için gereken satır sayısı */
export const LINES_PER_LEVEL = 10;

/** Döndürme duvar tekmesi (wall kick) deneme sırası: sütun ofsetleri */
export const KICK_OFFSETS: readonly number[] = [0, -1, 1, -2, 2];
