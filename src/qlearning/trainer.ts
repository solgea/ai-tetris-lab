import { generateCandidates } from "../agent/candidates";
import { executePlan } from "../agent/runner";
import { actionKey, stateKey } from "./features";
import { computeReward } from "./reward";
import type { QAgent } from "./qagent";
import { createGame } from "../engine";
import type { GameState } from "../engine";

/**
 * Eğitmen: Q-learning ajanını kendi oyun örneklerinde (oyun motoruyla)
 * eğitir. Eğitim tamamen kullanıcı tarafından başlatılır ve durdurulabilir.
 * Eğitim, arayüzü kilitlememek için bölüm aralarında kontrolü tarayıcıya
 * geri verir (await yieldToBrowser). Eğitim verisi karar kayıtlarından
 * ayrıdır: burada üretilen EpisodeRecord'lar Q tablosuna aittir.
 */

export interface TrainerOptions {
  episodes: number;
  seed: number;
  alpha: number;
  gamma: number;
  epsilon: number;
  /** Bir bölümde eğitilecek en fazla parça sayısı */
  stepLimit: number;
}

export type EpisodeEndReason = "gameOver" | "stepLimit";

export interface EpisodeRecord {
  index: number;
  seed: number;
  score: number;
  lines: number;
  pieces: number;
  durationMs: number;
  ended: EpisodeEndReason;
  exploredSteps: number;
}

export interface TrainerCallbacks {
  onEpisode: (record: EpisodeRecord, agent: QAgent) => void;
}

export class Trainer {
  cancelled = false;

  /**
   * Eğitimi çalıştırır. cancelled=true yapıldığında bir sonraki bölümde
   * durur ve kısmi sonuçları "stopped" işaretiyle döndürür.
   */
  async run(
    options: TrainerOptions,
    agent: QAgent,
    callbacks: TrainerCallbacks,
  ): Promise<{ episodes: EpisodeRecord[]; stopped: boolean }> {
    agent.alpha = options.alpha;
    agent.gamma = options.gamma;
    const episodes: EpisodeRecord[] = [];
    let stopped = false;
    for (let index = 0; index < options.episodes; index++) {
      if (this.cancelled) {
        stopped = true;
        break;
      }
      const record = this.runEpisode(options, agent, index);
      episodes.push(record);
      agent.markEpisode();
      callbacks.onEpisode(record, agent);
      await yieldToBrowser();
    }
    return { episodes, stopped };
  }

  /** Tek bir bölümü baştan sona oynar ve Q değerlerini günceller. */
  private runEpisode(
    options: TrainerOptions,
    agent: QAgent,
    index: number,
  ): EpisodeRecord {
    const seed = (options.seed + index) >>> 0;
    const start = Date.now();
    let state = createGame(seed);
    let exploredSteps = 0;
    let rngState = seed;
    let ended: EpisodeEndReason = "gameOver";

    while (!state.over && state.pieces <= options.stepLimit) {
      const boardBefore = state.board;
      const key = stateKey(boardBefore, state.current.type);
      const candidates = generateCandidates(state);
      const reachable = candidates.filter((c) => c.reachable);
      if (reachable.length === 0) break;
      const actionKeys = reachable
        .map((c) => actionKey(c.rotation, c.column))
        .sort();
      const selection = agent.selectAction(key, actionKeys, {
        mode: "train",
        epsilon: options.epsilon,
        rngState,
      });
      rngState = selection.rngState;
      if (selection.explored) exploredSteps += 1;

      const chosen =
        reachable.find(
          (c) => actionKey(c.rotation, c.column) === selection.actionKey,
        ) ?? reachable[0];
      const result = executePlan(state, chosen.plan);
      const boardAfter = result.state.board;
      const gameOver = result.state.over;
      const reward = computeReward({
        linesCleared: result.linesCleared,
        boardBefore,
        boardAfter,
        gameOver,
      });
      const nextKey = gameOver
        ? null
        : stateKey(
            boardAfter,
            result.state.current.type,
          );
      const nextActions = gameOver
        ? []
        : generateCandidates(result.state)
            .filter((c) => c.reachable)
            .map((c) => actionKey(c.rotation, c.column))
            .sort();
      agent.update(key, selection.actionKey, reward.total, nextKey, nextActions);
      state = result.state;
      if (state.pieces > options.stepLimit) ended = "stepLimit";
    }

    return {
      index,
      seed,
      score: state.score,
      lines: state.lines,
      pieces: state.pieces,
      durationMs: Date.now() - start,
      ended,
      exploredSteps,
    };
  }
}

/** Tarayıcıya kontrol verir; jsdom/test ortamında da çalışır. */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setTimeout === "function") {
      setTimeout(() => resolve(), 0);
    } else {
      resolve();
    }
  });
}

/**
 * Değerlendirme modu (keşif yok, öğrenme yok): tek bir oyunu
 * Q tablosuna göre oynar. Deney laboratuvarı bunu kullanır.
 */
export function playEvalGame(
  agent: QAgent,
  seed: number,
  stepLimit: number,
): { score: number; lines: number; pieces: number; durationMs: number; ended: EpisodeEndReason } {
  const start = Date.now();
  let state: GameState = createGame(seed);
  let ended: EpisodeEndReason = "gameOver";
  let applied = 0;
  while (!state.over && state.pieces <= stepLimit) {
    const key = stateKey(state.board, state.current.type);
    const reachable = generateCandidates(state).filter((c) => c.reachable);
    if (reachable.length === 0) break;
    const actionKeys = reachable
      .map((c) => actionKey(c.rotation, c.column))
      .sort();
    const selection = agent.selectAction(key, actionKeys, {
      mode: "eval",
      epsilon: 0,
      rngState: seed,
    });
    const chosen =
      reachable.find(
        (c) => actionKey(c.rotation, c.column) === selection.actionKey,
      ) ?? reachable[0];
    state = executePlan(state, chosen.plan).state;
    applied += 1;
    if (state.pieces > stepLimit) ended = "stepLimit";
  }
  void applied;
  return {
    score: state.score,
    lines: state.lines,
    pieces: state.pieces,
    durationMs: Date.now() - start,
    ended,
  };
}

/** Kural tabanlı ajan için tek oyun deney laboratuvarında (src/lab) tanımlıdır. */
