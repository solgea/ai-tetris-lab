import { describe, expect, it } from "vitest";
import {
  applyMove,
  boardFingerprint,
  createEmptyBoard,
  createGame,
  hardDrop,
  levelForLines,
  MOVE_FNS,
  pieceCells,
  rotatePiece,
  softDrop,
  tick,
  tryShift,
} from "../../src/engine";
import type { ActivePiece, GameState } from "../../src/engine";

function withCurrent(
  state: GameState,
  current: Partial<ActivePiece>,
): GameState {
  return { ...state, current: { ...state.current, ...current } };
}

describe("oyun kurulumu", () => {
  it("yeni oyun boş tahta, çakışmayan parça ve 3 parçalık önizleme ile başlar", () => {
    const state = createGame(42);
    expect(state.over).toBe(false);
    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
    expect(state.level).toBe(1);
    expect(state.board.every((row) => row.every((c) => c === null))).toBe(true);
    expect(state.next.length).toBe(3);
    expect(state.current.x).toBeGreaterThanOrEqual(0);
    const collidesWithBoard = pieceCells(state.current).some(
      ({ x, y }) =>
        y >= 0 && x >= 0 && x < 10 && y < 20 && state.board[y][x] !== null,
    );
    expect(collidesWithBoard).toBe(false);
  });

  it("aynı seed ile aynı parça dizisi üretilir (tekrarlanabilirlik)", () => {
    const a = createGame(1234);
    const b = createGame(1234);
    expect(a.current.type).toBe(b.current.type);
    expect(a.next).toEqual(b.next);
    let sa = a;
    let sb = b;
    for (let i = 0; i < 10; i++) {
      sa = hardDrop(sa);
      sb = hardDrop(sb);
      expect(boardFingerprint(sa.board)).toBe(boardFingerprint(sb.board));
      expect(sa.score).toBe(sb.score);
      expect(sa.pieces).toBe(sb.pieces);
    }
  });

  it("farklı seed'ler farklı parça dizileri üretir", () => {
    const a = createGame(1);
    const b = createGame(2);
    const aSeq = [a.current.type, ...a.next];
    const bSeq = [b.current.type, ...b.next];
    expect(aSeq).not.toEqual(bSeq);
  });
});

describe("hareketler", () => {
  it("yatay hareket parçayı kaydırır ve tahtayı değiştirmez", () => {
    const state = createGame(7);
    const boardBefore = boardFingerprint(state.board);
    const moved = tryShift(state, -1);
    expect(moved.current.x).toBe(state.current.x - 1);
    expect(boardFingerprint(moved.board)).toBe(boardBefore);
  });

  it("duvarda geçersiz yatay hareket durumu değiştirmez", () => {
    const state = createGame(7);
    const atWall = withCurrent(state, { x: 0, rotation: 0, type: "I" });
    const blocked = tryShift(atWall, -1);
    expect(blocked).toBe(atWall); // aynı referans — değişiklik yok
  });

  it("döndürme duvar tekmesiyle uygulanır", () => {
    const state = createGame(7);
    const atWall = withCurrent(state, { x: 0, rotation: 0, type: "I" });
    const rotated = rotatePiece(atWall, 1);
    expect(rotated.current.rotation).toBe(1);
  });

  it("dönmenin engellendiği durumda parça aynı kalır", () => {
    const state = createGame(7);
    // Taban satırı tamamen dolu: yatay I y=17'de (hücreler 18. satırda).
    // Dikey I 4 satır kapladığından 20. satır taşar → tüm tekmeler çakışır.
    const full = state.board.map((row, r) =>
      row.map(() => (r === 19 ? ("I" as const) : null)),
    );
    const stuck: GameState = {
      ...state,
      board: full,
      current: { type: "I", rotation: 0, x: 0, y: 17 },
    };
    const same = rotatePiece(stuck, 1);
    expect(same.current.rotation).toBe(0);
    expect(same).toBe(stuck);
  });

  it("applyMove ile doğrudan fonksiyonlar aynı sonucu verir", () => {
    const state = createGame(9);
    expect(applyMove(state, "hardDrop")).toEqual(hardDrop(state));
    expect(applyMove(state, "left")).toEqual(MOVE_FNS.left(state));
  });
});

