import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants";
import { shapeOf } from "./pieces";
import type { ActivePiece, Board, Cell } from "./types";

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<Cell>(BOARD_WIDTH).fill(null),
  );
}

export interface PieceCell {
  x: number;
  y: number;
}

/** Parçanın dolu hücrelerinin tahta koordinatları. */
export function pieceCells(piece: ActivePiece): PieceCell[] {
  const shape = shapeOf(piece.type, piece.rotation);
  const cells: PieceCell[] = [];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        cells.push({ x: piece.x + c, y: piece.y + r });
      }
    }
  }
  return cells;
}

/**
 * Çarpışma denetimi: hücreler duvar dışına çıkıyor mu, tabanın altına
 * iniyor mu veya dolu bir hücreye giriyor mu? Tahtanın üstü (y < 0)
 * serbesttir; parçalar orada doğabilir.
 */
export function collides(board: Board, piece: ActivePiece): boolean {
  for (const { x, y } of pieceCells(piece)) {
    if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) {
      return true;
    }
    if (y >= 0 && board[y][x] !== null) {
      return true;
    }
  }
  return false;
}

/** Parçayı tahtaya işler; yeni bir tahta döndürür (orijinal değişmez). */
export function mergePiece(board: Board, piece: ActivePiece): Board {
  const next = board.map((row) => [...row]);
  for (const { x, y } of pieceCells(piece)) {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      next[y][x] = piece.type;
    }
  }
  return next;
}

export interface ClearResult {
  board: Board;
  /** Tam dolu satırların tahtadaki (eski) indeksleri */
  clearedRows: number[];
}

/** Tam dolu satırları temizler; kalan satırlar tabana yaslanır. Saf. */
export function clearFullLines(board: Board): ClearResult {
  const keptRows: Board = [];
  const clearedRows: number[] = [];
  for (let r = 0; r < board.length; r++) {
    if (board[r].every((cell) => cell !== null)) {
      clearedRows.push(r);
    } else {
      keptRows.push(board[r]);
    }
  }
  const next = createEmptyBoard();
  const offset = BOARD_HEIGHT - keptRows.length;
  for (let i = 0; i < keptRows.length; i++) {
    next[offset + i] = [...keptRows[i]];
  }
  return { board: next, clearedRows };
}

/** Tahtayı karakter dizisine çevirir; simülasyon/motor eşleşme denetimi için. */
export function boardFingerprint(board: Board): string {
  return board
    .map((row) => row.map((cell) => (cell === null ? "." : cell)).join(""))
    .join("|");
}
