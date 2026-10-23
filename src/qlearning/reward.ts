import { countHoles } from "../agent/evaluator";
import type { Board } from "../engine";

/**
 * Ödül fonksiyonu — sürüm: "reward-v1".
 *
 * Formül:
 *   + temizlenen satır başına 50 puan; 4 satıra (tetris) ek 200 bonus
 *   - delik sayısındaki her artış için 12 puan ceza (azalırsa ödül yok)
 *   - tepe yüksekliğindeki her artış için 2 puan ceza
 *   - oyun biterse ek 200 puan ceza
 *
 * Satır temizleme açıkça ödüllendirilir; delik oluşturma ve oyun sonu
 * açıkça cezalandırılır. Fonksiyon saf ve deterministiktir.
 */
export const REWARD_VERSION = "reward-v1";

export const LINE_REWARD = 50;
export const TETRIS_BONUS = 200;
export const HOLE_PENALTY = 12;
export const HEIGHT_PENALTY = 2;
export const GAME_OVER_PENALTY = 200;

export interface RewardInput {
  linesCleared: number;
  boardBefore: Board;
  boardAfter: Board;
  gameOver: boolean;
}

export interface RewardBreakdown {
  total: number;
  lines: number;
  holes: number;
  height: number;
  gameOver: number;
}

export function computeReward(input: RewardInput): RewardBreakdown {
  const lines =
    input.linesCleared > 0
      ? input.linesCleared * LINE_REWARD +
        (input.linesCleared >= 4 ? TETRIS_BONUS : 0)
      : 0;
  const holeDelta =
    countHoles(input.boardAfter) - countHoles(input.boardBefore);
  // Yalnızca delik ARTIŞI cezalandırılır; azalış ek ödül vermez.
  const holes = holeDelta > 0 ? holeDelta * -HOLE_PENALTY : 0;
  const heightBefore = maxHeightOf(input.boardBefore);
  const heightAfter = maxHeightOf(input.boardAfter);
  const height =
    heightAfter > heightBefore
      ? (heightAfter - heightBefore) * -HEIGHT_PENALTY
      : 0;
  const gameOver = input.gameOver ? -GAME_OVER_PENALTY : 0;
  return {
    // -0'ı +0'a normalize et (test ve gösterim tutarlılığı)
    total: lines + holes + height + gameOver + 0,
    lines: lines + 0,
    holes: holes + 0,
    height: height + 0,
    gameOver: gameOver + 0,
  };
}

function maxHeightOf(board: Board): number {
  for (let r = 0; r < board.length; r++) {
    if (board[r].some((cell) => cell !== null)) return board.length - r;
  }
  return 0;
}
