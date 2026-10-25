import { boardFingerprint } from "../engine";
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
  /** Seçilen yerleşimden sonra sıradaki parça doğuşta çakışıyor mu? */
  expectedOver: boolean;
}

/**
 * Top-out içeren kararlarda aday gerekçelerini güvenlik filtresine göre
 * yeniden yazar. Tüm adaylar güvenliyse mevcut sıralama gerekçeleri korunur.
 */
function annotateTopOutReasons(
  candidates: Candidate[],
  selected: Candidate,
): void {
  if (!candidates.some((c) => c.reachable && c.willTopOut === true)) {
    return;
  }
  const selectedScore = selected.score;
  if (selectedScore === null) return;
  for (const candidate of candidates) {
    if (!candidate.reachable || candidate.score === null) continue;
    if (candidate.id === selected.id) {
      candidate.reason =
        selected.willTopOut === true
          ? "SEÇİLDİ (zorunlu): tüm ulaşılabilir adaylarda sonraki parça doğuşta çakışıyor; en yüksek puanlı geri dönüş"
          : "SEÇİLDİ: güvenli adaylar arasında en yüksek toplam puan";
    } else if (candidate.willTopOut === true) {
      candidate.reason =
        "elenen: sonraki parçanın doğuşunu engelliyor (top-out)";
    } else {
      const difference = (selectedScore - candidate.score).toFixed(3);
      candidate.reason = `elenen: toplam puanı seçilenden ${difference} düşük`;
    }
  }
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
  const reachable = candidates.filter((c) => c.reachable && c.score !== null);
  // Güvenlik sert bir kısıttır: güvenli aday varsa asla top-out seçilmez.
  const best = reachable.find((c) => c.willTopOut === false) ?? reachable[0];
  if (best === undefined) {
    throw new Error("Ulaşılabilir aday hamle yok — ajan karar veremedi");
  }
  if (best.willTopOut === null) {
    throw new Error("Seçilen adayın doğuş çakışması tahmini yok");
  }
  annotateTopOutReasons(candidates, best);
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
    expectedBoardFingerprint: boardFingerprint(simulatedBoard),
    expectedLines: best.metrics?.linesCleared ?? 0,
    expectedOver: best.willTopOut,
  };
}
