import { describe, expect, it } from "vitest";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  boardFingerprint,
  clearFullLines,
  collides,
  createEmptyBoard,
  mergePiece,
} from "../../src/engine";
import type { ActivePiece, Board } from "../../src/engine";

function piece(partial: Partial<ActivePiece>): ActivePiece {
  return { type: "T", rotation: 0, x: 3, y: 0, ...partial };
}

describe("tahta işlemleri", () => {
  it("boş tahta 20 satır × 10 sütun ve tümü null", () => {
    const board = createEmptyBoard();
    expect(board.length).toBe(BOARD_HEIGHT);
    expect(board[0].length).toBe(BOARD_WIDTH);
    expect(board.every((row) => row.every((cell) => cell === null))).toBe(true);
  });

  it("sol ve sağ duvar çarpışması", () => {
    const board = createEmptyBoard();
    expect(collides(board, piece({ x: -1 }))).toBe(true);
    expect(collides(board, piece({ x: 8 }))).toBe(true); // T 3 genişlikte: 8,9,10
    expect(collides(board, piece({ x: 7 }))).toBe(false);
  });

  it("taban çarpışması", () => {
    const board = createEmptyBoard();
    expect(collides(board, piece({ y: 18 }))).toBe(false);
    expect(collides(board, piece({ y: 19 }))).toBe(true); // T 2 satır yüksek
  });

  it("dolu hücre çarpışması", () => {
    const board = createEmptyBoard();
    board[19][3] = "O";
    expect(collides(board, piece({ y: 18 }))).toBe(true);
  });

  it("tahtanın üstü serbesttir (y < 0 çarpışma sayılmaz)", () => {
    const board = createEmptyBoard();
    expect(collides(board, piece({ y: -1 }))).toBe(false);
  });

  it("geçersiz hamle durumu değiştirmez — mergePiece orijinal tahtayı bozmaz", () => {
    const board = createEmptyBoard();
    board[19][0] = "I";
    const snapshot = JSON.stringify(board);
    mergePiece(board, piece({ y: 18, x: 0 }));
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("mergePiece parçayı tahtaya işler", () => {
    const board = createEmptyBoard();
    const merged = mergePiece(board, piece({ y: 18, x: 3 }));
    expect(merged[18][4]).toBe("T"); // T üst orta hücresi
    expect(merged[19][3]).toBe("T");
    expect(merged[19][4]).toBe("T");
    expect(merged[19][5]).toBe("T");
  });

  it("tam dolu satır temizlenir ve üstteki satırlar aşağı iner", () => {
    const board = createEmptyBoard();
    board[18][0] = "J"; // temizlenmeyen hücre
    for (let c = 0; c < BOARD_WIDTH; c++) {
      board[19][c] = "I";
    }
    const result = clearFullLines(board);
    expect(result.clearedRows).toEqual([19]);
    expect(result.board[19][0]).toBe("J"); // bir satır aşağı indi
    expect(result.board[18].every((c) => c === null)).toBe(true);
  });

  it("iki tam satır birlikte temizlenir", () => {
    const board = createEmptyBoard();
    for (const row of [18, 19]) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        board[row][c] = "L";
      }
    }
    const result = clearFullLines(board);
    expect(result.clearedRows).toEqual([18, 19]);
    expect(result.board.every((row) => row.every((c) => c === null))).toBe(true);
  });

  it("parmak izi aynı tahtalar için aynı, farklı tahtalar için farklıdır", () => {
    const a = createEmptyBoard();
    const b = createEmptyBoard();
    expect(boardFingerprint(a)).toBe(boardFingerprint(b));
    b[19][0] = "S";
    expect(boardFingerprint(a)).not.toBe(boardFingerprint(b));
    const typed: Board = b;
    expect(typed[19][0]).toBe("S");
  });

  it("boş tahtanın parmak izi sabit 20×10 nokta ızgarasıdır", () => {
    const board = createEmptyBoard();
    expect(boardFingerprint(board)).toBe(
      "..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........",
    );
  });

  it("parmak izi sabit tahtada satır/sütun sırasını ve hücre kodlamasını korur", () => {
    const board = createEmptyBoard();
    board[0][0] = "I";
    board[0][1] = "O";
    board[0][9] = "T";
    board[1][0] = "S";
    board[1][4] = "Z";
    board[18][5] = "J";
    board[19][0] = "L";
    board[19][9] = "I";
    expect(boardFingerprint(board)).toBe(
      "IO.......T|S...Z.....|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|..........|.....J....|L........I",
    );
  });
});
