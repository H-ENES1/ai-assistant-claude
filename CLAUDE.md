# CLAUDE.md — Token Tahmini / Token Forecast

Chromium (Chrome/Opera) Manifest V3 eklentisi. claude.ai'de bir mesajı göndermeden önce 5 saatlik/haftalık limitin ne kadarının harcanacağını tahmin eder, uygun model/effort önerir, limit bitmeden uyarır. Türkçe + İngilizce. Sahibi: Üstad (öğrenci, sıfır bütçe, ücretli API yok). Kullanıcıyla Türkçe konuş.

## Yapı

```
extension/              ← tarayıcıya yüklenen klasör (manifest.json burada)
  background.js         service worker; kullanım okuma, bildirim, rozet, kalibrasyonun TEK yazıcısı
  inject/hook.js        MAIN world; fetch'i sarar, cevap akışından (SSE) kullanımı okur
  content/content.js    sayfa mantığı: prompt/ek okuma, tahmin, panel (hap), onSend/onDone
  popup/                popup + tam sayfa "Ayrıntılar" (popup.html?view=tab)
  lib/                  usage, tokens, classify, forecast, calibrate, conversation,
                        attachments, context, page, i18n, panel, advisor (model önerisi), config (bağlantılar),
                        report (haftalık rapor, harcama hızı, "neden bu kadar"), learn + learn-weights (öğrenen model),
                        contrib (topluluk katkısı + birleştirme), community-priors (topluluk önselleri; aggregate üretir)
  popup/report.*        haftalık rapor sayfası
  lib/eco.js            kurtarılan su ve enerji: kaçınılan işlem → token → Wh → mL, birim seçimi (rapor-su)
  _locales/{en,tr}/     tüm kullanıcı metinleri
tests/                  unit, learn, report, contrib, advisor (+rec-cases.json) testleri, e2e.cjs (Playwright, 43 kontrol)
tests/ml/               train.tsv (600), test.tsv + test2.tsv (120+120, ayrı yazılmış), train.mjs (eğit + karşılaştır)
tools/                  build-release.mjs (küçültülmüş mağaza paketi), aggregate.mjs (topluluk katkılarını birleştir)
.github/ISSUE_TEMPLATE/ katki.yml (topluluk verisi), anket.yml, hata.yml
site/                   index.html (tanıtım sitesi, tek dosya) + build/ (kaynak, demo motoru esbuild ile gömülür)
```

## Testler (her değişiklikten sonra çalıştır)

