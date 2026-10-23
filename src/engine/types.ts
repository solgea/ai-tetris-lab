/** Oyun motorunun temel veri tipleri. Arayüz ve ajan bu tipleri kullanır. */

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

/** Tahta hücresi: parça tipi veya boş. */
export type Cell = PieceType | null;

/**
 * Tahta matrisi. rows[0] en üstteki görünür satır,
 * rows[BOARD_HEIGHT - 1] tabandır. Satırlar sabit 20, sütunlar sabit 10'dur.
 */
export type Board = Cell[][];

/** Aktif (havada duran) parça. */
export interface ActivePiece {
  type: PieceType;
  /** 0..3 — doğuş yönünden itibaren saat yönünde döndürme sayısı */
  rotation: number;
  /** Şekil matrisinin sol kenarının sütun indeksi */
  x: number;
  /** Şekil matrisinin üst kenarının satır indeksi (0 = en üst görünür satır) */
  y: number;
}

export interface ClearEvent {
  lines: number;
  type: "single" | "double" | "triple" | "tetris" | null;
}

/** Oyun durumunun tam, değişmez (immutable) anlık görüntüsü. */
export interface GameState {
  board: Board;
  current: ActivePiece;
  /** Sıradaki parçalar (önizleme kuyruğu) */
  next: PieceType[];
  /** 7'lik torbadan kalan parçalar */
  bag: PieceType[];
  /** mulberry32 rastgelelik durumları — tekrarlanabilirlik için saklanır */
  rngState: number;
  /** Oyunun başlatıldığı tohum (seed) */
  seed: number;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  /** Şu ana kadar doğan parça sayısı (oynanmakta olan dahil) */
  pieces: number;
  lastClear: ClearEvent | null;
}

export type Move =
  | "left"
  | "right"
  | "rotateCW"
  | "rotateCCW"
  | "softDrop"
  | "hardDrop";

export type MoveFn = (state: GameState) => GameState;
