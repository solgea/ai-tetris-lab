import { describe, expect, it } from "vitest";
import {
  createEmptyBoard,
  createGame,
} from "../../src/engine";
import type { Board, GameState, PieceType } from "../../src/engine";
import { decide } from "../../src/agent/ruleAgent";
import { executePlan, verifyExecution } from "../../src/agent/runner";
import { DEFAULT_WEIGHTS, scoreCandidate } from "../../src/agent/heuristic";

const SEED_9_ROWS = [
  "..L.......",
  "..L.......",
  ".SLLZIIII.",
  ".SSZZT.OOJ",
  "..SZTTTOOJ",
  ".SSTIIIIJJ",
  "..LLLLZSOO",
  ".ZLT.ZZSSI",
  "..SSTJJJJI",
  ".SSTTTLJJZ",
  ".OOJLLLZZZ",
  ".OOJJJZZZI",
  ".TTTOOZSSI",
  ".ITJOOSSLI",
  ".ITJJJSSLI",
  ".ITTISSLLL",
  ".ITTILLLOO",
  ".ZTTIJJJOO",
  ".ZZSSJSSLL",
  ".TZZSSSJLL",
];

/** Seed 9 / karar 62 anının doğrudan, değişmez kopyası. */
function seed9State(): GameState {
  const board: Board = SEED_9_ROWS.map((row) =>
    [...row].map((cell) => (cell === "." ? null : (cell as PieceType))),
  );
  return {
    board,
    current: { type: "J", rotation: 0, x: 3, y: 0 },
    next: ["J", "O", "L"],
    bag: ["S", "Z", "T", "I"],
    rngState: -870373509,
    seed: 9,
    score: 2466,
    lines: 9,
    level: 1,
    over: false,
    pieces: 63,
    lastClear: null,
  };
}

function allTopOutState(): GameState {
  const base = createGame(9);
  const board = createEmptyBoard();
  board[1][3] = "O";
  board[1][6] = "O";
  return {
    ...base,
    board,
    current: { type: "O", rotation: 0, x: 4, y: 0 },
    next: ["I", "T", "L"],
    bag: ["S", "Z", "J", "O"],
    rngState: 12345,
    score: 0,
    lines: 0,
    pieces: 1,
    over: false,
  };
}

