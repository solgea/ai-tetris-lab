import { describe, expect, it } from "vitest";
import { verifyExecution } from "../../src/agent/runner";

describe("verifyExecution — simülasyon/motor doğrulama yardımcısı", () => {
  const base = {
    expectedBoardFingerprint: "....|....|....",
    expectedLines: 0,
    fingerprint: "....|....|....",
    linesCleared: 0,
    completed: true,
  };

  it("beklentiyle tutarlıysa ok=true ve hatasız döner", () => {
    const result = verifyExecution(base);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.expectedBoard).toBe(base.expectedBoardFingerprint);
    expect(result.actualBoard).toBe(base.fingerprint);
    expect(result.expectedLines).toBe(0);
    expect(result.actualLines).toBe(0);
  });

  it("parmak izi uyuşmazlığı algılanır ve gerekçe açıklanır", () => {
    const result = verifyExecution({
      ...base,
      fingerprint: "XXXX|....|....",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("parmak izi");
    expect(result.expectedBoard).toBe(base.expectedBoardFingerprint);
    expect(result.actualBoard).toBe("XXXX|....|....");
  });

  it("temizlenen satır sayısı uyuşmazlığı algılanır", () => {
    const result = verifyExecution({
      ...base,
      expectedLines: 2,
      linesCleared: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("satır");
    expect(result.expectedLines).toBe(2);
    expect(result.actualLines).toBe(1);
  });

  it("tamamlanmamış plan uyuşmazlık olarak raporlanır", () => {
    const result = verifyExecution({ ...base, completed: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("tam uygulanamadı");
  });

  it("parmak izi eşit ama satır farklıysa ok=false olur (her koşul gerekli)", () => {
    const result = verifyExecution({
      ...base,
      expectedLines: 1,
      linesCleared: 1,
      fingerprint: "XXXX|....|....",
    });
    expect(result.ok).toBe(false);
  });
});
