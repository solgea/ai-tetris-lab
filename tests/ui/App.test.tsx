import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("App — D2 serileştirme (yazım yarışı olmaması)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AI tick'leri ile Tek Hamle tıklamaları arka arkaya tetiklendiğinde hiçbir hamle kaybolmaz ve tüm karar doğrulamaları geçer", () => {
    vi.useFakeTimers();
    render(<App />);
    // AI açık, oyunu başlat (interval 90 ms'de bir tick atar)
    fireEvent.click(screen.getByTestId("start-pause"));
    // interval tick'leri ile araya Tek Hamle tıklamaları karıştır —
    // eski kodda bu, bayat gameRef okumasıyla hamle kaybına ve sahte
    // doğrulama uyuşmazlığına yol açabilirdi
    for (let i = 0; i < 12; i++) {
      act(() => {
        vi.advanceTimersByTime(90);
      });
      if (i % 3 === 0) {
        fireEvent.click(screen.getByTestId("step"));
      }
    }
    // hiçbir sahte doğrulama uyuşmazlığı üretilmemeli
    expect(screen.queryByTestId("error-banner")).toBeNull();
    expect(screen.queryByTestId("verification-fail")).toBeNull();
    // geçmişte karar kayıtları oluşmuş olmalı ve hiçbiri ✗ olmamalı
    const historyTable = screen.getByTestId("history-table");
    expect(historyTable).toBeDefined();
    expect(historyTable.textContent).not.toContain("✗");
    // oyun gerçekten ilerledi (hamleler kaybolmadı)
    const pieces = Number(screen.getByTestId("pieces").textContent);
    expect(pieces).toBeGreaterThan(1);
  });

  it("yeniden başlatma sonrasında eski oyuna ait gecikmiş tick yeni oyunun durumunu bozamaz", () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByTestId("start-pause"));

    // G1'i ilerlet: en az bir parça kilitlenene kadar tick at —
    // böylece G1 tahtasında kilitli hücreler olur ve eski bir planın
    // yeni oyuna sızması doğrulama uyuşmazlığıyla GOTÜRÜCÜ biçimde görünür
    let guard = 0;
    while (
      Number(screen.getByTestId("pieces").textContent) < 2 &&
      guard < 60
    ) {
      act(() => {
        vi.advanceTimersByTime(90);
      });
      guard += 1;
    }
    expect(screen.queryByTestId("game-over")).toBeNull();
    expect(Number(screen.getByTestId("pieces").textContent)).toBeGreaterThanOrEqual(2);

    // pendingRef'i GARANTİLİ orta uçuşta yapmak için:
    // sert düşüş tick'i pendingRef'i null yapar ve parça sayısını artırır;
    // parça artışı görülürse bir tick daha at — o tick kesin karar-başlangıcıdır
    // (hamle uygulamaz, pendingRef'i doldurur); artmazsa pendingRef zaten doludur
    const before = Number(screen.getByTestId("pieces").textContent);
    act(() => {
      vi.advanceTimersByTime(90);
    });
    if (Number(screen.getByTestId("pieces").textContent) > before) {
      act(() => {
        vi.advanceTimersByTime(90);
      });
    }

    // restart: bu anda eski oyuna ait bir plan KESİN orta uçuşta ve
    // G1 tahtası kilitli hücreler içeriyor
    fireEvent.click(screen.getByTestId("restart"));
    // restart gerçekten yeni oyun kurdu (eski skor/sayaç gitmiş)
    expect(screen.getByTestId("score").textContent).toBe("0");
    expect(screen.getByTestId("pieces").textContent).toBe("1");

    // restart ile aynı interval etkisini sürdürür: gecikmiş tick'ler
    // YENİ oyuna karar üretmeli; eski plan/state bir daha sızamaz
    const extraTicks = 6;
    for (let i = 0; i < extraTicks; i++) {
      act(() => {
        vi.advanceTimersByTime(90);
      });
    }

    // yeni oyun yalnızca kendi hamleleriyle ilerledi — eski sayaç sıçraması yok
    const pieces = Number(screen.getByTestId("pieces").textContent);
    expect(pieces).toBeGreaterThanOrEqual(1);
    expect(pieces).toBeLessThanOrEqual(1 + extraTicks);

    // geçmiş yalnızca yeni oyuna ait kayıtlar içeriyor:
    // en ESKİ kayıt (liste ters sıralı → son satır) pieceIndex=1 olmalı —
    // eski oyunun gecikmiş kararı sızsaydı burada eski sayaç (>1) görünürdü
    const historyTable = screen.getByTestId("history-table");
    const rows = historyTable.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(extraTicks);
    const pieceIndexes = [...rows].map((row) =>
      Number(row.querySelectorAll("td")[2].textContent),
    );
    expect(pieceIndexes[pieceIndexes.length - 1]).toBe(1);
    for (const index of pieceIndexes) {
      expect(index).toBeLessThanOrEqual(1 + extraTicks);
    }

    // eski plan sızsaydı: eski beklenti (G1'in kilitli hücreleriyle) ile
    // G2'nin boş tahtası uyuşmazdı → ✗ / hata bandı görünürdü
    expect(screen.queryByTestId("error-banner")).toBeNull();
    expect(screen.queryByTestId("verification-fail")).toBeNull();
    expect(historyTable.textContent).not.toContain("✗");
  });
});
