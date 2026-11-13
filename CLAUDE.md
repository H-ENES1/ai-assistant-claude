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
  _locales/{en,tr}/     tüm kullanıcı metinleri
tests/                  unit, learn, report, contrib, advisor (+rec-cases.json) testleri, e2e.cjs (Playwright, 43 kontrol)
tests/quality/          öneri kalitesi ölçümü: RAPOR.md (sonuç), run.md (yeniden çalıştırma), build-prompts/blind/analyze betikleri
tests/ml/               train.tsv (600), test.tsv + test2.tsv (120+120, ayrı yazılmış), train.mjs (eğit + karşılaştır)
tests/ml/               train.tsv (600), test.tsv + test2.tsv (120+120, ayrı yazılmış), test3.tsv (350, KÖR SET 4), train.mjs (eğit + karşılaştır)
tests/blind4.mjs        kör set 4 ölçümü (domain-cases4.json + ml/test3.tsv): iş türü, alan, model/effort; eşik yok, yalnız set bütünlüğü denetlenir
tools/                  build-release.mjs (küçültülmüş mağaza paketi), aggregate.mjs (topluluk katkılarını birleştir)
tests/ml/               train.tsv (600 kısa), train2.tsv (633 uzun/yapıştırılmış içerikli; train2.meta.tsv: dil, alan, kaynak),
                        test.tsv + test2.tsv (120+120, ayrı yazılmış), test3.tsv (350, set 4: YANMIŞ, bilgi amaçlı),
                        test4.tsv (300, KÖR SET 5), train.mjs (eğit + karşılaştır; ağırlığı yalnız --write ile yazar)