describe("yerçekimi ve düşüş", () => {
  it("tick parçayı bir satır indirir ve puan vermez", () => {
    const state = createGame(5);
    const next = tick(state);
    expect(next.current.y).toBe(state.current.y + 1);
    expect(next.score).toBe(state.score);
  });

  it("softDrop hücre başına 1 puan verir", () => {
    const state = createGame(5);
    const next = softDrop(state);
    expect(next.current.y).toBe(state.current.y + 1);
    expect(next.score).toBe(state.score + 1);
  });

  it("hardDrop en aşağıya indirir ve hücre başına 2 puan verir", () => {
    const state = createGame(5);
    const iState: GameState = {
      ...state,
      board: createEmptyBoard(),
      current: { type: "I", rotation: 0, x: 3, y: 0 },
    };
    const dropped = hardDrop(iState);
    // I parçası y=0'da hücreleri 1. satırda; tabana kadar 18 adım iner
    expect(dropped.score).toBe(36);
    for (let c = 3; c <= 6; c++) {
      expect(dropped.board[19][c]).toBe("I");
    }
    expect(dropped.pieces).toBe(state.pieces + 1);
  });
});

describe("satır temizleme ve skor", () => {
  it("tek satır temizliği 100 × seviye puan verir", () => {
    const state = createGame(5);
    const board = createEmptyBoard();
    for (let c = 0; c < 10; c++) {
      if (c < 3 || c > 6) board[19][c] = "J";
    }
    const prepared: GameState = {
      ...state,
      board,
      current: { type: "I", rotation: 0, x: 3, y: 0 },
    };
    const dropped = hardDrop(prepared);
    expect(dropped.lines).toBe(1);
    expect(dropped.score).toBe(36 + 100);
    expect(dropped.lastClear).toEqual({ lines: 1, type: "single" });
    expect(dropped.board[19].every((c) => c === null)).toBe(true);
  });

  it("tetris (4 satır) 800 × seviye puan verir", () => {
    const state = createGame(5);
    const board = createEmptyBoard();
    for (let r = 16; r <= 19; r++) {
      for (let c = 0; c < 10; c++) {
        if (c !== 5) board[r][c] = "J";
      }
    }
    const prepared: GameState = {
      ...state,
      board,
      current: { type: "I", rotation: 1, x: 3, y: 0 },
    };
    const dropped = hardDrop(prepared);
    expect(dropped.lines).toBe(4);
    expect(dropped.score).toBe(32 + 800);
    expect(dropped.lastClear).toEqual({ lines: 4, type: "tetris" });
  });

  it("seviye hesabı: 10 satırda seviye 2 olur", () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(9)).toBe(1);
    expect(levelForLines(10)).toBe(2);
    expect(levelForLines(25)).toBe(3);
  });
});

describe("oyun sonu", () => {
  it("tekrarlanan düşüşlerle tahta dolar ve oyun biter; sonra hamleler etkisizdir", () => {
    let state = createGame(99);
    let steps = 0;
    while (!state.over && steps < 300) {
      state = hardDrop(state);
      steps++;
    }
    expect(state.over).toBe(true);
    expect(steps).toBeLessThan(300);
    expect(hardDrop(state)).toBe(state);
    expect(tick(state)).toBe(state);
  });

  it("doğuş çakışması oyunu derhal bitirir", () => {
    const state = createGame(5);
    const board = createEmptyBoard();
    // T parçasının doğuş hücrelerini (4,0), (3,1), (4,1), (5,1) doldur
    board[0][4] = "O";
    board[1][3] = "O";
    board[1][4] = "O";
    board[1][5] = "O";
    const prepared: GameState = {
      ...state,
      board,
      current: { type: "T", rotation: 0, x: 3, y: 10 },
    };
    const dropped = hardDrop(prepared);
    expect(dropped.over).toBe(true);
  });
});