describe("kural tabanlı ajan", () => {
  it("seed 9 / karar 62: güvenli aday varken top-out seçmez", () => {
    const state = seed9State();
    const decision = decide(state);
    const candidates = decision.record.candidates;
    const safe = candidates.filter(
      (c) => c.reachable && c.willTopOut === false,
    );
    // record.candidates rankCandidates tarafından sıralanır; ilk güvenli
    // eşleşme bu nedenle gerçek sözleşmedeki en yüksek sıralı güvenli adaydır.
    const highestRankedSafe = candidates.find(
      (c) => c.reachable && c.willTopOut === false,
    );
    const selected = candidates.find(
      (c) => c.id === decision.record.selectedId,
    );

    expect(candidates.find((c) => c.id === "0:6")?.willTopOut).toBe(false);
    expect(candidates.find((c) => c.id === "0:3")?.willTopOut).toBe(true);
    expect(safe.length).toBeGreaterThan(0);
    expect(highestRankedSafe).toBeDefined();
    expect(decision.record.selectedId).toBe(highestRankedSafe?.id);
    expect(selected).toBeDefined();
    expect(selected?.reachable).toBe(true);
    expect(selected?.willTopOut).toBe(false);
    expect(decision.expectedOver).toBe(false);

    const result = executePlan(state, decision.plan);
    expect(result.completed).toBe(true);
    expect(result.state.over).toBe(false);
    expect(result.fingerprint).toBe(decision.expectedBoardFingerprint);
    expect(result.linesCleared).toBe(decision.expectedLines);
  });

  it("tüm ulaşılabilir adaylar top-out ise en iyi geri dönüşü seçer", () => {
    const state = allTopOutState();
    const decision = decide(state);
    const reachable = decision.record.candidates.filter((c) => c.reachable);
    // record.candidates rankCandidates tarafından sıralanır; ilk ulaşılabilir
    // aday bu nedenle gerçek sözleşmedeki en yüksek sıralı geri dönüştür.
    const highestRankedFallback = decision.record.candidates.find(
      (c) => c.reachable && c.score !== null,
    );
    const selected = decision.record.candidates.find(
      (c) => c.id === decision.record.selectedId,
    );

    expect(reachable.length).toBeGreaterThan(0);
    expect(reachable.every((c) => c.willTopOut === true)).toBe(true);
    expect(highestRankedFallback).toBeDefined();
    expect(decision.record.selectedId).toBe(highestRankedFallback?.id);
    expect(selected).toBeDefined();
    expect(selected?.reachable).toBe(true);
    expect(selected?.willTopOut).toBe(true);
    expect(decision.expectedOver).toBe(true);

    const result = executePlan(state, decision.plan);
    expect(result.completed).toBe(true);
    expect(result.state.over).toBe(true);

    const verification = verifyExecution({
      expectedBoardFingerprint: decision.expectedBoardFingerprint,
      expectedLines: decision.expectedLines,
      fingerprint: result.fingerprint,
      linesCleared: result.linesCleared,
      completed: result.completed,
      expectedOver: decision.expectedOver,
      actualOver: result.state.over,
    });
    expect(verification.ok).toBe(true);
  });

  it("hiç ulaşılabilir aday yoksa mevcut karar hatası korunur", () => {
    const base = createGame(56);
    const board = createEmptyBoard();
    for (let column = 0; column < 10; column++) {
      board[0][column] = "O";
      board[1][column] = "O";
    }
    const blocked: GameState = {
      ...base,
      board,
      current: { type: "O", rotation: 0, x: 4, y: 0 },
      next: ["I", "T", "L"],
    };
    expect(() => decide(blocked)).toThrow("Ulaşılabilir aday hamle yok");
  });

  it("en yüksek puanlı adayı seçer", () => {
    const state = createGame(31);
    const decision = decide(state);
    const reachable = decision.record.candidates.filter(
      (c) => c.reachable && c.score !== null,
    );
    const best = reachable.reduce((a, b) => ((b.score as number) > (a.score as number) ? b : a));
    expect(decision.record.selectedId).toBe(best.id);
    for (const candidate of reachable) {
      expect(candidate.score as number).toBeLessThanOrEqual(
        best.score as number,
      );
    }
  });

  it("seçilen adayın planı motorla uygulandığında simülasyonla aynı sonucu verir", () => {
    for (const seed of [41, 42, 43, 44, 45]) {
      let state = createGame(seed);
      for (let piece = 0; piece < 8; piece++) {
        const decision = decide(state);
        const result = executePlan(state, decision.plan);
        expect(result.fingerprint).toBe(decision.expectedBoardFingerprint);
        expect(result.linesCleared).toBe(decision.expectedLines);
        expect(result.completed).toBe(true);
        state = result.state;
        if (state.over) break;
      }
    }
  });

  it("eşit puanlar deterministik eşitlik bozma kuralıyla çözülür", () => {
    // Boş tahtada I parçasının 4 döndürmesi de benzer puan alabilir;
    // eşitlikte önce küçük döndürme, sonra küçük sütun seçilmelidir.
    const state = createGame(51);
    const iState: GameState = {
      ...state,
      board: createEmptyBoard(),
      current: { type: "I", rotation: 0, x: 3, y: 0 },
    };
    const decision = decide(iState);
    const selected = decision.record.candidates.find(
      (c) => c.id === decision.record.selectedId,
    );
    expect(selected).toBeDefined();
    // Boş tahtada tüm I adaylarının puanı eşittir → en küçük rotation, sütun
    const selectedScore = scoreCandidate(
      selected!.metrics!,
      DEFAULT_WEIGHTS,
    ).score;
    const equalScoreCandidates = decision.record.candidates.filter(
      (c) =>
        c.reachable &&
        c.metrics !== null &&
        scoreCandidate(c.metrics, DEFAULT_WEIGHTS).score === selectedScore,
    );
    if (equalScoreCandidates.length > 1) {
      const expected = [...equalScoreCandidates].sort(
        (a, b) => a.rotation - b.rotation || a.column - b.column,
      )[0];
      expect(decision.record.selectedId).toBe(expected.id);
    }
  });

  it("karar alma orijinal durumu değiştirmez", () => {
    const state = createGame(52);
    const before = JSON.stringify(state);
    decide(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("karar kaydı tüm zorunlu alanları taşır", () => {
    const state = createGame(53);
    const decision = decide(state, { nextRecordId: 7 });
    const record = decision.record;
    expect(record.id).toBe(7);
    expect(record.pieceType).toBe(state.current.type);
    expect(record.pieceIndex).toBe(state.pieces);
    expect(record.weights).toEqual(DEFAULT_WEIGHTS);
    expect(record.candidates.length).toBeGreaterThan(0);
    expect(record.selectedId).not.toBeNull();
    expect(record.reasoning).toContain("parçası");
    expect(record.reasoning).toContain("en yüksek toplam puan");
    expect(record.applied).toBe(false);
    expect(record.verification).toBeNull();
    expect(record.mode).toBe("agent");
  });

  it("oyun bittiyse karar alınamaz ve hata gizlenmez", () => {
    const state = createGame(54);
    const overState: GameState = { ...state, over: true };
    expect(() => decide(overState)).toThrow();
  });

  it("özel ağırlıklar karar değiştirir (ağırlıklar kayda yazılır)", () => {
    const state = createGame(55);
    const decision = decide(state, {
      weights: {
        linesCleared: 10,
        holes: -1,
        aggregateHeight: -0.1,
        maxHeight: -0.1,
        bumpiness: -0.1,
      },
    });
    expect(decision.record.weights.linesCleared).toBe(10);
  });
});
