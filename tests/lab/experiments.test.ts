import { describe, expect, it } from "vitest";
import {
  runExperiment,
  summarize,
  qActionKeysFor,
  qStateKeyFor,
} from "../../src/lab/experiments";
import type { GameResult } from "../../src/lab/experiments";
import { createGame } from "../../src/engine";

function result(score: number, lines: number, ended: "gameOver" | "stepLimit" = "gameOver"): GameResult {
  return { seed: 1, score, lines, pieces: 10, durationMs: 5, ended };
}

describe("deney özeti", () => {
  it("veri yoksa özet null'dır", () => {
    expect(summarize([])).toBeNull();
  });

  it("ortalama, medyan, min ve maks doğru hesaplanır", () => {
    const summary = summarize([result(10, 1), result(20, 2), result(30, 3)]);
    expect(summary).not.toBeNull();
    expect(summary!.meanScore).toBeCloseTo(20, 10);
    expect(summary!.medianScore).toBe(20);
    expect(summary!.minScore).toBe(10);
    expect(summary!.maxScore).toBe(30);
    expect(summary!.meanLines).toBeCloseTo(2, 10);
    expect(summary!.gameOverRate).toBe(1);
  });

  it("çift sayıda oyunda medyan iki orta değerin ortalamasıdır", () => {
    const summary = summarize([result(10, 1), result(20, 2)]);
    expect(summary!.medianScore).toBe(15);
  });

  it("satır dağılımı kayıtlı ölçümlerden üretilir", () => {
    const summary = summarize([
      result(1, 0),
      result(2, 0),
      result(3, 2),
      result(4, 2, "stepLimit"),
    ]);
    expect(summary!.lineDistribution).toEqual([
      { lines: 0, count: 2 },
      { lines: 2, count: 2 },
    ]);
    expect(summary!.gameOverRate).toBe(0.75);
  });
});

describe("deney çalıştırıcı", () => {
  it("kural ajanıyla aynı tohum dizisi tekrarlanabilir sonuç üretir", async () => {
    const config = {
      id: "t1",
      name: "tekrar",
      agentKind: "rule" as const,
      games: 2,
      baseSeed: 777,
      stepLimit: 25,
      qEpisodesTrained: null,
      appVersion: "0.1.0",
    };
    const a = await runExperiment({ config, shouldStop: () => false });
    const b = await runExperiment({ config, shouldStop: () => false });
    expect(a.status).toBe("completed");
    expect(a.results.map((r) => r.score)).toEqual(b.results.map((r) => r.score));
    expect(a.results.map((r) => r.seed)).toEqual([777, 778]);
    expect(a.summary).not.toBeNull();
    expect(a.finishedAt).not.toBeNull();
  });

  it("durdurulan deney 'stopped' işaretlenir ve boş özet 'veri yok' anlamı taşır", async () => {
    const record = await runExperiment({
      config: {
        id: "t2",
        name: "durdurulan",
        agentKind: "rule",
        games: 10,
        baseSeed: 1,
        stepLimit: 20,
        qEpisodesTrained: null,
        appVersion: "0.1.0",
      },
      shouldStop: () => true,
    });
    expect(record.status).toBe("stopped");
    expect(record.results.length).toBe(0);
    expect(record.summary).toBeNull();
  });

  it("Q tablosu olmadan qlearn deneyi açık hata verir, sessizce geçmez", async () => {
    const record = await runExperiment({
      config: {
        id: "t3",
        name: "hatasız-q",
        agentKind: "qlearn",
        games: 2,
        baseSeed: 1,
        stepLimit: 20,
        qEpisodesTrained: 0,
        appVersion: "0.1.0",
      },
      shouldStop: () => false,
    });
    expect(record.status).toBe("error");
    expect(record.errorMessage).toContain("Q tablosu");
  });

  it("Q tablosuyla qlearn deneyi tamamlanır", async () => {
    const { QAgent } = await import("../../src/qlearning/qagent");
    const agent = new QAgent();
    agent.update("tohum", "d", 1, null, []);
    const record = await runExperiment({
      config: {
        id: "t4",
        name: "q-deney",
        agentKind: "qlearn",
        games: 1,
        baseSeed: 5,
        stepLimit: 15,
        qEpisodesTrained: 0,
        appVersion: "0.1.0",
      },
      qAgent: agent,
      shouldStop: () => false,
    });
    expect(record.status).toBe("completed");
    expect(record.results.length).toBe(1);
  });

  it("aday anahtar yardımcıları deterministiktir", () => {
    const state = createGame(313);
    const keysA = qActionKeysFor(state);
    const keysB = qActionKeysFor(state);
    expect(keysA).toEqual(keysB);
    expect(keysA.every((k) => /^\d:\d+$/.test(k))).toBe(true);
    expect(qStateKeyFor(state)).toContain("state-v1");
  });
});
