# Chrome Web Store — mağaza kaydı / store listing

Yüklenecek paket: `token-tahmin-v0.12.1-magaza.zip` (küçültülmüş; `npm run build` → `dist/`).
Görseller bu klasörde: `icon-128.png`, `en/` ve `tr/` altında 5 ekran görüntüsü (1280×800), küçük tanıtım görseli (440×280) ve büyük tanıtım görseli (1400×560).

---

## 1. Store listing (Mağaza kaydı) sekmesi

**Name / Ad** (manifest'ten otomatik gelir): `Token Forecast for Claude` · TR: `Claude için Token Tahmini`

**Summary / Özet** (manifest'ten otomatik gelir, ≤132 karakter):
- EN: Estimates how much of your Claude usage limit a message will use before you send it, and suggests a cheaper model when one fits.
- TR: Claude'a mesaj göndermeden önce limitinizden ne kadar harcayacağını tahmin eder, uygunsa daha ekonomik model önerir.

**Category / Kategori:** Productivity → Tools (Verimlilik → Araçlar)

**Language / Dil:** English (varsayılan). Türkçe için "Add localized listing / Yerelleştirilmiş kayıt ekle" → Türkçe, aşağıdaki TR açıklama ve `tr/` görselleri.

### Description (EN)

```
Know what a message will cost before you send it.

Token Forecast shows, right next to the claude.ai message box, how much of your 5-hour and weekly Claude usage limit a message will use, before you press send. It also tells you which model and effort level are enough, with the reasons, and learns your plan over time.

BEFORE YOU SEND
• Forecast with an 80% range, based on your prompt, attachments (images, PDF, Word, Excel, text), chat history, model, effort and cache state.
• Reasoned model suggestion: which model is enough, what it looked at and how much you would save. If it is not sure, it never suggests a lighter model.
• Effort suggestion from Low to Max, with the savings when your setting is higher than needed.
• Topic recognition (16 areas). For health, law and money questions it never suggests a light model.
• Cost breakdown, cache countdown and peak-hour countdown.

WHILE YOU WORK
• "At this pace, when does it run out?" for your 5-hour limit.
• Hand-off summary prompt for long chats.
• Threshold notifications (50/75/90%), limit-reset notification and a toolbar badge.

AFTERWARDS
• "Why was that so expensive?" explanations.
• Weekly report: messages, limit spent, model/task/topic/effort mix, hourly heatmap, personal tips, CSV export.

IT LEARNS ON YOUR DEVICE
• Personal calibration of your plan size and typical answer lengths, from your own usage.
• A small on-device task model that learns from your corrections.

PRIVACY
Everything is computed in your browser. Your messages, attachments and chats never leave your device. No server, no analytics, no tracking. It runs only on claude.ai with your own session and never sends messages or changes settings for you. It asks for your consent before reading anything.

LANGUAGES
Interface in 10 languages: English, Turkish, German, French, Spanish, Italian, Portuguese, Russian, Japanese, Chinese. Message analysis (task, topic, model and effort suggestions) currently works for English and Turkish messages; in other languages you get the token and limit forecast without suggestions.

Open source (GNU AGPL-3.0): https://github.com/H-ENES1/token-tahmin
Website: https://h-enes1.github.io/token-tahmin/

Token Forecast is an independent project and is not affiliated with Anthropic. "Claude" is a trademark of Anthropic PBC. Anthropic does not publish exact limit sizes, so forecasts are estimates that improve as the extension measures your usage.
```

### Açıklama (TR)

```
Bir mesajın ne kadar limit harcayacağını göndermeden önce bil.

Token Tahmini, claude.ai mesaj kutusunun hemen yanında, bir mesajın 5 saatlik ve haftalık Claude limitinin ne kadarını kullanacağını sen göndermeden önce gösterir. Hangi model ve effort seviyesinin yeteceğini gerekçesiyle söyler ve zamanla planını öğrenir.

GÖNDERMEDEN ÖNCE
• %80 aralıklı tahmin: istem, ekler (görsel, PDF, Word, Excel, metin), sohbet geçmişi, model, effort ve önbellek durumuna göre.
• Gerekçeli model önerisi: hangi modelin yettiği, neye baktığı ve ne kadar kazandıracağı. Emin değilse hafif model önermez.
• Düşükten Maksimuma effort önerisi; ayarın gerekenden yüksekse kazancı.
• Konu tanıma (16 alan). Sağlık, hukuk ve para sorularında hafif model önermez.
• Maliyet dökümü, önbellek ve yoğun saat geri sayımı.

ÇALIŞIRKEN
• 5 saatlik limit için "bu hızla ne zaman dolar?".
• Uzun sohbetler için devir özeti istemi.
• %50/75/90 eşik bildirimleri, "limit yenilendi" bildirimi ve araç çubuğu rozeti.

SONRA
• "Neden bu kadar harcadı?" açıklaması.
• Haftalık rapor: mesaj sayısı, harcanan limit, model/iş/konu/effort dağılımı, saat haritası, kişisel öneriler, CSV dışa aktarma.

CİHAZINDA ÖĞRENİR
• Kendi kullanımından plan büyüklüğünü ve tipik cevap uzunluklarını öğrenen kişisel kalibrasyon.
• Düzeltmelerinden öğrenen küçük, cihaz içi iş türü modeli.

GİZLİLİK
Her şey tarayıcında hesaplanır. Mesajların, eklerin ve sohbetlerin cihazından çıkmaz. Sunucu yok, analitik yok, izleme yok. Yalnızca claude.ai'de, kendi oturumunla çalışır; senin yerine mesaj göndermez, ayar değiştirmez. Bir şey okumadan önce onayını ister.

DİLLER
10 dilde arayüz: Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, İtalyanca, Portekizce, Rusça, Japonca, Çince. Mesaj analizi (iş türü, konu, model ve effort önerileri) şimdilik Türkçe ve İngilizce mesajlarda çalışır; diğer dillerde öneri olmadan token ve limit tahmini alırsın.

Açık kaynak (GNU AGPL-3.0): https://github.com/H-ENES1/token-tahmin
Web sitesi: https://h-enes1.github.io/token-tahmin/

Token Tahmini bağımsız bir projedir, Anthropic ile bağlantılı değildir. "Claude", Anthropic PBC'nin ticari markasıdır. Anthropic limit büyüklüklerini yayımlamadığı için tahminler yaklaşıktır ve eklenti kullanımını ölçtükçe iyileşir.
```

**Graphic assets / Görseller**
- Store icon: `icon-128.png`
- Screenshots (1280×800): `en/screenshot-1…5.png` (TR kaydı için `tr/…`)
- Small promo tile (440×280, zorunlu): `en/promo-small-440x280.png`
- Marquee promo tile (1400×560, isteğe bağlı): `en/promo-marquee-1400x560.png`

**Additional fields / Ek alanlar**
- Official URL: (boş bırak; doğrulanmış alan adı gerekir)
- Homepage URL: `https://h-enes1.github.io/token-tahmin/`
- Support URL: `https://github.com/H-ENES1/token-tahmin/issues`
- Mature content: No

---

## 2. Privacy practices (Gizlilik uygulamaları) sekmesi

**Single purpose / Tek amaç** (EN olarak yapıştır):
```
Token Forecast helps claude.ai users manage their own Claude usage limits. On claude.ai it estimates, before a message is sent, how much of the user's 5-hour and weekly limit the message will use, suggests a model and effort level that are sufficient for the task, and shows usage reports. All processing happens locally in the browser. It does not bypass, change or extend any limit and does not automate any action on claude.ai.
```

**Permission justifications / İzin gerekçeleri:**
- `storage`:
  ```
  Stores the user's settings, learned calibration numbers and a text-free log of sends (numbers and labels only) locally in chrome.storage.local, so forecasts improve over time and the weekly report can be shown. Nothing is synced or sent anywhere.
  ```
- `alarms`:
  ```
  Periodically refreshes the user's usage percentages from claude.ai (every few minutes) and schedules the weekly report notification and limit-reset notifications.
  ```
- `notifications`:
  ```
  Shows optional notifications when the user's usage reaches the thresholds they set (50/75/90%), when a limit resets, and when the weekly report is ready. Can be turned off in settings.
  ```
- Host permission `https://claude.ai/*`:
  ```
  The extension only works on claude.ai. It shows the forecast next to the message box, reads the text and attachments in the message box locally to count tokens, reads the open chat's history length for cache/context calculations, and reads the user's usage percentages from claude.ai using the user's own session. No other site is accessed.
  ```

**Remote code / Uzak kod:** `No, I am not using remote code.` (Tüm JavaScript paketin içinde; dışarıdan kod yüklenmiyor.)

**Data usage / Veri kullanımı** — Chrome'un tanımına göre veri cihazda işlense bile "handled" sayılıyor ve bildirilmesi gerekiyor. İşaretlenecekler:
- ✅ **Personal communications** (kişisel iletişim): mesaj kutusundaki metin ve sohbet geçmişi, yalnızca token saymak için yerelde okunur.
- ✅ **Website content** (web sitesi içeriği): claude.ai sayfasındaki model/effort seçici ve kullanım yüzdeleri.
- ⬜ Diğerleri (kişisel bilgi, sağlık, finans, kimlik doğrulama, konum, web geçmişi, kullanıcı etkinliği) işaretlenmez.

Üç beyanın üçünü de işaretle:
- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://h-enes1.github.io/token-tahmin/privacy.html`

---

## 3. Distribution (Dağıtım) sekmesi
- Payments: Free
- Visibility: Public (ilk yayında istersen "Unlisted" seçip yalnızca bağlantıyla paylaşabilirsin)
- Regions: All regions

## 4. Test instructions (İnceleyiciye notlar)
"Test instructions" alanı varsa:
```
The extension only runs on https://claude.ai and requires a logged-in Claude account (a free account works). After installing, a consent page opens; click "Agree and start". Then open claude.ai, start typing in the message box: a small pill with the forecast appears above the box; click it for details. The toolbar popup shows the usage limits. No test credentials are needed from us; any Claude account can be used. The source code is public: https://github.com/H-ENES1/token-tahmin
```
