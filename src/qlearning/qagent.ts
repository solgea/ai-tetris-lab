import { nextRandom } from "../engine/rng";
import { FEATURE_VERSION } from "./features";

/**
 * Q-learning ajanı — kural tabanlı ajandan tamamen bağımsızdır.
 * Q tablosu seyrek (sparse) Map olarak tutulur; yalnızca ziyaret edilen
 * durum-eylem çiftleri bellek kaplar. Durum uzayı ve bellek kullanımı
 * ölçülebilir (stateCount, pairCount).
 */

export const QTABLE_VERSION = 2;

export class QTableError extends Error {
  constructor(message: string) {
    super(`QTable doğrulama hatası: ${message}`);
    this.name = "QTableError";
  }
}

export interface QTableData {
  version: number;
  featureVersion: string;
  alpha: number;
  gamma: number;
  /** { durumAnahtarı: { eylemAnahtarı: QDeğeri } } */
  entries: Record<string, Record<string, number>>;
  stats?: {
    episodesTrained: number;
    totalSteps: number;
  };
}

export type ExplorationMode = "train" | "eval";

export interface SelectActionOptions {
  mode: ExplorationMode;
  epsilon: number;
  /** Seeded RNG durumu — tekrarlanabilir keşif için */
  rngState: number;
}

export interface SelectActionResult {
  actionKey: string;
  rngState: number;
  /** Keşif (rastgele) seçildi mi? */
  explored: boolean;
}

export class QAgent {
  private q = new Map<string, Map<string, number>>();
  alpha = 0.2;
  gamma = 0.9;
  episodesTrained = 0;
  totalSteps = 0;

  constructor() {}

  getQ(stateKey: string, actionKey: string): number {
    return this.q.get(stateKey)?.get(actionKey) ?? 0;
  }

  /** Aksiyonları deterministik sırayla değerlendirir; eşitlikte ilkini seçer. */
  bestAction(stateKey: string, actionKeys: readonly string[]): string {
    if (actionKeys.length === 0) {
      throw new Error("bestAction: boş eylem listesi");
    }
    let best = actionKeys[0];
    let bestValue = this.getQ(stateKey, best);
    for (let i = 1; i < actionKeys.length; i++) {
      const value = this.getQ(stateKey, actionKeys[i]);
      if (value > bestValue) {
        best = actionKeys[i];
        bestValue = value;
      }
    }
    return best;
  }

  /**
   * Epsilon-greedy eylem seçimi.
   * "eval" modunda asla rastgele keşif yapılmaz; yalnızca en iyi eylem.
   * "train" modunda epsilon olasılığıyla (seeded RNG) keşif yapılır.
   */
  selectAction(
    stateKey: string,
    actionKeys: readonly string[],
    options: SelectActionOptions,
  ): SelectActionResult {
    if (actionKeys.length === 0) {
      throw new Error("selectAction: boş eylem listesi");
    }
    const best = this.bestAction(stateKey, actionKeys);
    if (options.mode === "eval" || options.epsilon <= 0) {
      return { actionKey: best, rngState: options.rngState, explored: false };
    }
    const roll = nextRandom(options.rngState);
    if (roll.value >= options.epsilon) {
      return {
        actionKey: best,
        rngState: roll.state,
        explored: false,
      };
    }
    const roll2 = nextRandom(roll.state);
    const index = Math.floor(roll2.value * actionKeys.length);
    return {
      actionKey: actionKeys[index],
      rngState: roll2.state,
      explored: true,
    };
  }

  /**
   * Q-learning güncellemesi: Q(s,a) += α(r + γ·maxQ(s',·) − Q(s,a)).
   * terminal=true ise gelecek terimi yoktur: Q(s,a) += α(r − Q(s,a)).
   * Yeni Q değeri döner.
   */
  update(
    stateKey: string,
    actionKey: string,
    reward: number,
    nextStateKey: string | null,
    nextActionKeys: readonly string[],
  ): number {
    const current = this.getQ(stateKey, actionKey);
    const target =
      nextStateKey === null
        ? reward
        : reward +
          this.gamma * this.maxQ(nextStateKey, nextActionKeys);
    const updated = current + this.alpha * (target - current);
    let row = this.q.get(stateKey);
    if (row === undefined) {
      row = new Map();
      this.q.set(stateKey, row);
    }
    row.set(actionKey, updated);
    this.totalSteps += 1;
    return updated;
  }

