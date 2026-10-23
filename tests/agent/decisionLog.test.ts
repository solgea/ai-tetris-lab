import { describe, expect, it } from "vitest";
import { appendCapped, DecisionHistory, updateRecord } from "../../src/agent/decisionLog";
import type { DecisionRecord } from "../../src/agent/types";

function record(id: number): DecisionRecord {
  return {
    id,
    pieceIndex: id,
    pieceType: "T",
    createdAt: id,
    weights: { linesCleared: 0.76, holes: -0.356, aggregateHeight: -0.51, maxHeight: -0.15, bumpiness: -0.184 },
    candidates: [],
    selectedId: null,
    reasoning: "test",
    verification: null,
    applied: false,
    linesAfter: null,
    scoreAfter: null,
    mode: "agent",
  };
}

describe("karar günlüğü", () => {
  it("appendCapped kapasiteyi aşan en eski kayıtları düşürür", () => {
    let items: DecisionRecord[] = [];
    for (let i = 1; i <= 5; i++) {
      items = appendCapped(items, record(i), 3);
    }
    expect(items.map((r) => r.id)).toEqual([3, 4, 5]);
  });

  it("6000 kayıt eklendiğinde kapasite aşılır ve işlem hızlı kalır", () => {
    let items: DecisionRecord[] = [];
    const start = Date.now();
    for (let i = 1; i <= 6000; i++) {
      items = appendCapped(items, record(i), 200);
    }
    const elapsed = Date.now() - start;
    expect(items.length).toBe(200);
    expect(items[items.length - 1].id).toBe(6000);
    expect(elapsed).toBeLessThan(2000);
  });

  it("updateRecord doğrulama sonucunu kayda işler", () => {
    const items = [record(1)];
    const updated = updateRecord(items, 1, {
      applied: true,
      linesAfter: 2,
      scoreAfter: 300,
      verification: {
        ok: true,
        expectedBoard: "a",
        actualBoard: "a",
        expectedLines: 2,
        actualLines: 2,
      },
    });
    expect(updated[0].applied).toBe(true);
    expect(updated[0].verification?.ok).toBe(true);
  });

  it("DecisionHistory kimlik üretir ve sınırlı tutar", () => {
    const history = new DecisionHistory(2);
    const a = history.add({ ...record(0), id: undefined });
    const b = history.add({ ...record(0), id: undefined });
    history.add({ ...record(0), id: undefined });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(history.size).toBe(2);
    expect(history.all().map((r) => r.id)).toEqual([2, 3]);
    expect(history.find(1)).toBeNull();
    history.clear();
    expect(history.size).toBe(0);
  });

  it("DecisionHistory.update kaydı bulur ve günceller", () => {
    const history = new DecisionHistory();
    const added = history.add({ ...record(0), id: undefined });
    const updated = history.update(added.id, { linesAfter: 1 });
    expect(updated?.linesAfter).toBe(1);
    expect(history.update(999, { linesAfter: 1 })).toBeNull();
  });
});
