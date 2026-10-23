import { applyMove, boardFingerprint } from "../engine";
import type { GameState, Move } from "../engine";

/**
 * Plan çalıştırıcı: bir ajan hamle planını MOTORLA (kuralların tek doğruluk
 * kaynağı) uygular. Sonucun simülasyonla karşılaştırması için son tahtanın
 * parmak izini ve temizlenen satır sayısını raporlar.
 * Uyuşmazlık varsa arayan taraf sessizce başarı kabul ETMEMELİDİR.
 */
export interface ExecutionResult {
  /** Motorun ürettiği yeni durum */
  state: GameState;
  /** Motorun plan sırasında temizlediği toplam satır sayısı */
  linesCleared: number;
  /** Uygulama sonrası tahta parmak izi */
  fingerprint: string;
  /** Plan tamamen uygulandı mı? */
  completed: boolean;
}

export function executePlan(state: GameState, plan: Move[]): ExecutionResult {
  let working = state;
  const linesBefore = working.lines;
  let completed = true;
  for (const move of plan) {
    if (working.over) {
      completed = false;
      break;
    }
    working = applyMove(working, move);
  }
  return {
    state: working,
    linesCleared: working.lines - linesBefore,
    fingerprint: boardFingerprint(working.board),
    completed,
  };
}