  maxQ(stateKey: string, actionKeys: readonly string[]): number {
    if (actionKeys.length === 0) return 0;
    let best = this.getQ(stateKey, actionKeys[0]);
    for (let i = 1; i < actionKeys.length; i++) {
      const value = this.getQ(stateKey, actionKeys[i]);
      if (value > best) best = value;
    }
    return best;
  }

  /** Ziyaret edilen durum sayısı. */
  get stateCount(): number {
    return this.q.size;
  }

  /** Ziyaret edilen durum-eylem çifti sayısı (bellek kullanımı ölçümü). */
  get pairCount(): number {
    let count = 0;
    for (const row of this.q.values()) count += row.size;
    return count;
  }

  markEpisode(): void {
    this.episodesTrained += 1;
  }

  /** Sürümlü ve doğrulanabilir serileştirme. */
  toData(): QTableData {
    const entries: Record<string, Record<string, number>> = {};
    for (const [stateKey, row] of this.q) {
      entries[stateKey] = {};
      for (const [actionKey, value] of row) {
        entries[stateKey][actionKey] = value;
      }
    }
    return {
      version: QTABLE_VERSION,
      featureVersion: FEATURE_VERSION,
      alpha: this.alpha,
      gamma: this.gamma,
      entries,
      stats: { episodesTrained: this.episodesTrained, totalSteps: this.totalSteps },
    };
  }

  static fromData(data: unknown): QAgent {
    if (typeof data !== "object" || data === null) {
      throw new QTableError("dosya içeriği bir nesne olmalı");
    }
    const record = data as Record<string, unknown>;
    if (record.version !== QTABLE_VERSION) {
      throw new QTableError(
        `desteklenmeyen sürüm: beklenen ${QTABLE_VERSION}, bulunan ${String(record.version)}`,
      );
    }
    if (record.featureVersion !== FEATURE_VERSION) {
      throw new QTableError(
        `durum özellik sürümü uyuşmuyor: beklenen ${FEATURE_VERSION}, bulunan ${String(record.featureVersion)}`,
      );
    }
    const alpha = record.alpha;
    const gamma = record.gamma;
    if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
      throw new QTableError("alpha 0 ile 1 arasında sonlu bir sayı olmalı");
    }
    if (typeof gamma !== "number" || !Number.isFinite(gamma) || gamma <= 0 || gamma > 1) {
      throw new QTableError("gamma 0 ile 1 arasında sonlu bir sayı olmalı");
    }
    const rawEntries = record.entries;
    if (typeof rawEntries !== "object" || rawEntries === null) {
      throw new QTableError("entries alanı bir nesne olmalı");
    }
    const agent = new QAgent();
    agent.alpha = alpha;
    agent.gamma = gamma;
    const stats = record.stats;
    if (
      typeof stats === "object" &&
      stats !== null &&
      typeof (stats as Record<string, unknown>).episodesTrained === "number" &&
      typeof (stats as Record<string, unknown>).totalSteps === "number"
    ) {
      agent.episodesTrained = (stats as Record<string, number>).episodesTrained;
      agent.totalSteps = (stats as Record<string, number>).totalSteps;
    }
    for (const [stateKey, rawRow] of Object.entries(rawEntries)) {
      if (typeof rawRow !== "object" || rawRow === null) {
        throw new QTableError(`"${stateKey}" durumu için eylemler nesne olmalı`);
      }
      for (const [actionKey, rawValue] of Object.entries(rawRow)) {
        if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
          throw new QTableError(
            `"${stateKey}" / "${actionKey}" Q değeri sonlu bir sayı olmalı`,
          );
        }
        let row = agent.q.get(stateKey);
        if (row === undefined) {
          row = new Map();
          agent.q.set(stateKey, row);
        }
        row.set(actionKey, rawValue);
      }
    }
    return agent;
  }
}
