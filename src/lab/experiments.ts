import { generateCandidates } from "../agent/candidates";
import { DEFAULT_WEIGHTS } from "../agent/heuristic";
import { decide } from "../agent/ruleAgent";
import { executePlan, verifyExecution } from "../agent/runner";
import type { Weights } from "../agent/types";
import { createGame } from "../engine";
import type { GameState } from "../engine";
import { playEvalGame, stateKey, actionKey } from "../qlearning";
import type { QAgent } from "../qlearning";

/**
 * Deney ve karşılaştırma laboratuvarı.
 * Aynı seed ile farklı ajanları çoklu oyunla karşılaştırır; tüm grafikler
 * yalnızca burada kaydedilen gerçek ölçümlerden üretilir. Veri yoksa
 * özet alanları null'dır ve arayüz "veri yok" göstermek zorundadır.
 */

export const APP_VERSION = "0.1.0";

export type AgentKind = "rule" | "qlearn";

export interface ExperimentConfig {
  id: string;
  name: string;
  agentKind: AgentKind;
  games: number;
  baseSeed: number;
  stepLimit: number;
  /** qlearn deneyinde kullanılan Q tablosunun eğitim sayısı (izlenebilirlik) */
  qEpisodesTrained: number | null;
  appVersion: string;
}

export interface GameResult {
  seed: number;
  score: number;
  lines: number;
  pieces: number;
  durationMs: number;
  ended: "gameOver" | "stepLimit";
}

/**
 * Deney durumu:
 * - "completed": tamamlandı ve kural ajanı doğrulamaları temiz geçti
 * - "completedWithErrors": tamamlandı AMA simülasyon-motor uyuşmazlığı var;
 *   başarılı deney gibi gösterilmez
 * - "stopped": kullanıcı tarafından durduruldu (kısmi veri)
 * - "error": beklenmeyen istisna (ör. karar alınamadı)
 */
export type ExperimentStatus =
  | "completed"
  | "completedWithErrors"
  | "stopped"
  | "error";

export interface LineDistributionBin {
  lines: number;
  count: number;
}

export interface ExperimentSummary {
  gameCount: number;
  meanScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  meanLines: number;
  medianLines: number;
  lineDistribution: LineDistributionBin[];
  meanDurationMs: number;
  gameOverRate: number;
}

export interface ExperimentRecord {
  config: ExperimentConfig;
  results: GameResult[];
  status: ExperimentStatus;
  errorMessage: string | null;
  startedAt: number;
  finishedAt: number | null;
  /** Simülasyon-motor uyuşmazlığı sayısı (yalnızca gerçek hatalar) */
  verificationErrors: number;
  /**
   * Gerçekleşen simülasyon-motor doğrulama sayısı.
   * 0 değeri "doğrulandı ve temiz" DEĞİL "hiç denetlenmedi" anlamına gelir;
   * qlearn deneylerinde doğrulama uygulanmaz.
   */
  verificationsPerformed: number;
  /**
   * Güvenli bir ulaşılabilir aday varken top-out seçilen karar sayısı.
   * Sağlıklı ajan için 0 olmalıdır; karar kalitesini doğrulamadan ayırır.
   */
  avoidableTopOuts: number;
  /**
   * Tüm ulaşılabilir adaylar top-out olduğu için kaçınılmaz olarak
   * seçilen top-out kararı sayısı. Doğrulama hatası değildir.
   */
  unavoidableTopOuts: number;
  summary: ExperimentSummary | null;
}