```
npm install   # kökte: esbuild + playwright
npm run test   # birim + öğrenme + rapor + katkı + model önerisi (60 prompt: uygunluk ≥ %96, "gerekenden hafif öneri" = 0 olmalı)
node tests/ml/train.mjs   # sınıflandırıcıyı yeniden eğit; test2'de karma < kurallar olursa ağırlıkları YAZMA (--no-write)
npm run e2e    # Playwright, sahte claude.ai (69 kontrol). PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 şart (0.12.2'den beri e2e.cjs kendisi ayarlar):
               # yoksa arka plan servisinin istekleri sahte sunucuya gitmez ve 4-5 kontrol yanlışlıkla kırmızı olur.
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

- Gerçek claude.ai'de (Ekim 2026) doğrulandı: mesaj kutusu, model ve effort seçicileri, kullanım okuma, sayfa yoluyla ölçüm (v0.9.5'te 3 ölçüm). claude.ai mesajı bir Web Worker'dan gönderiyor; fetch kancası gönderimi görmez, asıl ölçüm yolu sayfa yapısıdır (content.js domTick). Uzun sohbetlerde eski mesajlar sayfadan kaldırılır: mesaj SAYISINA güvenme.
- Öneri kalitesi (Haiku gerçekten yeterli mi) ölçülmedi. Plan limit büyüklükleri (k) kaba önsel (topluluk önselleri gelene kadar).
- Lisans (22.10.2026 kararı): GNU AGPL-3.0-or-later (LICENSE, NOTICE). Kod açık kaynak; ad ve logo lisans dışı (AGPL madde 7(e), NOTICE). Derlenmiş JS dosya başlığında SPDX ve kaynak adresi var (https://github.com/H-ENES1/ai-assistant-claude; depo 23.10.2026 tarihinde ai-assistant-claude olarak yeniden adlandırıldı). Önceki "tüm hakları saklı" kararı ve BSL fikri terk edildi.
- Sınıflandırıcı: test2 (gündelik dil) kurallar %64 → karma %88. Gerçek kullanıcı mesajlarıyla ölçülmedi.
- Topluluk verisi: claude.ai artifact veritabanına kuruluş dışı ziyaretçi yazamıyor; bu yüzden GitHub konu formu (katki.yml) + tools/aggregate.mjs. Katkı metin içermez (contrib.test.mjs bunu denetler).

## Yapılacaklar (öncelik sırasıyla; her biri ayrı commit/PR)

1. ~~Sağlık ekranı~~ (0.9.2) · ~~Verimi içe aktar~~ (0.9.6) · ~~Gerekçeli model önerisi~~ (0.9.6)
2. Mağaza hazırlığı (Chrome Web Store, Firefox), GitHub sürümleri; config.js'e SUPPORT_URL / PROJECT_URL.
3. ~~Devir özeti~~ (0.10.0: kartta "Devir özeti istemini kopyala").
4. **Kör kalite testi sayfası:** Aynı promptun farklı model cevaplarını kullanıcı etiketsiz değerlendirsin; sonuç öneri eşiklerini ayarlamak için yerel kaydedilsin.
5. ~~Öneriden öğrenme~~ (0.9.6: 👍/👎 → tip başına taban/tavan, lib/advisor.js applyFeedback)
6. ~~Haftalık rapor~~ (0.10.0) · **Hapı gizleme seçeneği**.
7. Fikirler: model başına haftalık tavan (Max'te Fable) önerinin içinde; kullanım kredisi (extra usage) gösterimi; saatlik kullanım ısı haritası; yoğun saat dışına "sonra gönder" hatırlatıcısı.
8. Tek tıkla model değiştirme: kırılgan, en sona; yapılırsa seçici yoksa sessizce gizle.

## 0.11.0 (22.10.2026)
- **Konu alanı** `lib/domain.js`: 17 alan + alt başlıklar, 173 kural (TR kökler başta sınırlı, EN tam sınırlı). İş türü ipucu yalnızca kurallar ve öğrenen model aynı türdeyse. Test: `tests/domain.test.mjs` (set 1 geliştirme, set 2 görüldü, set 3 neredeyse kör: ilk ölçüm %72 kabul edilebilir / 6 yanlış alan; 4 tetikleme hatası düzeltildi → %71 / 1). Yeni sözlük eklerken set 3'e bakarak ekleme YAPMA; yeni kör set yaz.
- **Effort** `lib/effort.js`: öneri (iş türü + alan profili + karmaşıklık + kişisel effOff), `compareEffort` (düşür/yükselt, tasarruf = düşünme payı × (1 − oran)), `applyEffortFeedback`. Model desteği `forecast.js` MODELS[].eff (def, x). Okunamayan effort → modelin varsayılanı (`fc.effortAssumed`). Kaynaklar: Anthropic effort belgesi + destek makalesi 8664678.
- **Hap** sürüklenebilir (`pillOffset`, varsayılan yere göre fark), Alt+ok, kartta sıfırlama; claude.ai menüsü üstüne açılınca `.yield` ile gizlenir.
- **Rapor**: alan/alt başlık/effort dağılımı, `tip_effort_over`, `tip_domain_save`, `tip_domain_stakes`; CSV'de domain, subdomain, effort_suggested.
- Bilinen eksik: alan sözlüğü "genel"e düşmede zayıf (set 3'te %21). Sonraki adım: alan için de öğrenen model (learn.js altyapısı) ya da kullanıcı düzeltmesi.

## 0.11.1 (22.10.2026)
- **Görev–konu koruması** `lib/classify.js`: "site yaptırıcam, zor iş, cümlede çeviri geçiyor" gibi cümlelerde konu kelimesi (çeviri/özet) iş türünü belirlemesin. BUILD/FEATURE/DIRECT kalıpları, hafif tür skorları ×0.15, code_write +2.6. Test: `tests/traps.test.mjs` (15 tuzak cümle Haiku olmamalı, 5 gerçek çeviri/özet Haiku kalmalı).
- **Öğrenme kanıtı**: `lib/report.js learningCurve` (ilk 10 vs son 20 ölçüm, ≥30 ölçüm gerekir, eşikler 0,87/1,15) + rapor sayfasında "Öğrenme kanıtı" bölümü. Simülasyon: `npm run proof` (200 sanal kullanıcı; öğrenen 2,04→1,40 kat blok hatası, öğrenmeyen ~2,1–2,2, kusursuz-bilgi tabanı 1,67→1,37). Tek mesaj hatası ~1,7 katın altına inemiyor. `npm run proof:classifier`: kişisel sınıflandırıcı düzeltmesi ölçülebilir kazanç vermedi.
- **Site**: TR/EN ekran görüntüleri `site/img/{tr,en}` (`tests/site-shots.cjs` üretir), dil değişince görseller değişir; demoda alan ve effort; kanıt grafiği; Tiko botu (turuncu piksel bot, fareyle bloğa konar). Site derleme: `site/build/build.py`. Tanıtım videosu 47 sn, TR/EN, kare ve dikey (site/build/video, anim3.html + rec3.cjs). standalone.html görselleri (WebP) ve videoyu gömer, tek başına açılır.

## 0.11.2 (22.10.2026)
- **Görünüm anahtarları**: ayar anahtarları `advisor` (model önerisi), `effortAdvice`, `tips` (önbellek/yoğun saat/uzun sohbet/devir özeti), `explain` (harcama açıklaması); hepsi varsayılan açık. Popup'ta "Görünüm: Tam / Sade / Özel" bunları toplu değiştirir. Limit, bağlam ve ek uyarıları her zaman görünür. Not: `advisor` kapalıyken artık pill içindeki model öneri satırları da gizlenir (önceden yalnızca bildirim kartı gizleniyordu).
- e2e'ye ağ denetimi eklendi: yalnızca claude.ai'ye GET, tek POST sayfanın kendi /completion isteği.

## 0.12.0 (22.10.2026) — 10 dil
- Arayüz dilleri: tr, en, de, fr, es, it, pt (pt_BR), ru, ja, zh (zh_CN). Eklenti: `extension/_locales/<dir>/messages.json` (477 anahtar), `lib/i18n.js` içindeki `LANGS`. Site: `site/build/l10n/<dil>.json` (build.py `/*SITEL10N*/` ile gömer), kaynak çeviriler `tools/i18n/`.
- Mesaj analizi (iş türü, konu, model/effort önerisi) yalnızca TR ve EN için; diğer dillerde `textLanguage()` → other/cyrillic/cjk, eklenti nötr sınıf kullanır, öneri yok, "dil sınırlı" uyarısı gösterir. Token tahmini dile göre ayarlı (OTHER_LATIN 1.22, CYRILLIC 1.54, CJK 0.73 token/karakter; az örnekle ölçüldü).
- Video ve ekran görüntüleri yalnızca TR/EN; diğer diller İngilizcesini görür.
- Mağaza açıklaması (extDescription) ≤ 132 karakter, tüm dillerde (tests/lang.test.mjs denetler).
- Çeviriler makine çevirisidir, anadili konuşan biri gözden geçirmedi.
- Site hatası düzeltildi: İngilizce SSS a1–a5 yerine ekran görüntüsü alt metni görünüyordu (anahtar çakışması → alt1–alt5).
- Lisans AGPL-3.0'a geçti (yukarıdaki not). Site SSS a7 ve altbilgi 10 dilde güncellendi.

## 0.12.1 (23.10.2026) — Mağaza hazırlığı
- **Açık onay** (`lib/consent.js`, `popup/welcome.*`): Chrome Web Store 2026 kuralı, veri cihazda işlense bile ne okunduğunu eklenti içinde gösterip onay almayı şart koşuyor. Kurulumda (ve onaysız güncellemede) karşılama sayfası açılır; onay yokken content.js yalnızca "aç" düğmesi gösterir, arka plan kullanım okumaz. Okunan veri türleri değişirse `CONSENT_VERSION` artır. e2e bunu denetler (64 kontrol).
- Bağlantılar dolduruldu: PROJECT_URL, CONTRIB_URL (katki.yml), FEEDBACK_URL (new/choose), PRIVACY_URL; sitede CONTRIB_URL, SURVEY_URL (anket.yml), RELEASES_URL. manifest `homepage_url`.
- Gizlilik politikası: `site/build/static/privacy.html` → Pages'te `/privacy.html`.
- Mağaza metinleri ve görselleri: `store/`.

## Chrome Web Store (28.10.2026)
- Yayında: https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige ("Token Forecast for Claude", 0.12.1). Sitedeki "Chrome'a ekle" düğmeleri (10 dil), README'ler ve yapısal veri (installUrl) bu adrese gider; elle kurulum (zip) ikinci seçenek olarak kaldı.
- Güncelleme: manifest sürümünü artır → main'e gönder (GitHub sürümü otomatik) → `tools/build-release.mjs` mağaza zip'i → geliştirici panelinde Paket → Yeni paket yükle → İncelemeye gönder.

## 0.12.2 (11.11.2026) — Fable 5.2
- **Fable 5.2** (`claude-fable-5-2`, 1M bağlam, Opus 4.7 tokenizer'ı): `forecast.js` MODELS, aile varsayılanı ve öneri etiketi; `advisor.js`, `context.js`. Ağırlık 10 = 5.1 ile aynı **varsayım** (API fiyatı $8/$40, 5.1 $10/$50; abonelik limitindeki ağırlığı yayımlanmadı, kalibrasyon düzeltir). claude.ai'de varsayılan effort medium (API'de high).
- **Fable payı** `lib/usage.js familyWindow`: claude.ai Fable'a özel haftalık pencere döndürürse (anahtar adı bilinmiyor: seven_day_fable, seven_day_fable_models, seven_day_fable_5_2 ya da adında "fable" geçen her seven_day_*; alt nesnedeki pencereler düzleştirilir) Fable seçiliyken hapta ve popup'ta "Fable payı: %X"; %80'i (`FAMILY_SHARE_WARN_PCT`) geçince "Fable payın dolmak üzere, Opus 5.5'e geç" (limit uyarısı sayılır). Pencere yoksa hiçbir şey gösterilmez. `seven_day_opus` Fable sayılmaz.
- Kaynak notu: "Pro'da Fable haftalık limitin %50'si" kuralı anthropic.com'da "**up to** 50%" ve destek makalesi 17506494'e göre **9–16 Kasım 2026 lansman promosyonu** (Pro + standart Team). Bu yüzden metinlerde oran ve plan adı yok; gösterge yalnızca claude.ai'nin döndürdüğü pencereye bağlı.
- Gerçek claude.ai cevabında Fable penceresinin anahtar adı **doğrulanmadı**: ilk fırsatta Pro hesapla /usage cevabına bak, farklıysa `FAMILY_WINDOW_KEYS`'e ekle.
- `tokens.js`: CJK_PER_CHAR (0,73) o200k ile ölçülmüş (b789b13); CLAUDE_FACTOR CJK'ya uygulanmaya devam.
- e2e: sahte /usage `seven_day_fable` %85; 5 yeni kontrol (toplam 69). `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` artık e2e.cjs içinde ayarlanıyor: Windows'ta npm betikleri cmd.exe ile çalıştığı için `VAR=1 node …` önekli betik orada bozuluyordu.
- Ortam: Node 22 LTS kullan. Node 26'da Playwright 1.56'nın tarayıcı kurulumu bozuluyor (`fs.rmdir` `recursive` seçeneği kaldırıldı).

## rapor-su: "Bu hafta kurtardığın su ve enerji" (14.11.2026, dal: rapor-su; sürüm Prompt C'de 0.13.0 ile)
- **Ne:** Haftalık raporda (`popup/report.*`, çizim `popup/report-eco.js`) kabul edilen daha hafif model / daha düşük effort önerileriyle kaçınılan işlemin su ve enerji karşılığı; "kurduğundan beri" toplamı ayrı. Hesap `lib/eco.js` (saf fonksiyonlar), test `tests/eco.test.mjs` (79 kontrol) + `tests/rapor-su.e2e.cjs` (33 kontrol, `npm run e2e` içinde), ekran görüntüleri `tests/shots/rapor-su/` (`git add -f`).
- **Formül:** `token = kaçınılan işlem ÷ 10` (Sonnet 5.5 çıktı tokenı eşdeğeri; 1 çıktı tokenı = ağırlık 2 × 5 = 10 maliyet birimi), `E = token × e_token`, `W = E × WUE`. Her sayı DÜŞÜK / ORTA / YÜKSEK aralıklı ve "tahmin" etiketli. Model başına enerjinin limit ağırlığıyla (API fiyatı) orantılı olduğu **varsayım**dır; Anthropic, Claude için enerji/su rakamı yayımlamıyor.
- **Katsayılar ve kaynakları** (değiştirirsen `lib/eco.js`, rapor dipnotu `ecoSources` (10 dil), sitedeki `ecF` (10 dil) ve bu liste birlikte değişir):
  - `e_token` 0,6 / 1,3 / 3,0 mWh. Düşük: Epoch AI, J. You, 7.2.2025, "How much energy does ChatGPT use?" (GPT-4o, 500 çıktı tokenı ≈ 0,3 Wh). Yüksek: Jegham ve ark. 2025, arXiv:2505.09598v5, Tablo 4 (Claude 3.7 Sonnet: 0,950 Wh @ 100/300 token, 2,989 Wh @ 1.000/1.000). Orta: ikisinin geometrik ortası, ölçüm değil. Karşılaştırma: Google 2025, arXiv:2508.15734 (medyan Gemini istemi 0,24 Wh; token sayısı açıklanmadı).
  - `WUE` 3,6 / 4,2 / 5,3 L/kWh = yerinde ÷ PUE + elektrik üretimi. Düşük: Li ve ark. 2023, arXiv:2304.03271 (CACM 2025), ABD ortalaması 0,55 + 3,14. Orta: Google yerinde 1,15 (PUE 1,09; arXiv:2508.15734) + 3,14. Yüksek: Jegham ve ark. Tablo 1, Anthropic/AWS 0,18 (PUE 1,14) + 5,11.
  - Karşılıklar: damla 0,05 mL (metrik damla, 20 damla/mL); çay kaşığı 5 mL (ABD 21 CFR 101.9(b)(5)(viii)); su bardağı 250 mL, şişe 0,5 L, kova 10 L (anma boyutu, tanım); küvet 136 L (USGS Water Science School, "full tub" 36 galon); telefon şarjı 19 Wh (US EPA Greenhouse Gas Equivalencies Calculator, 0,019 kWh/şarj); LED 9 W ≈ 800 lümen (US FTC, "Shopping for Light Bulbs", 8.2023); çaydanlık 93 Wh = 1 L suyu 20→100 °C ısıtmak (c = 4,186 kJ/kg·K, kayıpsız).
- **Kaçınılan işlem nasıl bulunur** (`eco.js draftDelta`, `content.js ecoOf`): mesaj kutusu doluyken sayfadan ilk okunan model + effort ("taslağın başı") ile gönderilen ayar arasındaki tahmini maliyet farkı (aynı tahmin motoru, iki ayarla). Daha hafife geçiş yalnızca o taslakta eklenti bunu önerdiyse ve **önerilen seviyeye kadar** sayılır (önerilenden hafife inmek kutlanmaz: hafif model önermek en kötü hata); daha ağıra geçiş her zaman düşülür (negatif). Sohbet ortasında model değişince baştan okunan geçmiş düşülür (advisor.js ile aynı varsayım). Yalnızca ayarın değiştiği mesaj sayılır, sonraki mesajlar sayılmaz (temkinli). Model sayfadan okunamadıysa kayıt sayılmaz; effort okunamadıysa effort farkı sayılmaz.
- **Veri:** gönderim kaydına iki alan eklendi: `ecoU` (işaretli maliyet birimi) ve `ecoK` (`model` / `effort` / `both`); yeni depo anahtarı `eco` = kurulumdan beri sayaç `{ v, since, n, gainU, gainN, extraU, extraN }` (gönderim kayıtları 70 günde silindiği için ayrı; yedeğe girer). Metin yok, yeni okunan veri yok, `CONSENT_VERSION` ve `CALIB_VERSION` değişmedi. Alanı olmayan eski kayıtlar "sayılmamış"tır; sayım bu sürümle başlar ve raporda başlangıç tarihi yazar.
- **CSV:** `avoided_tokens_eq, avoided_by, energy_wh_low/mid/high, water_ml_low/mid/high` (işaretli; sayılmamış satırda boş).
- **Site "Doğa" düzeltmesi:** dipnot "≈ 1–5 mL su (Google'ın Gemini ölçümü, santral suyu dahil)" diyordu; Google'ın rakamı 0,26 mL ve yalnızca yerinde soğutma suyudur (santral suyu yok). Enerji aralığı (mesaj başına 0,24–1,2 Wh) aynı kaldı: = ≈ 400 token × 0,6–3 mWh. Su artık rapordaki WUE aralığıyla hesaplanıyor: mesaj başına ≈ 0,9–6 mL, 1 milyon kişi senaryosunda 40–200 ton → **35–250 ton**; LED 10 W → 9 W (kaynaklı değer). Site `build.py` bu makinede çalışmadığı için (Linux yolları) kaynaklar ve üretilmiş `site/index.html`, `docs/index.html` aynı betikle birlikte yamalandı.
- **Bilinen sınırlar:** e_token ve WUE başka şirketlerin modelleri/altyapısı için yayımlanmış değerlerdir, Claude 5 ailesi için ölçüm yok. "Kabul" doğrudan ölçülmez, taslak içindeki ayar değişikliğinden çıkarılır: kullanıcı öneriyi görüp bir sonraki mesajda uygularsa sayılmaz. Gerçek claude.ai'de denenmedi (yalnızca sahte sayfa e2e'si).
