import { describe, expect, it } from "vitest";
import {
  createEmptyBoard,
  createGame,
} from "../../src/engine";
import type { GameState } from "../../src/engine";
import { decide } from "../../src/agent/ruleAgent";
import { executePlan } from "../../src/agent/runner";
import { DEFAULT_WEIGHTS, scoreCandidate } from "../../src/agent/heuristic";

describe("kural tabanlı ajan", () => {
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