export function summarize(results: readonly GameResult[]): ExperimentSummary | null {
  if (results.length === 0) return null;
  const scores = results.map((r) => r.score);
  const lines = results.map((r) => r.lines);
  const durations = results.map((r) => r.durationMs);
  const distribution = new Map<number, number>();
  for (const result of results) {
    distribution.set(result.lines, (distribution.get(result.lines) ?? 0) + 1);
  }
  const lineDistribution = [...distribution.entries()]
    .map(([line, count]) => ({ lines: line, count }))
    .sort((a, b) => a.lines - b.lines);
  return {
    gameCount: results.length,
    meanScore: mean(scores),
    medianScore: median(scores),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    meanLines: mean(lines),
    medianLines: median(lines),
    lineDistribution,
    meanDurationMs: mean(durations),
    gameOverRate: results.filter((r) => r.ended === "gameOver").length / results.length,
  };
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface ExperimentRunnerOptions {
  config: ExperimentConfig;
  /** Kural ajanı ağırlıkları (yalnızca rule için) */
  weights?: Weights;
  qAgent?: QAgent;
  /** true dönerse deney durdurulur */
  shouldStop: () => boolean;
  /** Her oyun bittiğinde çağrılır (canlı ilerleme için) */
  onProgress?: (results: GameResult[]) => void;
  /** Tarayıcıya kontrol verme sıklığı: her N oyunda bir */
  yieldEvery?: number;
}

/** Tek bir deneyi çalıştırır; durdurulursa "stopped" işaretli kayıt döner. */
export async function runExperiment(
  options: ExperimentRunnerOptions,
): Promise<ExperimentRecord> {
  const { config } = options;
  const record: ExperimentRecord = {
    config,
    results: [],
    status: "completed",
    errorMessage: null,
    startedAt: Date.now(),
    finishedAt: null,
    verificationErrors: 0,
    verificationsPerformed: 0,
    avoidableTopOuts: 0,
    unavoidableTopOuts: 0,
    summary: null,
  };
  const yieldEvery = options.yieldEvery ?? 5;
  try {
    for (let gameIndex = 0; gameIndex < config.games; gameIndex++) {
      if (options.shouldStop()) {
        record.status = "stopped";
        break;
      }
      const seed = (config.baseSeed + gameIndex) >>> 0;
      if (config.agentKind === "rule") {
        const outcome = runRuleGame(
          seed,
          config.stepLimit,
          options.weights ?? DEFAULT_WEIGHTS,
        );
        record.results.push(outcome.result);
        record.verificationsPerformed += outcome.verificationsPerformed;
        record.verificationErrors += outcome.verificationErrors;
        record.avoidableTopOuts += outcome.avoidableTopOuts;
        record.unavoidableTopOuts += outcome.unavoidableTopOuts;
      } else {
        record.results.push(
          runQEvalGame(seed, config.stepLimit, options.qAgent),
        );
      }
      if (options.onProgress) options.onProgress(record.results);
      if (gameIndex % yieldEvery === yieldEvery - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  } catch (error) {
    record.status = "error";
    record.errorMessage = error instanceof Error ? error.message : String(error);
  }
  record.finishedAt = Date.now();
  record.summary = summarize(record.results);
  // error/stopped semantiği korunur; yalnızca temiz tamamlanan deney
  // uyuşmazlık varsa "completedWithErrors" olur (başarı gibi gösterilmez).
  if (record.status === "completed" && record.verificationErrors > 0) {
    record.status = "completedWithErrors";
    record.errorMessage =
      `${record.verificationErrors} hamlede simülasyon-motor uyuşmazlığı ` +
      `(toplam ${record.verificationsPerformed} doğrulama)`;
  }
  return record;
}

/** Kural ajanı oyun sonucu + gerçek doğrulama sayaçları. */
interface RuleGameOutcome {
  result: GameResult;
  verificationsPerformed: number;
  verificationErrors: number;
  avoidableTopOuts: number;
  unavoidableTopOuts: number;
}

function runRuleGame(
  seed: number,
  stepLimit: number,
  weights: Weights,
): RuleGameOutcome {
  const start = Date.now();
  let state: GameState = createGame(seed);
  let ended: GameResult["ended"] = "gameOver";
  let verificationsPerformed = 0;
  let verificationErrors = 0;
  let avoidableTopOuts = 0;
  let unavoidableTopOuts = 0;
  while (!state.over && state.pieces <= stepLimit) {
    const decision = decide(state, { weights });
    const safeAvailable = decision.record.candidates.some(
      (c) => c.reachable && c.willTopOut === false,
    );
    const selected = decision.record.candidates.find(
      (c) => c.id === decision.record.selectedId,
    );
    if (selected?.willTopOut === true) {
      if (safeAvailable) avoidableTopOuts += 1;
      else unavoidableTopOuts += 1;
    }
    const result = executePlan(state, decision.plan);
    // Oyun içi panelle AYNI doğrulama: tahta + satır + oyun sonu tahmini.
    const verification = verifyExecution({
      expectedBoardFingerprint: decision.expectedBoardFingerprint,
      expectedLines: decision.expectedLines,
      fingerprint: result.fingerprint,
      linesCleared: result.linesCleared,
      completed: result.completed,
      expectedOver: decision.expectedOver,
      actualOver: result.state.over,
    });
    verificationsPerformed += 1;
    if (!verification.ok) verificationErrors += 1;
    state = result.state; // motor doğruluk kaynağıdır; ölçüme devam edilir
    if (state.pieces > stepLimit) ended = "stepLimit";
  }
  return {
    result: {
      seed,
      score: state.score,
      lines: state.lines,
      pieces: state.pieces,
      durationMs: Date.now() - start,
      ended,
    },
    verificationsPerformed,
    verificationErrors,
    avoidableTopOuts,
    unavoidableTopOuts,
  };
}

function runQEvalGame(
  seed: number,
  stepLimit: number,
  agent: QAgent | undefined,
): GameResult {
  if (agent === undefined) {
    throw new Error("qlearn deneyi için Q tablosu yüklü olmalı");
  }
  const result = playEvalGame(agent, seed, stepLimit);
  return { seed, ...result };
}

/** Q tablosu olmadan qlearn eylem anahtarları üretilemez; bu yardımcı test içindir. */
export function qActionKeysFor(state: GameState): string[] {
  return generateCandidates(state)
    .filter((c) => c.reachable)
    .map((c) => actionKey(c.rotation, c.column))
    .sort();
}

export function qStateKeyFor(state: GameState): string {
  return stateKey(state.board, state.current.type);
}
