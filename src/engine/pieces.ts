import { PIECE_TYPES } from "./constants";
import type { PieceType } from "./types";

/**
 * Tetromino doğuş (spawn) matrisleri. I parçası 4x4 matriste tutulur ki
 * döndürmeler simetrik ve tutarlı olsun; O 2x2, diğerleri 3x3'tür.
 * 1 değerleri dolu hücreleri gösterir.
 */
const BASE_SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

/** Saat yönünde 90° döndürme: (r, c) -> (c, n-1-r). Saf. */
export function rotateMatrixCW(matrix: number[][]): number[][] {
  const n = matrix.length;
  const out: number[][] = Array.from({ length: n }, () =>
    Array<number>(n).fill(0),
  );
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[c][n - 1 - r] = matrix[r][c];
    }
  }
  return out;
}

/** Her parçanın 4 döndürme matrisi önceden hesaplanır. */
export const ROTATIONS: Record<PieceType, number[][][]> = (() => {
  const out = {} as Record<PieceType, number[][][]>;
  for (const t of PIECE_TYPES) {
    const rotations: number[][][] = [BASE_SHAPES[t]];
    for (let i = 1; i < 4; i++) {
      rotations.push(rotateMatrixCW(rotations[i - 1]));
    }
    out[t] = rotations;
  }
  return out;
})();

/** Negatif olmayan mod ile döndürme indeksini normalize eder. */
export function normalizeRotation(rotation: number): number {
  return ((rotation % 4) + 4) % 4;
}

/** Parçanın verilen döndürme yönündeki şekil matrisi. */
export function shapeOf(type: PieceType, rotation: number): number[][] {
  return ROTATIONS[type][normalizeRotation(rotation)];
}
