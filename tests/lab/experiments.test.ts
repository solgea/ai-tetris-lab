import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runExperiment,
  summarize,
  qActionKeysFor,
  qStateKeyFor,
} from "../../src/lab/experiments";
import type { ExperimentConfig, GameResult } from "../../src/lab/experiments";
import * as ruleAgent from "../../src/agent/ruleAgent";
import * as runner from "../../src/agent/runner";
import { createGame } from "../../src/engine";

afterEach(() => {
  vi.restoreAllMocks();
});

function ruleConfig(overrides: Partial<ExperimentConfig> = {}): ExperimentConfig {
  return {
    id: "v-test",
    name: "doğrulama deneyi",
    agentKind: "rule",
    games: 1,
    baseSeed: 777,
    stepLimit: 25,
    qEpisodesTrained: null,
    appVersion: "0.1.0",
    ...overrides,
  };
}

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

  it("Q tablosuyla qlearn deneyi tamamlanır ve doğrulama uygulanmadığı açıkça görünür", async () => {
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
    // Hiç doğrulama yapılmadı — 0 değeri "temiz" değil "denetlenmedi" demek
    expect(record.verificationsPerformed).toBe(0);
    expect(record.verificationErrors).toBe(0);
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

describe("deney doğrulaması (D1)", () => {
  it("normal kural deneyinde her hamle doğrulanır ve temiz geçiş sayaçlarla kanıtlanır", async () => {
    const record = await runExperiment({
      config: ruleConfig({ games: 2, stepLimit: 25 }),
      shouldStop: () => false,
    });
    expect(record.status).toBe("completed");
    // doğrulama GERÇEKLEŞTİ: sayaç sıfır değil
    expect(record.verificationsPerformed).toBeGreaterThan(0);
    expect(record.verificationErrors).toBe(0);
    // parça başına en fazla bir denetim yapılır
    const totalPieces = record.results.reduce((sum, r) => sum + r.pieces, 0);
    expect(record.verificationsPerformed).toBeLessThanOrEqual(totalPieces);
    expect(record.errorMessage).toBeNull();
  });

  it("kaçınılmaz top-out doğrulama hatası sayılmaz ve ayrı metriğe yazılır", async () => {
    const record = await runExperiment({
      config: ruleConfig({ baseSeed: 9, stepLimit: 100 }),
      shouldStop: () => false,
    });
    expect(record.status).toBe("completed");
    expect(record.results[0].ended).toBe("gameOver");
    expect(record.verificationsPerformed).toBeGreaterThan(0);
    expect(record.verificationErrors).toBe(0);
    expect(record.avoidableTopOuts).toBe(0);
    expect(record.unavoidableTopOuts).toBe(1);
    expect(record.errorMessage).toBeNull();
  });

  it("güvenli aday varken seçilen top-out önlenebilir sayılır ve diğer sayaçlardan ayrılır", async () => {
    const original = ruleAgent.decide;
    let injected = 0;
    vi.spyOn(ruleAgent, "decide").mockImplementation((state, options) => {
      const decision = original(state, options);
      const selected = decision.record.candidates.find(
        (candidate) => candidate.id === decision.record.selectedId,
      );
      if (decision.expectedOver && selected !== undefined) {
        // Yalnızca test enjeksiyonu: seçilen top-out planı ve yürütme aynı
        // kalır; laboratuvar sınıflandırıcısına güvenli bir aday görünür kılınır.
        decision.record.candidates.push({
          ...selected,
          id: "test-safe-candidate",
          willTopOut: false,
        });
        injected += 1;
      }
      return decision;
    });

    const record = await runExperiment({
      config: ruleConfig({ games: 1, baseSeed: 9, stepLimit: 100 }),
      shouldStop: () => false,
    });

    expect(injected).toBe(1);
    expect(record.results[0].ended).toBe("gameOver");
    expect(record.verificationsPerformed).toBeGreaterThan(0);
    expect(record.avoidableTopOuts).toBe(1);
    expect(record.unavoidableTopOuts).toBe(0);
    expect(record.verificationErrors).toBe(0);
    expect(record.status).toBe("completed");
  });

  it("simülasyon-motor uyuşmazlığı algılanır, sayılır ve deney başarılı gibi gösterilmez", async () => {
    const original = runner.executePlan;
    const spy = vi
      .spyOn(runner, "executePlan")
      .mockImplementation((state, plan) => {
        const result = original(state, plan);
        // Parmak izini bilinçli boz: doğrulama uyuşmazlığı üret
        const corrupted = result.fingerprint.endsWith(".")
          ? `${result.fingerprint.slice(0, -1)}X`
          : `${result.fingerprint}X`;
        return { ...result, fingerprint: corrupted };
      });
    const record = await runExperiment({
      config: ruleConfig({ games: 1, stepLimit: 25 }),
      shouldStop: () => false,
    });
    expect(spy).toHaveBeenCalled();
    expect(record.verificationsPerformed).toBeGreaterThan(0);
    // her denetlenen hamle uyuşmazlık sayıldı
    expect(record.verificationErrors).toBe(record.verificationsPerformed);
    // başarılı deney gibi GÖSTERİLMEZ
    expect(record.status).toBe("completedWithErrors");
    expect(record.errorMessage).toContain("uyuşmaz");
    // ölçümler yine de gerçek motor sonuçlarını taşır
    expect(record.results.length).toBe(1);
    expect(record.summary).not.toBeNull();
  });

  it("durdurulan deneyde uyuşmazlık olsa da 'stopped' semantiği korunur", async () => {
    const original = runner.executePlan;
    vi.spyOn(runner, "executePlan").mockImplementation((state, plan) => {
      const result = original(state, plan);
      return {
        ...result,
        fingerprint: `${result.fingerprint.slice(0, -1)}X`,
      };
    });
    const record = await runExperiment({
      config: ruleConfig({ games: 5, stepLimit: 25 }),
      shouldStop: () => true, // ilk oyunda hemen dur
    });
    expect(record.status).toBe("stopped");
    expect(record.results.length).toBe(0);
    expect(record.verificationsPerformed).toBe(0);
    expect(record.verificationErrors).toBe(0);
  });
});
