import {
  BOARD_WIDTH,
  previewNextSpawn,
  rotatePiece,
  tryShift,
} from "../engine";
import type { GameState, Move } from "../engine";
import { simulateDrop } from "./simulator";
import type { Candidate } from "./types";

/**
 * Aday üretici: mevcut parça için ulaşılabilir tüm (döndürme, sütun)
 * konumlarını üretir. Adaylar yalnızca motorun gerçek hamleleriyle
 * (döndürme + tek tek kaydırma + sert düşüş) ulaşılabilen konumlardır;
 * böylece simülasyon ile motor sonucu tutarlıdır.
 *
 * Üretim tamamen deterministiktir: aynı durum her zaman aynı aday listesini
 * verir (önce döndürme 0..3, sonra sütun 0..9 sırasıyla).
 */

function buildPlan(
  rotations: Move[],
  dx: number,
): Move[] {
  const plan: Move[] = [...rotations];
  const abs = Math.abs(dx);
  const direction: Move = dx < 0 ? "left" : "right";
  for (let i = 0; i < abs; i++) {
    plan.push(direction);
  }
  plan.push("hardDrop");
  return plan;
}

/** Döndürme adımlarını motorla uygular; hedef yönüne ulaşılamazsa null. */
function applyRotations(
  state: GameState,
  targetRotation: number,
): { state: GameState; rotations: Move[] } | null {
  let working = state;
  const rotations: Move[] = [];
  const startRotation = working.current.rotation;
  const steps = (targetRotation - startRotation + 4) % 4;
  for (let i = 0; i < steps; i++) {
    const rotated = rotatePiece(working, 1);
    if (rotated === working || rotated.current.rotation === working.current.rotation) {
      return null; // döndürme engellendi
    }
    working = rotated;
    rotations.push("rotateCW");
  }
  if (working.current.rotation !== targetRotation) {
    return null;
  }
  return { state: working, rotations };
}

/** Hedef sütuna tek tek kaydırarak ilerler; ulaşılamazsa null döner. */
function slideToColumn(
  state: GameState,
  targetColumn: number,
): { state: GameState; dx: number } | null {
  let working = state;
  let dx = 0;
  const guard = BOARD_WIDTH + 1;
  while (working.current.x !== targetColumn) {
    if (Math.abs(dx) > guard) return null;
    const direction = targetColumn < working.current.x ? -1 : 1;
    const shifted = tryShift(working, direction);
    if (shifted === working) {
      return null; // kayma engellendi
    }
    working = shifted;
    dx += direction;
  }
  return { state: working, dx };
}

export function generateCandidates(state: GameState): Candidate[] {
  const candidates: Candidate[] = [];
  for (let targetRotation = 0; targetRotation < 4; targetRotation++) {
    const rotated = applyRotations(state, targetRotation);
    if (rotated === null) {
      candidates.push({
        id: `${targetRotation}:x`,
        rotation: targetRotation,
        column: -1,
        plan: [],
        reachable: false,
        willTopOut: null,
        landingY: null,
        metrics: null,
        contributions: null,
        score: null,
        simulatedBoard: null,
        reason: `rotation=${targetRotation} yönüne döndürme motor hamleleriyle engellendi`,
      });
      continue;
    }
    for (let targetColumn = 0; targetColumn < BOARD_WIDTH; targetColumn++) {
      const slid = slideToColumn(rotated.state, targetColumn);
      if (slid === null) {
        candidates.push({
          id: `${targetRotation}:${targetColumn}`,
          rotation: targetRotation,
          column: targetColumn,
          plan: [],
          reachable: false,
          willTopOut: null,
          landingY: null,
          metrics: null,
          contributions: null,
          score: null,
          simulatedBoard: null,
          reason: `rotation=${targetRotation}, column=${targetColumn} konumuna kayma yolu kapalı`,
        });
        continue;
      }
      const plan = buildPlan(rotated.rotations, slid.dx);
      const simulation = simulateDrop(state.board, slid.state.current);
      if (simulation === null) {
        candidates.push({
          id: `${targetRotation}:${targetColumn}`,
          rotation: targetRotation,
          column: targetColumn,
          plan,
          reachable: false,
          willTopOut: null,
          landingY: null,
          metrics: null,
          contributions: null,
          score: null,
          simulatedBoard: null,
          reason: `rotation=${targetRotation}, column=${targetColumn} konumunda iniş çakışıyor`,
        });
        continue;
      }
      const spawn = previewNextSpawn({
        ...state,
        board: simulation.board,
      });
      candidates.push({
        id: `${targetRotation}:${targetColumn}`,
        rotation: targetRotation,
        column: targetColumn,
        plan,
        reachable: true,
        willTopOut: spawn.willCollide,
        landingY: simulation.landingY,
        metrics: simulation.metrics,
        contributions: null,
        score: null,
        simulatedBoard: simulation.board,
        reason: "",
      });
    }
  }
  // hardDrop'un motorla birebir aynı olduğundan emin olmak için plan
  // sonunun gerçekten "hardDrop" olduğunu bir kez daha doğrula.
  for (const candidate of candidates) {
    if (
      candidate.reachable &&
      candidate.plan[candidate.plan.length - 1] !== "hardDrop"
    ) {
      candidate.reachable = false;
      candidate.willTopOut = null;
      candidate.reason = "plan sert düşüşle bitmiyor (dahili hata)";
    }
  }
  return candidates;
}