tests/blind4.mjs        set 4 ölçümü (domain-cases4.json + ml/test3.tsv): iş türü, alan, model/effort; eşik yok, yalnız set bütünlüğü denetlenir
tests/blind5.mjs        kör set 5 ölçümü (domain-cases5.json + ml/test4.tsv); --base=<klasör> ile "önce" sürümü yan yana; --check yalnız bütünlük
tools/                  build-release.mjs (küçültülmüş mağaza paketi), aggregate.mjs (topluluk katkılarını birleştir),
                        domain-dict.mjs (+domain-dict/sozluk.json: kör yazılmış alan sözlüğünü eleyip lib/domain.js'e yazar)
.github/ISSUE_TEMPLATE/ katki.yml (topluluk verisi), anket.yml, hata.yml
site/                   index.html (tanıtım sitesi, tek dosya) + build/ (kaynak, demo motoru esbuild ile gömülür)
```

## Testler (her değişiklikten sonra çalıştır)

```
npm install   # kökte: esbuild + playwright
npm run test   # birim + öğrenme + rapor + katkı + model önerisi (60 prompt: uygunluk ≥ %96, "gerekenden hafif öneri" = 0 olmalı)
node tests/ml/train.mjs   # sınıflandırıcıyı yeniden eğit; test2'de karma < kurallar olursa ağırlıkları YAZMA (--no-write)
npm run e2e    # Playwright, sahte claude.ai (69 kontrol). PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 şart (0.12.2'den beri e2e.cjs kendisi ayarlar):
npm run test   # birim + öğrenme + rapor + katkı + model önerisi (72 prompt: uygunluk ≥ %96, "gerekenden hafif öneri" = 0 olmalı)
               # + set 4 ve set 5 bütünlük denetimi (set 5 burada ÖLÇÜLMEZ)
node tests/ml/train.mjs   # sınıflandırıcıyı eğit ve karşılaştır; ağırlık YAZMAZ. Yazmak için --write (test2'de doğruluk düşmemeli,
                          # tehlikeli hata artmamalı) VE yazılan ağırlık yeni bir kör setle ölçülmeden yayımlanmaz (aşağıda kör set 5 notu)
npm run blind5            # kör set 5 ölçümü; sonuca bakarak ayar yapılırsa set 5 yanar
npm run e2e    # Playwright, sahte claude.ai (43 kontrol). PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 şart:
npm run e2e    # Playwright, sahte claude.ai (93 kontrol). PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 şart (0.12.2'den beri e2e.cjs kendisi ayarlar):
               # yoksa arka plan servisinin istekleri sahte sunucuya gitmez ve 4-5 kontrol yanlışlıkla kırmızı olur.
npm run perf   # ölçüm (test değil): 60 ve 600 mesajlık sohbette boşta ve tuş başına sayfa maliyeti
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
- Öneri kalitesi ilk kez ölçüldü (11.11.2026, `tests/quality/RAPOR.md`; 80 istem × Haiku/Sonnet/Opus, kör model hakem). Kendi başına cevaplanabilir 58 istemde: Haiku önerilen 13'ün 13'ünde Haiku cevabı ≥ 4; gerekenden hafif öneri 5 (%9, aralık %4–19); gereksiz ağır öneri 33 (%57; cevaplar 400 kelimeyle sınırlı olduğu için üst sınır). Eşikler değişmedi (kanıt yetersiz). Ölçülmeyenler: effort önerisi, Fable kademesi, uzun cevap isteyen işler, insan hakem. Yeniden çalıştırma: `tests/quality/run.md` (abonelik limitini harcar, `npm run test`'e dahil değil).
- Plan limit büyüklükleri (k) kaba önsel (topluluk önselleri gelene kadar).
- Lisans (22.10.2026 kararı): GNU AGPL-3.0-or-later (LICENSE, NOTICE). Kod açık kaynak; ad ve logo lisans dışı (AGPL madde 7(e), NOTICE). Derlenmiş JS dosya başlığında SPDX ve kaynak adresi var (https://github.com/H-ENES1/ai-assistant-claude; depo 23.10.2026 tarihinde ai-assistant-claude olarak yeniden adlandırıldı). Önceki "tüm hakları saklı" kararı ve BSL fikri terk edildi.
- Sınıflandırıcı: test2 (gündelik dil) kurallar %64 → karma %88. Gerçek kullanıcı mesajlarıyla ölçülmedi.
- **Kör set 4 (12.11.2026, 250 TR + 100 EN):** depoyu görmeyen alt ajanlar yazdı (`tests/ml/test3.tsv`, `tests/domain-cases4.json`; ölçüm `npm run blind`). İş türü: kurallar %41, yalnız metin %50, karma %50, ürün %49 (test/test2'de ürün %92/%89). Konu alanı: %66 kabul edilebilir, 64 yanlış alan, 55 "genel". Ana neden: train.tsv'de 20 kelimeden uzun örnek yok, kör setin %45'i 20 kelimeden uzun; uzun ve yapıştırılmış içerikli mesajlar `code_fix`'e kayıyor. Güven işe yarıyor: high %75, medium %60, low %23 doğru. **Bu sete bakarak kural, ağırlık ya da sözlük EKLEME**; iyileştirme yapılacaksa önce ayrı eğitim verisi yaz, sonra yeni bir kör setle ölç. (Aynı gün yapıldı: aşağıdaki kör set 5 notu; set 4 artık yanmıştır.)
- **Kör set 5 ve "uzun mesaj" denemesi (12.11.2026, dal `egitim-uzun`):**
  - **Set 4 yanmıştır:** train2.tsv onun toplu sonuçlarına göre yazıldı; artık yalnız "önce" değeri, tablolarda "bilgi amaçlı".
  - **Kör set 5** (200 TR + 100 EN, %60'ı 20–150 kelime, yapıştırılmış e-posta/tablo/makale/kod/hata çıktısı): depoyu görmeyen alt ajanlar yazdı, bağımsız ikinci etiketleyiciyle anlaşma iş türü %95,7, alan %94,3, model ailesi %85,3, effort %72,7 (model ve effort etiketleri tahmindir). Mühür commit'inden sonra içeriğine bakılmadı, **tek kez ölçüldü**, sonuca göre ayar yapılmadı. **Bu sete bakarak kural, ağırlık ya da sözlük EKLEME.**
  - Yapılanlar: train2.tsv (633 örnek), yeniden eğitim, hafif tür koruması (`classify.js` LIGHT_*: uzun mesajda model tek başına hafif tür diyemez; "yapım işi kısa soru olamaz"), Haiku kapısı `rules_heavy` (`advisor.js`: kurallar güvenle ağır tür diyorsa Haiku yok), sözlük 2 (`domain.js` SOZLUK2 bloğu, 64 kural satırı, `tools/domain-dict.mjs` üretir).
  - Sonuç (ürün; iş türü katı doğruluk · tehlikeli hata | hafif-öneri [iki etiketleyiciden de hafif] · Haiku yanlış öneri · riskli alanda Haiku · (Haiku toplam)):

    | sürüm | test | test2 | set 4 (bilgi amaçlı) | set 5 (kör) |
    |---|---|---|---|---|
    | önce (kor-set-4) | %91,7 · 2 \| 1 [1] · 1 | %89,2 · 2 \| 0 · 0 | %49,1 · 10 \| 21 [12] · 5 · 4 · (24) | %38,7 · 5 \| 26 [15] · 3 · 1 · (12) |
    | yeni ağırlık + yeni kod (**geri alındı**) | %89,2 · 1 \| 0 · 0 | %89,2 · 1 \| 0 · 0 | %63,4 · 14 \| 27 [16] · 9 · 3 · (37) | %67,3 · 5 \| 37 [26] · **12** · 1 · (34) |
    | **eski ağırlık + yeni kod (dalda kalan)** | %81,7 · 1 \| 0 · 0 | %88,3 · 0 \| 0 · 0 | %46,0 · 0 \| 18 [9] · 2 · 2 · (15) | %36,3 · 2 \| 26 [15] · 2 · 1 · (10) |

    Konu alanı (kabul edilebilir · yanlış alan · "genel"): set 5 %79,7 · 44 · 17 → %84,0 · 37 · 11; set 4 %66,0 · 64 · 55 → %72,3 · 55 · 42; set 3 %71 → %78; set 1–2 aynı ya da daha iyi.
  - **Karar (ölçümden önce yazılmış kuralla):** yeni ağırlıklar set 5'te doğruluğu %39 → %67 yaptı ama Haiku yanlış öneriyi 3 → 12, hafif-öneri hatasını 15 → 26 çıkardı; tek yönlü güvenlik kuralı gereği **ağırlıklar geri alındı** (`learn-weights.js` = kor-set-4). Koruma, kapı ve sözlük güvenlik sayılarını kötüleştirmediği için kaldı. Bedeli: koruma eski ağırlıklarla kısa mesajlarda bazı hafif işleri ağır türe itiyor (test %91,7 → %81,7; Haiku önerilen 34 → 25), yani uzun mesaj sorunu ÇÖZÜLMEDİ, ürün yalnızca daha temkinli oldu. main'e birleştirilmedi.
  - Dersler: (1) test2 yazma ölçütü tek başına yetmiyor, yeni ağırlık kör sette Haiku'yu 12 → 34 kez önerdi ve bunların 12'si yanlıştı; ağırlık değiştirirken ölçüt "Haiku yanlış öneri" olmalı. (2) Koruma eşikleri yeni ağırlıkların olasılıklarına göre seçilmişti; eski ağırlıklarla yeniden ayarlanmadı (ayarlanırsa yeni kör set gerekir). (3) Aynı model ailesinden yazarlar benzer örneklere yakınsıyor (train2'den 13 yakın kopya atıldı); kör set sonuçları gerçek kullanıcıya göre iyimser olabilir. (4) Ham model geliştirme verisinde tehlikeli hatayı 70'e çıkarıyordu; doğruluk kazancı hafif türleri (çeviri, özet, yeniden yazım) tanımaktan geliyor ve aynı şey riski de getiriyor.
  - Sonraki adım fikirleri (kodlanmadı): talimat penceresi (yapıştırılan gövdeyi ayırıp türü talimattan okumak), Haiku kararı için ayrı "hafif mi" ölçütü/olasılık kalibrasyonu, alan tespitini talimat kısmına ağırlıklandırmak.
- `tests/ml/train.mjs`: "kurallar" satırı `useModel:false` ile ölçülür (classify() öğrenen modeli kullanmaya başladığından beri bu satır yanlışlıkla ürünün karma kararını ölçüyordu; betik ayrıca eski `ext/` yolu yüzünden çalışmıyordu); "ürün" satırı yayındaki ağırlıklardır. Ağırlık yazma ölçütü test2 olarak kaldı, test3 karara karışmaz.
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
- **Konu alanı** `lib/domain.js`: 17 alan + alt başlıklar, 173 kural (TR kökler başta sınırlı, EN tam sınırlı). İş türü ipucu yalnızca kurallar ve öğrenen model aynı türdeyse. Test: `tests/domain.test.mjs` (set 1 geliştirme, set 2 görüldü, set 3 neredeyse kör: ilk ölçüm %72 kabul edilebilir / 6 yanlış alan; 4 tetikleme hatası düzeltildi → %71 / 1). Yeni sözlük eklerken set 3'e ya da set 4'e bakarak ekleme YAPMA; yeni kör set yaz.
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

## Denetim (12.11.2026, dal `denetim`) — ayrıntı: DENETIM.md
- **Onaydan önce okuma yok, kanca dahil:** `inject/hook.js` `enabled = false` ile uykuda başlar; içerik betiği onaydan sonra `__tokenForecastCmd: "enable"` yollar. Kanca istem metnini ve dosya adlarını asla yaymaz (yalnızca sayılar).
- **Sayfadan gelen her mesaj güvenilmez:** `content.js cleanHookMessage` sınırda doğrular (alan, tür, uzunluk; yol/etiket yalnızca tanımlayıcı biçiminde); `estimate`, `prePromise`, `via` dışarıdan alınmaz. Arka planda `report.js cleanSend/cleanDonePatch` ikinci süzgeç. Yeni mesaj alanı eklerken ikisini de güncelle.
- **Yanlış sayı yerine "Okunamadı":** model, plan, kullanım ya da geçmiş okunamazsa varsayım yapma (Sonnet/Pro/free yok). `compute()` `unread` döndürür; okunamadıyken gönderim kaydı ve kalibrasyon gözlemi üretilmez. Kullanım yalnızca `usage.js liveUsage` üzerinden gösterilir (yenilenme zamanı geçmiş ya da 20 dk'dır okunamayan veri gösterilmez, rozet "?").
- **Kalibrasyon taşıma:** her okuma `calibrate.js migrateCalib` üzerinden; okunamayan/yeni sürüm veri `calibBackup`'a yedeklenir, silinmez. Şema değişirse `MIGRATIONS`'a adım ekle ve `tests/fixtures/calib-*.json` (eski sürümlerin gerçek koduyla üretildi) testini genişlet.
- **CSP:** eklenti sayfaları yalnızca `https://claude.ai`'ye bağlanabilir (manifest). Yeni bir uç nokta ya da `fetch` eklemek = `tests/privacy.test.mjs` listesi + gizlilik politikası (`site/build/static/privacy.html` ve `docs/privacy.html`, aynı kalmalı) + onay metinleri.
- Testler: `tests/denetim.test.mjs` (taşıma, okunamadı, süzgeçler), `tests/privacy.test.mjs` (statik gizlilik denetimi + politika–kod eşleşmesi), e2e'de metin sızıntısı (adres/gövde/depo), WebSocket, onay öncesi kanca, sahte mesaj, CSP.
- `CONSENT_VERSION` artırılmadı (okunan veri türleri aynı, yalnızca metin düzeltildi); karar DENETIM.md'de.
