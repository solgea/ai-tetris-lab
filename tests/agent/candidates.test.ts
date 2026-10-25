import { describe, expect, it } from "vitest";
import {
  applyMove,
  boardFingerprint,
  createEmptyBoard,
  createGame,
  type GameState,
} from "../../src/engine";
import { generateCandidates } from "../../src/agent/candidates";
import { executePlan } from "../../src/agent/runner";

describe("aday üretici", () => {
  it("tüm adaylar (döndürme × sütun) için kayıt üretir", () => {
    const state = createGame(11);
    const candidates = generateCandidates(state);
    expect(candidates.length).toBe(40); // 4 döndürme × 10 sütun
    const ids = new Set(candidates.map((c) => c.id));
    expect(ids.size).toBe(40);
  });

  it("aday üretimi deterministiktir", () => {
    const state = createGame(12);
    const a = JSON.stringify(generateCandidates(state));
    const b = JSON.stringify(generateCandidates(state));
    expect(a).toBe(b);
  });

  it("T parçası boş tahtada ulaşılabilir sütunlarda aday üretir", () => {
    const state = createGame(13);
    const tState: GameState = {
      ...state,
      current: { type: "T", rotation: 0, x: 3, y: 0 },
    };
    const candidates = generateCandidates(tState);
    const reachable = candidates.filter((c) => c.reachable);
    // T: rotation 0,1,2 için sütun 0..7; rotation 3 (hücreler 0-1. sütunlarda)
    // sütun 8'e de ulaşabilir → 8+8+8+9 = 33 ulaşılabilir aday
    expect(reachable.length).toBe(33);
    for (const candidate of reachable) {
      expect(candidate.plan[candidate.plan.length - 1]).toBe("hardDrop");
      expect(candidate.landingY).not.toBeNull();
      expect(candidate.simulatedBoard).not.toBeNull();
      expect(candidate.metrics).not.toBeNull();
      expect(candidate.willTopOut).not.toBeNull();
    }
    const unreachable = candidates.filter((c) => !c.reachable);
    for (const candidate of unreachable) {
      expect(candidate.reason.length).toBeGreaterThan(0);
      expect(candidate.score).toBeNull();
      expect(candidate.willTopOut).toBeNull();
    }
  });

  it("her ulaşılabilir adayın planı motorla simülasyonla aynı sonucu verir", () => {
    for (const seed of [21, 22, 23]) {
      const state = createGame(seed);
      const candidates = generateCandidates(state);
      for (const candidate of candidates) {
        if (!candidate.reachable) continue;
        const result = executePlan(state, candidate.plan);
        expect(result.fingerprint).toBe(
          boardFingerprint(candidate.simulatedBoard!),
        );
        expect(result.linesCleared).toBe(candidate.metrics!.linesCleared);
        expect(result.completed).toBe(true);
      }
    }
  });

  it("willTopOut tahmini gerçek motor yürütmesiyle birebir eşleşir", () => {
    for (const seed of [21, 22, 23]) {
      const state = createGame(seed);
      const candidates = generateCandidates(state);
      for (const candidate of candidates) {
        if (!candidate.reachable) continue;
        const result = executePlan(state, candidate.plan);
        expect(result.state.over).toBe(candidate.willTopOut);
      }
    }
  });

  it("kayma yolu kapalı adaylar ulaşılamaz olarak işaretlenir", () => {
    const state = createGame(14);
    const board = createEmptyBoard();
    board[1][0] = "O"; // T'nin sol sütununa iniş yolu kapalı
    const prepared: GameState = {
      ...state,
      board,
      current: { type: "T", rotation: 0, x: 3, y: 0 },
    };
    const candidates = generateCandidates(prepared);
    // rotasyon 0, 2 ve 3 sütun 0'ı kullanır → ulaşılamaz; rotasyon 1 kullanmaz
    const rot0Col0 = candidates.find((c) => c.id === "0:0");
    const rot1Col0 = candidates.find((c) => c.id === "1:0");
    const rot2Col0 = candidates.find((c) => c.id === "2:0");
    expect(rot0Col0?.reachable).toBe(false);
    expect(rot2Col0?.reachable).toBe(false);
    expect(rot1Col0?.reachable).toBe(true);
  });

  it("simülasyon orijinal durumu değiştirmez", () => {
    const state = createGame(15);
    const before = JSON.stringify(state);
    generateCandidates(state);
    applyMove(state, "hardDrop"); // motorsal işlem bile state değiştirmez (saf)
    expect(JSON.stringify(state)).toBe(before);
  });

  it("satır temizleyecek aday doğru satır sayısı raporlar", () => {
    const state = createGame(16);
    const board = createEmptyBoard();
    for (let c = 0; c < 10; c++) {
      if (c < 3 || c > 6) board[19][c] = "J";
    }
    const prepared: GameState = {
      ...state,
      board,
      current: { type: "I", rotation: 0, x: 3, y: 0 },
    };
    const candidates = generateCandidates(prepared);
    const target = candidates.find((c) => c.id === "0:3");
    expect(target?.reachable).toBe(true);
    expect(target?.metrics?.linesCleared).toBe(1);
  });
});
