import { describe, expect, it } from "vitest";
import { QAgent, QTABLE_VERSION, QTableError } from "../../src/qlearning/qagent";
import { FEATURE_VERSION } from "../../src/qlearning/features";

describe("Q değerleri güncellemesi", () => {
  it("Q(s,a) += α(r + γ·maxQ(s') − Q(s,a)) formülünü uygular", () => {
    const agent = new QAgent();
    agent.alpha = 0.5;
    agent.gamma = 0.9;
    agent.update("s1", "a", 10, null, []); // Q(s1,a) = 5
    agent.update("s2", "b", 2, null, []); // Q(s2,b) = 1
    const updated = agent.update("s1", "a", 10, "s2", ["b"]);
    // Q = 5 + 0.5 × (10 + 0.9×1 − 5) = 5 + 0.5 × 5.9 = 7.95
    expect(updated).toBeCloseTo(7.95, 10);
    expect(agent.getQ("s1", "a")).toBeCloseTo(7.95, 10);
  });

  it("terminal durumda gelecek terimi yoktur", () => {
    const agent = new QAgent();
    agent.alpha = 0.5;
    const updated = agent.update("s", "a", 10, null, []);
    expect(updated).toBeCloseTo(5, 10);
  });

  it("bilinmeyen durum-eylem Q değeri 0'dır", () => {
    const agent = new QAgent();
    expect(agent.getQ("x", "y")).toBe(0);
  });

  it("maxQ boş eylem listesinde 0 döner", () => {
    const agent = new QAgent();
    expect(agent.maxQ("s", [])).toBe(0);
  });
});

describe("keşif ve değerlendirme modlarının ayrılması", () => {
  it("eval modu asla rastgele keşif yapmaz", () => {
    const agent = new QAgent();
    agent.update("s", "best", 5, null, []);
    for (let i = 0; i < 50; i++) {
      const result = agent.selectAction("s", ["best", "other"], {
        mode: "eval",
        epsilon: 1, // eval modunda epsilon yok sayılır
        rngState: i,
      });
      expect(result.actionKey).toBe("best");
      expect(result.explored).toBe(false);
    }
  });

  it("train modunda epsilon=0 olduğunda en iyi eylem seçilir", () => {
    const agent = new QAgent();
    agent.update("s", "best", 5, null, []);
    const result = agent.selectAction("s", ["best", "other"], {
      mode: "train",
      epsilon: 0,
      rngState: 42,
    });
    expect(result.actionKey).toBe("best");
    expect(result.explored).toBe(false);
  });

  it("train modunda epsilon=1 olduğunda her zaman keşif yapılır ve tohum tekrarlanabilirdir", () => {
    const agent = new QAgent();
    agent.update("s", "best", 5, null, []);
    const a = agent.selectAction("s", ["best", "other"], {
      mode: "train",
      epsilon: 1,
      rngState: 42,
    });
    const b = agent.selectAction("s", ["best", "other"], {
      mode: "train",
      epsilon: 1,
      rngState: 42,
    });
    expect(a.explored).toBe(true);
    expect(a.actionKey).toBe(b.actionKey);
    expect(a.rngState).toBe(b.rngState);
  });

  it("boş eylem listesi hatayı gizlemez", () => {
    const agent = new QAgent();
    expect(() =>
      agent.selectAction("s", [], { mode: "eval", epsilon: 0, rngState: 1 }),
    ).toThrow();
  });
});

describe("Q tablosu kaydetme ve yükleme", () => {
  it("roundtrip: kaydet → yükle aynı değerleri üretir", () => {
    const agent = new QAgent();
    agent.alpha = 0.3;
    agent.gamma = 0.8;
    agent.update("s1", "a", 5, null, []);
    agent.update("s1", "b", 3, null, []);
    agent.update("s2", "a", -2, null, []);
    agent.markEpisode();
    const data = agent.toData();
    const json = JSON.parse(JSON.stringify(data));
    const restored = QAgent.fromData(json);
    expect(restored.getQ("s1", "a")).toBe(agent.getQ("s1", "a"));
    expect(restored.getQ("s1", "b")).toBe(agent.getQ("s1", "b"));
    expect(restored.getQ("s2", "a")).toBe(agent.getQ("s2", "a"));
    expect(restored.alpha).toBe(0.3);
    expect(restored.gamma).toBe(0.8);
    expect(restored.episodesTrained).toBe(1);
    expect(restored.stateCount).toBe(agent.stateCount);
    expect(restored.pairCount).toBe(agent.pairCount);
  });

  it("null / ilkel değerler güvenle reddedilir", () => {
    expect(() => QAgent.fromData(null)).toThrow(QTableError);
    expect(() => QAgent.fromData(42)).toThrow(QTableError);
    expect(() => QAgent.fromData("veri")).toThrow(QTableError);
  });

  it("yanlış sürüm reddedilir", () => {
    expect(() =>
      QAgent.fromData({
        version: QTABLE_VERSION + 1,
        featureVersion: FEATURE_VERSION,
        alpha: 0.2,
        gamma: 0.9,
        entries: {},
      }),
    ).toThrow(/sürüm/);
  });

  it("yanlış özellik sürümü reddedilir", () => {
    expect(() =>
      QAgent.fromData({
        version: QTABLE_VERSION,
        featureVersion: "state-v999",
        alpha: 0.2,
        gamma: 0.9,
        entries: {},
      }),
    ).toThrow(/özellik sürümü/);
  });

  it("geçersiz alpha/gamma reddedilir", () => {
    expect(() =>
      QAgent.fromData({
        version: QTABLE_VERSION,
        featureVersion: FEATURE_VERSION,
        alpha: 1.5,
        gamma: 0.9,
        entries: {},
      }),
    ).toThrow(/alpha/);
    expect(() =>
      QAgent.fromData({
        version: QTABLE_VERSION,
        featureVersion: FEATURE_VERSION,
        alpha: 0.2,
        gamma: "yüksek",
        entries: {},
      }),
    ).toThrow(/gamma/);
  });

  it("NaN Q değerleri reddedilir", () => {
    expect(() =>
      QAgent.fromData({
        version: QTABLE_VERSION,
        featureVersion: FEATURE_VERSION,
        alpha: 0.2,
        gamma: 0.9,
        entries: { s: { a: Number.NaN } },
      }),
    ).toThrow(/sonlu bir sayı/);
  });

  it("hata mesajları kullanıcıya açık biçimde 'QTable' içerir", () => {
    try {
      QAgent.fromData(null);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(QTableError);
      expect((error as Error).message).toContain("QTable");
    }
  });
});
