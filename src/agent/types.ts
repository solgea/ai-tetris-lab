import type { Board, Move, PieceType } from "../engine";

/** Tahta ölçütleri — hepsi tahtadan hesaplanabilir sayılardır. */
export interface BoardMetrics {
  /** Simülasyonda temizlenen satır sayısı (satır) */
  linesCleared: number;
  /** Dolu hücre altında kalan boş hücre sayısı (adet) */
  holes: number;
  /** Tüm sütun yüksekliklerinin toplamı (satır) */
  aggregateHeight: number;
  /** En yüksek sütunun yüksekliği (satır) */
  maxHeight: number;
  /** Komşu sütun yükseklik farklarının toplamı (satır) */
  bumpiness: number;
  /** Her sütunun yüksekliği (satır cinsinden, 10 eleman) */
  columnHeights: number[];
}

export type MetricName =
  | "linesCleared"
  | "holes"
  | "aggregateHeight"
  | "maxHeight"
  | "bumpiness";

export const METRIC_NAMES: readonly MetricName[] = [
  "linesCleared",
  "holes",
  "aggregateHeight",
  "maxHeight",
  "bumpiness",
];

/** Puanlama ağırlıkları: her ölçütün toplam puana katsayısı. */
export interface Weights {
  linesCleared: number;
  holes: number;
  aggregateHeight: number;
  maxHeight: number;
  bumpiness: number;
}

/** Tek bir aday hamle (parça yönü + hedef sütun). */
export interface Candidate {
  /** "rotation:column" biçiminde benzersiz kimlik */
  id: string;
  /** Hedef döndürme (0..3) */
  rotation: number;
  /** Hedef sütun — şekil matrisinin sol kenarı */
  column: number;
  /** Motorda sırayla uygulanacak atomik hamleler */
  plan: Move[];
  /** Hedef konuma motor hamleleriyle ulaşılabiliyor mu? */
  reachable: boolean;
  /** İniş satırı (şekil matrisinin üst kenarı); ulaşılamıyorsa null */
  landingY: number | null;
  /** Simüle edilmiş son tahtanın ölçütleri; ulaşılamıyorsa null */
  metrics: BoardMetrics | null;
  /** Her ölçütün puana katkısı (ağırlık × ölçüt); ulaşılamıyorsa null */
  contributions: Partial<Record<MetricName, number>> | null;
  /** Toplam puan; ulaşılamıyorsa null */
  score: number | null;
  /** Simüle edilmiş son tahta; ulaşılamıyorsa null */
  simulatedBoard: Board | null;
  /** Seçilme veya elenme gerekçesi */
  reason: string;
}

/** Simülasyon ile motor sonucunun karşılaştırması. */
export interface VerificationResult {
  ok: boolean;
  /** Simüle edilmiş tahtanın parmak izi */
  expectedBoard: string;
  /** Motorun ürettiği tahtanın parmak izi */
  actualBoard: string;
  expectedLines: number;
  actualLines: number;
  /** Uyuşmazlık varsa insan-okur açıklama */
  error?: string;
}

export interface WeightedCandidateSortResult {
  ranked: Candidate[];
  selectedId: string | null;
}

/** Ajanın tek parça için aldığı kararın tam kaydı. */
export interface DecisionRecord {
  id: number;
  /** Karar anındaki parça sırası (1'den başlar) */
  pieceIndex: number;
  pieceType: PieceType;
  /** Kaydın oluşturulma zamanı (ms, Date.now) */
  createdAt: number;
  weights: Weights;
  candidates: Candidate[];
  selectedId: string | null;
  /** Ajanın insan-okur gerekçesi */
  reasoning: string;
  /** Plan motorla uygulandıktan sonra doldurulur */
  verification: VerificationResult | null;
  /** Plan motor tarafından uygulandı mı? */
  applied: boolean;
  /** Motorun gerçekten temizlediği satır sayısı */
  linesAfter: number | null;
  /** Uygulama sonrası toplam oyun puanı */
  scoreAfter: number | null;
  /** Kararın alındığı mod */
  mode: "agent" | "manual";
}
