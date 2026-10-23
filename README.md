# AI Tetris Lab

Tarayıcıda çalışan, insan tarafından oynanabilen, hamlelerini kendisi seçebilen
ve karar süreci canlı olarak incelenebilen bir Tetris AI laboratuvarı.

- **Oyun motoru** (`src/engine`): kuralların tek doğruluk kaynağı. Saf (immutable)
  fonksiyonlar; tohumlanabilir 7'lik torba rastgeleliği.
- **Kural tabanlı ajan** (`src/agent`): aday üretici, hamle simülatörü, tahta
  değerlendirici, sezgisel arama, karar kaydı ve doğrulama.
- **Q-learning ajanı** (`src/qlearning`): ayrık durum özellikleri, ödül
  fonksiyonu, epsilon-greedy, sürümlü Q tablosu, durdurulabilir eğitmen.
- **Deney laboratuvarı** (`src/lab`): aynı tohumla çoklu oyun, ortalama/medyan,
  satır dağılımı, süre ve oyun sonu oranı.
- **Arayüz** (`src/ui`): oyun tahtası, açıklanabilir karar paneli, eğitim ve
  deney panelleri.

## Kurulum

Gereksinimler: Node.js 20+ ve npm.

```bash
npm install
```

## Komutlar

```bash
npm run dev        # geliştirme sunucusu (Vite)
npm run build      # typecheck + üretim derlemesi
npm run test       # Vitest testleri (tek koşum)
npm run test:watch # Vitest izleme modu
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (strict)
npm run format     # Prettier
```

## Kullanım

1. `npm run dev` → tarayıcıda `http://localhost:5173` açılır.
2. **Başlat** ile oyunu çalıştırın. **Ajan: AÇIK** iken ajan adım adım oynar;
   her parça için karar paneli güncellenir.
3. **Tek Hamle** ile duraklatılmış oyunda ajanı parça parça ilerletin.
4. **Ajan: KAPALI** iken klavyeyle oynayın: ← → hareket, ↑/X döndürme,
   Z ters döndürme, ↓ yumuşak düşüş, boşluk sert düşüş, P duraklat, R yeniden
   başlat.
5. **Kararlar** sekmesi: aday sıralaması, her ölçütün puana katkısı, simüle
   edilmiş tahta, seçim gerekçesi ve simülasyon-motor doğrulama rozeti. Geçmiş
   satırına tıklayınca o kararın girdileri incelenir.
6. **Eğitim** sekmesi: bölüm sayısı, tohum, α/γ/ε ve parça sınırı girin;
   **Eğitimi Başlat** ile Q-learning başlar, **Durdur** ile yarım kalır
   (kısmi veri açıkça işaretlenir). Q tablosunu JSON olarak kaydedin/yükleyin;
   uyumsuz veya bozuk dosyalar açık hata mesajıyla reddedilir.
7. **Deneyler** sekmesi: kural tabanlı ve Q-learning ajanlarını aynı tohum
   dizisiyle çoklu oyunla karşılaştırın. Tüm grafikler yalnızca kayıtlı
   ölçümlerden üretilir; veri yoksa "veri yok" yazar.

## Ajan kararı nasıl açıklanır?

Her karar kaydında:
- parçanın yönü (rotation) ve sütunu (column),
- simüle edilmiş son tahta,
- temizlenen satır, delik, sütun yükseklikleri, tepe yükseklik, düzensizlik,
- kullanılan ağırlıklar ve her ölçütün (ağırlık × ölçüt) katkısı,
- toplam puan ve sıralama gerekçesi,
- **doğrulama**: seçilen hamle motorla uygulandıktan sonra tahta parmak izi ve
  temizlenen satır sayısı simülasyonla karşılaştırılır; uyuşmazlık varsa hata
  görünür kılınır, ajan sessizce başarılı sayılmaz.

Eşit puanlar deterministik biçimde çözülür: daha yüksek satır sayısı, sonra
küçük döndürme, sonra küçük sütun.

## Q-learning ayrıntıları

- Durum özellikleri (`state-v1`): toplam yükseklik, delik, tepe yükseklik ve
  düzensizlik sepetleri + parça tipi. Sürümlü anahtar; uyumsuz tablolar reddedilir.
- Eylem uzayı: ulaşılabilir (döndürme, sütun) adayları — motor hamleleriyle
  gerçekten ulaşılan konumlar.
- Ödül (`reward-v1`): satır×50 (+tetris 200) − delik artışı×12 − tepe
  artışı×2 − oyun sonu 200.
- Q güncellemesi: `Q(s,a) += α(r + γ·max Q(s',·) − Q(s,a))`; terminalde
  gelecek terimi yoktur.
- Keşif: epsilon-greedy, tohumlanabilir RNG; değerlendirme modunda keşif kapalı.
- Sonuçlar varsayılmaz: Q-learning'in başarısı deney sekmesindeki ölçümlerle
  doğrulanmalıdır.

## Mimari notlar

- Motor, ajan, öğrenme ve arayüz bağımsız modüllerdir; arayüz kuralları
  yeniden uygulamaz.
- Tüm motor fonksiyonları saftır; aynı tohum → aynı parça dizisi → aynı oyun.
- Eğitim, arayüzü kilitlemez (bölüm aralarında tarayıcıya kontrol verir).
- Karar kayıtları ile eğitim verisi ayrı tutulur.
- Gerçek ölçüm olmayan hiçbir değer canlı metrik olarak gösterilmez.

## Bilinen sınırlar

- Döndürme sistemi basit duvar tekmeleri kullanır (tam SRS değildir).
- Ajan, parçanın doğuş konumundan itibaren plan yapar; ara yerçekimi adımı
  ajan modunda uygulanmaz (hamleler görünür adım adım uygulanır).
- Q-learning seyrek tablo kullanır; büyük eğitim koşularında durum uzayı
  büyüyebilir (panelde gerçek sayaçlar gösterilir).
