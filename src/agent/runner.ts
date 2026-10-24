import { applyMove, boardFingerprint } from "../engine";
import type { GameState, Move } from "../engine";
import type { VerificationResult } from "./types";

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

export interface VerificationInput {
  /** Simülasyonun beklediği tahta parmak izi */
  expectedBoardFingerprint: string;
  /** Simülasyonun beklediği temizlenen satır sayısı */
  expectedLines: number;
  /** Motorun ürettiği tahta parmak izi */
  fingerprint: string;
  /** Motorun temizlediği satır sayısı */
  linesCleared: number;
  /** Plan motorca tam uygulandı mı? */
  completed: boolean;
}

/**
 * Simülasyon beklentisi ile gerçek motor sonucunu karşılaştırır.
 * Oyun içi karar paneli ve deney laboratuvarı bu tek doğrulamayı paylaşır;
 * uyuşmazlık asla sessizce yutulmaz, arayan taraf sonuçları göstermelidir.
 */
export function verifyExecution(input: VerificationInput): VerificationResult {
  const ok =
    input.fingerprint === input.expectedBoardFingerprint &&
    input.linesCleared === input.expectedLines &&
    input.completed;
  const error = ok
    ? undefined
    : !input.completed
      ? "plan motorca tam uygulanamadı (oyun erken bitti)"
      : input.fingerprint !== input.expectedBoardFingerprint
        ? "tahta parmak izi simülasyonla uyuşmuyor"
        : "temizlenen satır sayısı simülasyonla uyuşmuyor";
  return {
    ok,
    expectedBoard: input.expectedBoardFingerprint,
    actualBoard: input.fingerprint,
    expectedLines: input.expectedLines,
    actualLines: input.linesCleared,
    error,
  };
}
