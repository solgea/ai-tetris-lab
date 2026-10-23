import type { GameState } from "../engine";
import { generateCandidates } from "./candidates";
import { DEFAULT_WEIGHTS, explainSelection, rankCandidates } from "./heuristic";
import type { Candidate, DecisionRecord, Weights } from "./types";

/**
 * Kural tabanlı ajan: mevcut parça için tüm ulaşılabilir adayları üretir,
 * puanlar, deterministik olarak en iyisini seçer ve karar kaydını oluşturur.
 * Ajan motoru DEĞİŞTİRMEZ; yalnızca hamle önerir ve simüle eder.
 */
export interface AgentDecision {
  record: DecisionRecord;
  /** Seçilen adayın motor hamleleri */
  plan: Candidate["plan"];
  /** Simüle edilen son tahtanın parmak izi (doğrulama için) */
  expectedBoardFingerprint: string;
  /** Simülasyonda beklenen temizlenen satır sayısı */
  expectedLines: number;
}

export function decide(
  state: GameState,
  options: { weights?: Weights; nextRecordId?: number } = {},
): AgentDecision {
  if (state.over) {
    throw new Error("Oyun bittiği için ajan kararı alınamaz");
  }
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const candidates = rankCandidates(generateCandidates(state), weights);
  const best = candidates.find((c) => c.reachable && c.score !== null);
  if (best === undefined) {
    throw new Error("Ulaşılabilir aday hamle yok — ajan karar veremedi");
  }
  const reasoning = explainSelection(
    state.current.type,
    best,
    candidates,
    weights,
  );
  const record: DecisionRecord = {
    id: options.nextRecordId ?? 0,
    pieceIndex: state.pieces,
    pieceType: state.current.type,
    createdAt: Date.now(),
    weights: { ...weights },
    candidates,
    selectedId: best.id,
    reasoning,
    verification: null,
    applied: false,
    linesAfter: null,
    scoreAfter: null,
    mode: "agent",
  };
  const simulatedBoard = best.simulatedBoard;
  if (simulatedBoard === null) {
    throw new Error("Seçilen adayın simüle edilmiş tahtası yok");
  }
  return {
    record,
    plan: best.plan,
    expectedBoardFingerprint: fingerprintOf(simulatedBoard),
    expectedLines: best.metrics?.linesCleared ?? 0,
  };
}

function fingerprintOf(board: import("../engine").Board): string {
  return board
    .map((row) => row.map((cell) => (cell === null ? "." : cell)).join(""))
    .join("|");
}
