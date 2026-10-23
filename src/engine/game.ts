import {
  BOARD_WIDTH,
  HARD_DROP_POINTS,
  KICK_OFFSETS,
  PIECE_TYPES,
  PREVIEW_COUNT,
  SOFT_DROP_POINTS,
} from "./constants";
import { collides, clearFullLines, createEmptyBoard, mergePiece } from "./board";
import { shapeOf } from "./pieces";
import { clearEventFor, levelForLines, lineScore } from "./score";
import { shuffled } from "./rng";
import type { ActivePiece, GameState, Move, MoveFn, PieceType } from "./types";

/**
 * Oyun motoru — kuralların tek doğruluk kaynağı.
 * Tüm fonksiyonlar saftır: mevcut durumu değiştirmez, yeni durum döndürür.
 * Rastgelelik tohumlanabilir; aynı seed ile aynı parça dizisi üretilir.
 */

/** Doğumdan sonra kuyrukta bekleyen parça sayısı (önizlemede gösterilir) */
const INITIAL_QUEUE = PREVIEW_COUNT;

function fillQueue(
  next: PieceType[],
  bag: PieceType[],
  rngState: number,
): { next: PieceType[]; bag: PieceType[]; rngState: number } {
  const queue = [...next];
  let currentBag = [...bag];
  let s = rngState;
  while (queue.length < INITIAL_QUEUE) {
    if (currentBag.length === 0) {
      const result = shuffled(PIECE_TYPES, s);
      currentBag = result.items;
      s = result.rngState;
    }
    queue.push(currentBag.shift() as PieceType);
  }
  return { next: queue, bag: currentBag, rngState: s };
}

/** Sıradaki parçayı doğurur; doğuş pozisyonu çakışıyorsa oyun biter. */
function spawnNext(state: GameState): GameState {
  const filled = fillQueue(state.next, state.bag, state.rngState);
  const type = filled.next[0];
  const queue = filled.next.slice(1);
  const shape = shapeOf(type, 0);
  const x = Math.floor((BOARD_WIDTH - shape[0].length) / 2);
  const current: ActivePiece = { type, rotation: 0, x, y: 0 };
  const base: GameState = {
    ...state,
    next: queue,
    bag: filled.bag,
    rngState: filled.rngState,
    current,
    pieces: state.pieces + 1,
  };
  if (collides(state.board, current)) {
    return { ...base, over: true };
  }
  return base;
}

export function createGame(seed?: number): GameState {
  const resolvedSeed =
    seed === undefined
      ? Math.floor(Math.random() * 0x100000000) >>> 0
      : seed >>> 0;
  const empty: GameState = {
    board: createEmptyBoard(),
    current: { type: "I", rotation: 0, x: 3, y: 0 },
    next: [],
    bag: [],
    rngState: resolvedSeed,
    seed: resolvedSeed,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    pieces: 0,
    lastClear: null,
  };
  const filled = fillQueue(empty.next, empty.bag, empty.rngState);
  return spawnNext({ ...empty, next: filled.next, bag: filled.bag, rngState: filled.rngState });
}

/** Yatay hareket; geçersizse durumu olduğu gibi döndürür. */
export function tryShift(state: GameState, dx: number): GameState {
  if (state.over) return state;
  const candidate: ActivePiece = { ...state.current, x: state.current.x + dx };
  if (collides(state.board, candidate)) return state;
  return { ...state, current: candidate };
}

/** Döndürme + duvar tekmesi; hiçbir ofset uymazsa durum değişmez. */
export function rotatePiece(state: GameState, direction: 1 | -1): GameState {
  if (state.over) return state;
  const rotation = (state.current.rotation + direction + 4) % 4;
  for (const kick of KICK_OFFSETS) {
    const candidate: ActivePiece = {
      ...state.current,
      rotation,
      x: state.current.x + kick,
    };
    if (!collides(state.board, candidate)) {
      return { ...state, current: candidate };
    }
  }
  return state;
}

function lockCurrentPiece(state: GameState, dropPoints: number): GameState {
  const merged = mergePiece(state.board, state.current);
  const { board, clearedRows } = clearFullLines(merged);
  const linesCleared = clearedRows.length;
  const totalLines = state.lines + linesCleared;
  const gained =
    dropPoints + lineScore(linesCleared, state.level);
  return {
    ...state,
    board,
    score: state.score + gained,
    lines: totalLines,
    level: levelForLines(totalLines),
    lastClear: clearEventFor(linesCleared),
  };
}

/** Parçayı bir satır aşağı indirir; inemezse kilitler (yerçekimi adımı). */
export function tick(state: GameState): GameState {
  if (state.over) return state;
  const candidate: ActivePiece = { ...state.current, y: state.current.y + 1 };
  if (collides(state.board, candidate)) {
    return spawnNext(lockCurrentPiece(state, 0));
  }
  return { ...state, current: candidate };
}

/** Yumuşak düşüş: yerçekimiyle aynı ama hücre başına puan verir. */
export function softDrop(state: GameState): GameState {
  if (state.over) return state;
  const candidate: ActivePiece = { ...state.current, y: state.current.y + 1 };
  if (collides(state.board, candidate)) {
    return spawnNext(lockCurrentPiece(state, 0));
  }
  return { ...state, current: candidate, score: state.score + SOFT_DROP_POINTS };
}

/** Sert düşüş: en aşağıya iner, kilitler, satır temizler, puan yazar. */
export function hardDrop(state: GameState): GameState {
  if (state.over) return state;
  let piece = state.current;
  let distance = 0;
  for (;;) {
    const candidate: ActivePiece = { ...piece, y: piece.y + 1 };
    if (collides(state.board, candidate)) break;
    piece = candidate;
    distance += 1;
  }
  const dropped: GameState = { ...state, current: piece };
  return spawnNext(lockCurrentPiece(dropped, HARD_DROP_POINTS * distance));
}

export const MOVE_FNS: Record<Move, MoveFn> = {
  left: (s) => tryShift(s, -1),
  right: (s) => tryShift(s, 1),
  rotateCW: (s) => rotatePiece(s, 1),
  rotateCCW: (s) => rotatePiece(s, -1),
  softDrop: (s) => softDrop(s),
  hardDrop: (s) => hardDrop(s),
};

/** Oyun kurallarına göre tek bir hamleyi uygular. Saf. */
export function applyMove(state: GameState, move: Move): GameState {
  return MOVE_FNS[move](state);
}
