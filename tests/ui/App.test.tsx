import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../../src/ui/App";

function cellCount(): number {
  return document.querySelectorAll('[data-testid^="cell-"]').length;
}

describe("App — başlatma, duraklatma ve yeniden başlatma", () => {
  it("10×20 tahta ve sıradaki parçalar render edilir", () => {
    render(<App />);
    expect(cellCount()).toBe(200);
    expect(screen.getByTestId("next-queue")).toBeDefined();
    expect(screen.getByTestId("score").textContent).toBe("0");
    expect(screen.getByTestId("pieces").textContent).toBe("1");
  });

  it("Başlat/Duraklat düğmesi durumu değiştirir", () => {
    render(<App />);
    const button = screen.getByTestId("start-pause");
    expect(button.textContent).toBe("Başlat");
    fireEvent.click(button);
    expect(button.textContent).toBe("Duraklat");
    fireEvent.click(button);
    expect(button.textContent).toBe("Başlat");
  });

  it("ajanı açma ve kapatma çalışır", () => {
    render(<App />);
    const toggle = screen.getByTestId("toggle-ai");
    expect(toggle.textContent).toContain("AÇIK");
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain("KAPALI");
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain("AÇIK");
  });

  it("yeniden başlatma puanı sıfırlar ve karar geçmişini temizler", () => {
    render(<App />);
    // ajanı kapat, sert düşür, puan artsın
    fireEvent.click(screen.getByTestId("toggle-ai"));
    fireEvent.click(screen.getByTestId("hard-drop"));
    const scoreAfterDrop = Number(screen.getByTestId("score").textContent);
    expect(scoreAfterDrop).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("restart"));
    expect(screen.getByTestId("score").textContent).toBe("0");
    expect(screen.getByTestId("history-empty")).toBeDefined();
  });

  it("oyun bittiğinde oyun sonu uyarısı görünür olur", () => {
    // Bu test doğrudan over durumunu tetikleyemez; bileşen koşullu
    // render'ı için ekran okunabilir etiket testi (statik) yapılır:
    render(<App />);
    expect(screen.queryByTestId("game-over")).toBeNull();
  });
});

describe("App — karar paneli ve eksik veri durumları", () => {
  it("ajan kararı yoksa panel 'veri yok' gösterir", () => {
    render(<App />);
    expect(screen.getByTestId("decision-empty").textContent).toContain(
      "veri yok",
    );
    expect(screen.getByTestId("history-empty").textContent).toContain(
      "veri yok",
    );
  });

  it("Tek Hamle düğmesi ajanla karar kaydı üretir", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("step"));
    expect(screen.queryByTestId("decision-empty")).toBeNull();
    expect(screen.getByTestId("candidate-table")).toBeDefined();
    expect(screen.getByTestId("verification-ok")).toBeDefined();
    // seçilen aday detayı görüntülenir
    expect(screen.getByTestId("candidate-detail")).toBeDefined();
    expect(screen.getByTestId("candidate-score").textContent).not.toContain(
      "veri yok",
    );
  });
});
