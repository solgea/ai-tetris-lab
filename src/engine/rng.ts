/**
 * mulberry32 — küçük, hızlı ve tohumlanabilir PRNG.
 * Saf (pure) fonksiyonlar olarak kullanılır: her çağrı bir sonraki durumu
 * döndürür; böylece GameState tamamen serileştirilebilir ve tekrarlanabilir.
 */
export interface RngResult {
  value: number; // [0, 1)
  state: number; // bir sonraki çağrı için yeni tohum
}

export function nextRandom(state: number): RngResult {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t };
}

/** Fisher-Yates karıştırma — tohumlanabilir ve saf. */
export function shuffled<T>(
  items: readonly T[],
  rngState: number,
): { items: T[]; rngState: number } {
  const arr = [...items];
  let s = rngState;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextRandom(s);
    s = r.state;
    const j = Math.floor(r.value * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return { items: arr, rngState: s };
}
