import type { DecisionRecord } from "./types";

/**
 * Karar günlüğü: ajan kararlarının geçmişi.
 * Sabit kapasiteli halka tamponu — büyük geçmişlerde bellek sınırlı kalır
 * ve ekleme O(1) amortized olur. Arayüz bu modülü doğrudan veya saf
 * yardımcılarla kullanabilir.
 */

export const DEFAULT_HISTORY_CAP = 200;

/** Saf: kaydı kapasiteli listeye ekler; en eski kayıtlar düşer. */
export function appendCapped(
  items: readonly DecisionRecord[],
  record: DecisionRecord,
  cap: number = DEFAULT_HISTORY_CAP,
): DecisionRecord[] {
  const next = [...items, record];
  if (next.length > cap) {
    next.splice(0, next.length - cap);
  }
  return next;
}

/** Saf: kaydı kimliğe göre günceller (ör. doğrulama sonucu eklemek için). */
export function updateRecord(
  items: readonly DecisionRecord[],
  id: number,
  patch: Partial<DecisionRecord>,
): DecisionRecord[] {
  return items.map((record) =>
    record.id === id ? { ...record, ...patch } : record,
  );
}

export class DecisionHistory {
  private items: DecisionRecord[] = [];
  private nextId = 1;

  constructor(private capacity: number = DEFAULT_HISTORY_CAP) {}

  add(
    record: Omit<DecisionRecord, "id"> & { id?: number },
  ): DecisionRecord {
    const withId: DecisionRecord = { ...record, id: record.id ?? this.nextId };
    if (record.id === undefined) {
      this.nextId += 1;
    } else {
      this.nextId = Math.max(this.nextId, record.id + 1);
    }
    this.items = appendCapped(this.items, withId, this.capacity);
    return withId;
  }

  update(id: number, patch: Partial<DecisionRecord>): DecisionRecord | null {
    const before = this.find(id);
    if (before === null) return null;
    const updated = { ...before, ...patch };
    this.items = updateRecord(this.items, id, updated);
    return updated;
  }

  find(id: number): DecisionRecord | null {
    return this.items.find((r) => r.id === id) ?? null;
  }

  all(): readonly DecisionRecord[] {
    return this.items;
  }

  clear(): void {
    this.items = [];
    this.nextId = 1;
  }

  get size(): number {
    return this.items.length;
  }
}
