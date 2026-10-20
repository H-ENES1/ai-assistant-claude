# CLAUDE.md — Claude için Token Tahmini

Chromium (Chrome/Opera) Manifest V3 eklentisi. claude.ai'de bir mesajı göndermeden önce 5 saatlik/haftalık limitin ne kadarının harcanacağını tahmin eder, uygun model/effort önerir, limit bitmeden uyarır. Türkçe + İngilizce. Sahibi: Üstad (öğrenci, sıfır bütçe, ücretli API yok). Kullanıcıyla Türkçe konuş.

## Yapı

```
extension/              ← tarayıcıya yüklenen klasör (manifest.json burada)
  background.js         service worker; kullanım okuma, bildirim, rozet, kalibrasyonun TEK yazıcısı
  inject/hook.js        MAIN world; fetch'i sarar, cevap akışından (SSE) kullanımı okur
  content/content.js    sayfa mantığı: prompt/ek okuma, tahmin, panel (hap), onSend/onDone
  popup/                popup + tam sayfa "Ayrıntılar" (popup.html?view=tab)
  lib/                  usage, tokens, classify, forecast, calibrate, conversation,
                        attachments, context, page, i18n, panel
  _locales/{en,tr}/     tüm kullanıcı metinleri
tests/                  unit.test.mjs, rec.mjs (+rec-cases.json), e2e.cjs (Playwright)
```

## Testler (her değişiklikten sonra çalıştır)

```
cd tests && npm install
npm run test   # birim (15 test)
npm run rec    # model önerisi, 50 prompt: beklenen ≥ %96, "gerekenden hafif öneri" = 0 olmalı
npm run e2e    # Playwright, sahte claude.ai (25 kontrol); chromium /opt/pw-browsers'ta
```

## Kurallar

- **TR ve EN birlikte:** Her yeni metin `_locales/en` ve `_locales/tr` dosyalarına aynı anahtarla eklenir. Anahtar sayıları eşit kalmalı.
- **Gizlilik (pazarlık yok):** Mesaj metni, ek ve sohbet içeriği cihazdan çıkmaz. Dışarı hiçbir istek atma; yalnızca claude.ai'nin kendi API'lerine kullanıcının oturumuyla istek.
- **Hafif model önerme hatası en kötü hata:** Tip belirsizse (confidence low) ve 8 kelimeden uzunsa Haiku önerilmez. Öneri değişikliğinde `rec-cases.json` yeni örneklerle genişlet.
- **Kalibrasyon verisi kutsaldır:** `calib`, ayarlar, sohbet etkinliği `chrome.storage.local`'da. Şema değişirse `CALIB_VERSION` artır ve eski veriyi taşı; sessizce silme.
- **Belgelenmemiş API:** claude.ai iç API'leri ve seçiciler değişebilir. Kırılgan yerler: `lib/usage.js`, `lib/page.js`, `lib/conversation.js`, `inject/hook.js`. Seçici ekleme/çıkarma yaparken listeleri koru, tek seçiciye bağlama.
- **Kopya yok:** lugia19/Claude-Usage-Extension GPL-3.0'dır; koddan kopyalama. Yalnızca ölçümler kaynak gösterilerek kullanılır (README'deki atıflar kalsın).
- Sürümü `manifest.json`'da artır, README'nin başlığıyla eşle. Minimum Chrome 116.
- Sayı biçimi: `lib/i18n.js` (`pct`, `num`); yüzde gösteriminde `!(x>0)→0`, küçük değerler 2 ondalık.

## Bilinen durum

- Gerçek claude.ai'de seçiciler (model, effort, ek kutusu, mesaj kutusu) **doğrulanmadı**; sahte sayfayla test edildi. Bunu kullanıcı yapar, sen değil.
- Öneri kalitesi (Haiku gerçekten yeterli mi) ölçülmedi. Sınıflandırıcı doğruluğu ~%80. Plan limit büyüklükleri (k) kaba önsel.
- Lisans: kullanıcı karar verecek (MIT önerildi). Karar gelene kadar LICENSE ekleme.

## Yapılacaklar (öncelik sırasıyla; her biri ayrı commit/PR)

1. **Sağlık ekranı:** Ayrıntılar sayfasında kontrol listesi (model/effort/ek kutusu/mesaj kutusu seçicileri bulundu mu, kullanım okunuyor mu, kalibrasyon kaç ölçüm).
2. **"Verimi içe aktar":** Mevcut "dışa aktar"ın tersi; şema/sürüm doğrula, birleştirme değil üzerine yazma ve onay iste.
3. **Devir özeti ("Yeni sohbete taşı"):** Uzun sohbette bağlam/önbellek uyarısı çıkınca özet metnini panoya kopyala (yerelde, sunucuya gönderme).
4. **Kör kalite testi sayfası:** Aynı promptun farklı model cevaplarını kullanıcı etiketsiz değerlendirsin; sonuç öneri eşiklerini ayarlamak için yerel kaydedilsin.
5. **Öneriden öğrenme:** Kullanıcı "yetmedi" derse o tip için MIN_TIER yükselt (yalnızca yukarı).
6. **Hapı gizleme seçeneği** ve haftalık rapor (yerel).
7. **Mağaza hazırlığı:** gizlilik politikası, mağaza açıklaması (TR/EN), ekran görüntüleri, Firefox sürümü.
8. Tek tıkla model değiştirme: kırılgan, en sona; yapılırsa seçici yoksa sessizce gizle.
