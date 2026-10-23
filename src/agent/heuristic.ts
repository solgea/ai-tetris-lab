import type { BoardMetrics, Candidate, MetricName, Weights } from "./types";

/**
 * Sezgisel arama (heuristic search): her adayın ölçütlerini ağırlıklarla
 * çarpar, toplam puanı üretir ve deterministik sıralama yapar.
 */

export const DEFAULT_WEIGHTS: Weights = {
  // Klasik Dellacherie/Genetic benzeri başlangıç ağırlıkları.
  linesCleared: 0.76, // temizlenen her satır güçlü ödül
  holes: -0.356, // her delik ceza
  aggregateHeight: -0.51, // toplam yükseklik ceza
  maxHeight: -0.15, // tepe yükseklik ceza
  bumpiness: -0.184, // yüzey düzensizliği ceza
};

export interface ScoredCandidate {
  score: number;
  contributions: Partial<Record<MetricName, number>>;
}

/** Her ölçütün (ağırlık × ölçüt) katkısını ve toplam puanı hesaplar. */
export function scoreCandidate(
  metrics: BoardMetrics,
  weights: Weights,
): ScoredCandidate {
  const contributions: Partial<Record<MetricName, number>> = {};
  let total = 0;
  for (const name of Object.keys(weights) as MetricName[]) {
    const contribution = weights[name] * metrics[name];
    contributions[name] = contribution;
    total += contribution;
  }
  return { score: total, contributions };
}

/**
 * Adayları puanlarına göre sıralar ve gerekçeleri yazar.
 * Eşitlik bozma kuralı (deterministik):
 *   1. daha yüksek toplam puan
 *   2. daha fazla temizlenen satır
 *   3. daha küçük döndürme
 *   4. daha küçük sütun
 * Ulaşılamayan adaylar sıralamanın sonuna alınır ve puanlanmaz.
 */
export function rankCandidates(
  candidates: Candidate[],
  weights: Weights,
): Candidate[] {
  for (const candidate of candidates) {
    if (candidate.reachable && candidate.metrics !== null) {
      const scored = scoreCandidate(candidate.metrics, weights);
      candidate.score = scored.score;
      candidate.contributions = scored.contributions;
    }
  }
  const reachable = candidates
    .filter((c) => c.reachable && c.score !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return (b.score as number) - (a.score as number);
      const linesA = a.metrics?.linesCleared ?? 0;
      const linesB = b.metrics?.linesCleared ?? 0;
      if (linesA !== linesB) return linesB - linesA;
      if (a.rotation !== b.rotation) return a.rotation - b.rotation;
      return a.column - b.column;
    });
  const unreachable = candidates.filter(
    (c) => !c.reachable || c.score === null,
  );
  const ranked = [...reachable, ...unreachable];
  for (let index = 0; index < ranked.length; index++) {
    const candidate = ranked[index];
    if (!candidate.reachable || candidate.score === null) {
      candidate.reason = `${candidate.reason} — değerlendirmeye alınmadı`;
    } else if (index === 0) {
      candidate.reason =
        "SEÇİLDİ: ulaşılabilir adaylar arasında en yüksek toplam puan";
    } else {
      const best = ranked[0];
      candidate.reason = `elenen: toplam puanı seçilenden ${
        (best.score as number) - (candidate.score as number)
      } düşük`;
    }
  }
  return ranked;
}

/**
 * Ajanın insan-okur gerekçesini üretir. Metindeki tüm sayılar gerçek
 * hesaplanmış değerlerden gelir; açıklama ile puanlar tutarlıdır.
 */
export function explainSelection(
  pieceType: string,
  best: Candidate,
  candidates: Candidate[],
  weights: Weights,
): string {
  const lines = candidates.filter((c) => c.reachable).length;
  const metricTexts: string[] = [];
  if (best.metrics && best.contributions) {
    metricTexts.push(
      `temizlenen satır ${best.metrics.linesCleared} (${formatContribution(best.contributions.linesCleared)})`,
      `delik ${best.metrics.holes} (${formatContribution(best.contributions.holes)})`,
      `toplam yükseklik ${best.metrics.aggregateHeight} (${formatContribution(best.contributions.aggregateHeight)})`,
      `tepe yükseklik ${best.metrics.maxHeight} (${formatContribution(best.contributions.maxHeight)})`,
      `düzensizlik ${best.metrics.bumpiness} (${formatContribution(best.contributions.bumpiness)})`,
    );
  }
  return (
    `${pieceType} parçası rotation=${best.rotation}, column=${best.column} konumuna bırakıldı. ` +
    `${lines} ulaşılabilir aday arasından en yüksek toplam puanı aldı (${best.score?.toFixed(3)}). ` +
    `Katkılar: ${metricTexts.join(", ")}. ` +
    `Ağırlıklar: satır=${weights.linesCleared}, delik=${weights.holes}, ` +
    `toplam yükseklik=${weights.aggregateHeight}, tepe=${weights.maxHeight}, düzensizlik=${weights.bumpiness}.`
  );
}

function formatContribution(value: number | undefined): string {
  if (value === undefined) return "veri yok";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)} puan`;
}
