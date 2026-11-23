# Denetim (12 Kasım 2026, dal `denetim`)

Kapsam: `extension/` (tamamı), `tools/`, `site/build/`. Öncelik sırası: gizlilik, güvenlik, Chrome Web Store kuralları,
sağlamlık, veri, performans. Satır numaraları bu dalın son hâline göredir.

Önem: **kritik** (veri cihazdan çıkıyor / uzaktan kod), **yüksek** (yanlış sayı, kural ihlali, onaysız okuma, veri kaybı),
**orta**, **düşük**. Kanıtı olmayan bulgu **olası** diye işaretli. **Kritik bulgu yok:** mesaj metni, ek ya da sohbet
içeriğinin cihazdan çıktığı bir yol bulunmadı (aşağıdaki "Gizlilik denetimi" bölümü neye bakıldığını anlatır).

## Düzeltilenler (bu dalda, testli)

| # | Önem | Yer | Nasıl tetikleniyordu | Düzeltme | Test |
|---|---|---|---|---|---|
| Y1 | yüksek | `extension/inject/hook.js:30`, `:111`, `:36` | Sayfa kancası onay verilmeden önce de çalışıyordu: her `/completion` isteğinin gövdesini (istem metni, ek adları) ve cevap akışını okuyor, istem metnini ve dosya adlarını `window.postMessage` ile sayfaya yayıyordu. Mağaza kuralı: onaydan önce okuma yok. | Kanca `enabled = false` ile uykuda başlar; içerik betiği yalnızca onaydan sonra `__tokenForecastCmd: "enable"` yollar (köken denetimli, `:167`). `summarizeBody` artık yalnızca sayı döndürür (karakter sayısı, ek sayısı, alan adları); metin ve dosya adı hiç yayılmaz. | e2e "onaysız: sayfa kancası … uykuda", "yaydığı gönderim mesajında istem metni ve dosya adı yok"; `privacy.test.mjs` |
| Y2 | yüksek | `extension/content/content.js:241` (compute), `extension/lib/forecast.js:158` | Model seçici okunamazsa sessizce "Sonnet 5.5" varsayılıyordu; sohbetin modeli API kimliği olarak gelirse (`claude-opus-5-5`) çözülemiyor, ağırlık 4 kullanılıyordu. Yanlış sayı + kalibrasyon bu yanlış sayıyla besleniyordu. | `resolveModel` API kimliklerini de çözer; bilinmeyen aile `{key: null}`. Model okunamazsa hap "Okunamadı" der, sayı/öneri yok (`unreadVM`, `:319`), gönderim kaydı ve kalibrasyon gözlemi üretilmez (`:633`). Seçici okunamayıp sohbetin modeli biliniyorsa sayı kalır, satırda "(sohbetten okundu)". | e2e "model okunamadı → 'Okunamadı'…", "…gönderim: kayıt ve kalibrasyon gözlemi üretilmedi", "model seçici okunamadı, sohbetin modeli kullanıldı"; `denetim.test.mjs` |
| Y3 | yüksek | `extension/lib/usage.js:127`, `extension/background.js:190`, `extension/popup/popup.js` | Kullanım okuma başarısız olunca ya da pencerenin yenilenme zamanı geçince depodaki eski yüzde (ör. %87) hapta, popup'ta ve rozette güncelmiş gibi kalıyordu. | `liveUsage`: yenilenme zamanı geçmiş pencere düşer; okuma 20 dakikadan uzun süredir başarısızsa hiç yüzde gösterilmez. Popup "Kullanım yüzdesi okunamadı", rozet gri "?". | e2e "panel: yenilenme zamanı geçmiş %87 gösterilmiyor", "popup: … rozet '?'", "okuma düzelince … geri geldi"; `denetim.test.mjs` |
| Y4 | yüksek | `extension/lib/usage.js:13`, `content.js:241` | Kuruluş cevabının biçimi değişirse plan `free` sayılıyordu; plan hiç okunamazsa içerik betiği `claude_pro` varsayıyordu. | `tierFromOrg` bilinmeyen biçimde `null` döner; plan okunamazsa "Okunamadı" (sayı yok). Önceden okunmuş plan, yeni okuma `null` dönerse korunur. | `denetim.test.mjs` |
| Y5 | yüksek | `content.js:223` (historyInput) | Sohbet API'sinin biçimi değişirse geçmiş sessizce 0 token sayılıyordu (soğuk önbellek maliyeti hiç görünmüyordu). | API özeti 0 mesaj / 0 token ise sayfadaki mesajlar sayılır ve "Sohbet geçmişi claude.ai'den okunamadı, sayfadakiler sayıldı" uyarısı çıkar; böyle bir gönderim soğuksa kalibrasyona yazılmaz (`:700`). | e2e "sohbet API'si okunamadı → sayfadan sayıldı ve uyarı verildi" |
| Y6 | yüksek | `content.js:567` (cleanHookMessage), `extension/lib/report.js:32` (cleanSend), `background.js` (`log:send`, `log:done`, `health:hook`) | Aynı penceredeki her betik `__tokenForecast` mesajı taklit edebilir. Sahte `send` içinde `estimate`, `prePromise`, `via` ve sınırsız uzunlukta dizeler kabul ediliyordu: sayfa, depoya istediği "tahmini", etiketleri ve metni yazabiliyordu; ölçek dışı kullanım (%5500) kabul ediliyordu. | Sınırda doğrulama: yalnızca beklenen alanlar, tür ve uzunluk; iç alanlar dışarıdan alınmaz; yol/etiket alanları yalnızca tanımlayıcı biçiminde (tanı günlüğü hata bildirimi için panoya kopyalanabildiği için serbest metin giremez). Arka planda ikinci süzgeç (`cleanSend`, `cleanDonePatch`, `traceInfo` 600 karakter). SSE kullanımı 0–2 dışında reddedilir. | e2e "sahte mesaj: …" (3 kontrol); `denetim.test.mjs` |
| Y7 | yüksek | `extension/lib/calibrate.js:66`, `:112`, `background.js:244` | Kalibrasyon sürümü uyuşmazsa ya da durum bozuksa sessizce boş durumla değiştiriliyordu (veri kaybı); bozuk bir içe aktarma `compute()`'u da düşürebiliyordu. | `migrateCalib` (empty/ok/repaired/migrated/newer/invalid; hiç atmaz, girdiyi değiştirmez), `applyObservations` okunamayan veriyi `calibBackup` anahtarına yedekler. 0.9.1 ve 0.12.0'ın **gerçek koduyla** üretilmiş durumlar (`tests/fixtures/`) aynı sonsal değerlerle okunuyor. Gözlemler `validObservation` ile süzülür. | `denetim.test.mjs` (taşıma), e2e "daha yeni sürümün kalibrasyonu silinmedi", "0.9.1 yedeği içe aktarıldı" |
| Y8 | yüksek | `site/build/static/privacy.html`, `docs/privacy.html` | Politika kodla çelişiyordu: "yalnızca kullanım bilgisi istenir" (kod ayrıca `/api/organizations` ve açık sohbeti okuyor), Claude'un cevaplarının okunduğu yazmıyordu, "hesap bilgisi saklanmaz" yanlıştı (kuruluş kimliği, plan, sohbet kimlikleri saklanıyor), karma ağırlıklar ve tanı günlüğü yoktu; Türkçede İzinler ve Veri kullanımı bölümleri eksikti. | Politika koda göre yeniden yazıldı (3 uç nokta, okunan/saklanan her şey, CSP, onay), iki dil eşit. Onay sayfası metinleri (`welRead2`, `welRead3`, `welStore`) 10 dilde düzeltildi. | `privacy.test.mjs` (politika iki kopyada aynı, uç noktalar iki dilde, başlık sayısı eşit) |
| O1 | orta | `extension/popup/popup.js:319` | Plan okunamadıysa topluluk katkısı `claude_pro` diye etiketleniyordu: herkese açık önselleri yanlış planla besler. | Plan yoksa katkı üretilmez, "Plan türün okunamadı" yazar. | – (tek satır; e2e'de plan hep okunuyor) |
| O2 | orta | `extension/lib/page.js:42`, `extension/lib/panel.js` (keydown) | Uzun sohbette her 700 ms'de tüm mesajlar liste × liste karşılaştırılıyordu; her tuşta yerleşimi zorlayan menü denetimi iki kez çalışıyordu. | Ata denetimi `closest` ile (sonuç aynı); mesaj kutusuna harf yazarken menü denetimi yok. Ölçüm aşağıda. | `tests/perf.cjs` (ölçüm), e2e sayfa yolu kontrolleri |
| D1 | düşük | `extension/manifest.json:23` | Eklenti sayfalarında CSP yoktu (MV3 varsayılanı `connect-src`'yi kısıtlamaz). | `connect-src 'self' https://claude.ai`, `object-src 'none'`, `base-uri 'none'` vb. | e2e "CSP: popup ve arka plan başka alan adına bağlanamıyor"; `privacy.test.mjs` |
| D2 | düşük | `content.js:735` (trimActivity) | Sohbet kimlikleri yalnızca 300 sınırıyla kırpılıyordu (yıllarca kalabiliyordu). | 7 gündür işlem görmeyen sohbet kimliği silinir (önbellek en çok 1 saat yaşar). | – |

**Onay sürümü:** `CONSENT_VERSION` artırılmadı. Okunan veri türleri değişmedi; yalnızca onay metni ve politika, zaten okunan
şeyleri (cevaplar, plan türü, kimlikler) eksiksiz anlatacak şekilde düzeltildi. Mağaza incelemesi bunu "okunan veri değişti"
sayarsa 1 artırmak yeterli (herkes onay sayfasını yeniden görür). Karar Üstad'ın.

## Performans ölçümü (`npm run perf`)

Sahte claude.ai, mesajlar claude.ai'ye benzer derinlikte. Chrome `Performance.getMetrics` (sayfa süreci, içerik betiği dahil).
Bu makinede (Windows 11, başsız Chromium) **tek çalıştırma**; makineden makineye değişir, oranlar daha anlamlı.

| Mesaj | Durum | Boşta betik (ms/sn) önce → sonra | Tuş başı betik (ms) önce → sonra | Tuş başı görev (ms) önce → sonra |
|---|---|---|---|---|
| 600 | eklenti yok | 0,00 | 0,01 → 0,00 | 2,08 → 2,02 |
| 600 | onaysız | 0,00 | 0,01 → 0,00 | 2,01 → 2,02 |
| 600 | onaylı, API | 9,35 → 2,01 | 0,81 → 0,04 | 5,67 → 4,49 |
| 600 | onaylı, sayfadan | 8,32 → 1,97 | 0,81 → 0,04 | 5,34 → 4,85 |
| 60 | onaylı, API | 0,87 → 0,77 | 0,16 → 0,03 | 4,39 → 4,28 |

Kalan: onaylıyken tuş başına ~2,5 ms ek **görev** süresi var ama betik payı 0,04 ms; kaynağı (stil/yerleşim mi, gölge DOM mu)
ölçülmedi. Boştaki 2 ms/sn'nin çoğu 700 ms'lik `domTick` (son mesajın `innerText`'i) ve panelin 500 ms'lik zamanlayıcısı
(`panel.js:321`); ayrıca ölçülmedi.

## Açık kalanlar (orta ve düşük; bu dalda düzeltilmedi)

| Önem | Yer | Nasıl tetiklenir | Önerilen düzeltme |
|---|---|---|---|
| orta, olası | `extension/background.js:150`, `:155` | claude.ai bir pencereyi `resets_at` olmadan döndürür ve yüzde eşiği geçmişse anahtar `five_hour@0` olur; 150. satırdaki temizlik `0 < now − 1 gün` olduğu için onu her seferinde siler → aynı eşik bildirimi her kullanım yenilemesinde (5 dk) tekrar gelir. Gerçek claude.ai'de eşik üstünde `resets_at`'in boş geldiği görülmedi. | Boş `resets_at` için anahtarı günün sonuna bağla (`Math.ceil(now / 864e5) * 864e5`) ya da `0`'ı temizlikten muaf tut. |
| orta, olası | `extension/lib/page.js:103` (detectEffort) | Mesaj kutusundaki **her** düğmenin metninde low/high/max/orta gibi kelime aranıyor; ek çipi ya da başka bir düğme ("Max" adlı bir dosya, "High contrast") effort sanılabilir. | Önce `[data-testid*="effort"]`, sonra yalnızca model seçicinin yanındaki düğme; `detectModel`'deki sıraya benzer. |
| orta | `extension/lib/contrib.js:51` | Topluluk katkısı son 4 haftanın **konu** oranlarını (sağlık, hukuk, finans…) içeriyor; bu herkese açık GitHub konusuna yapıştırılıyor. `aggregate()` bu alanı kullanmıyor. Kullanıcı önizlemeyi görüyor ve politika artık bunu yazıyor. | Kullanılmıyorsa `domains`'i çıkar (CONTRIB_VERSION aynı kalabilir; aggregate okumuyor). |
| orta | `extension/lib/contrib.js:86`, `:96` | `aggregate()` katkıdaki `plan` ve pencere adlarını doğrulamıyor (`__proto__` gibi anahtarlar), `mu` için sınır yok. Üç sahte hesap bir planın önselini istediği değere çekebilir (ortanca 3 kullanıcıyla başlıyor). Elle çalıştırılan araç; zarar yeni kullanıcıların başlangıç tahmini. | `plan ∈ PLAN_CAPS`, pencere ∈ {session, session_peak, weekly}, `mu` makul aralıkta; en az N farklı GitHub hesabı. |
| orta | `extension/lib/page.js` (seçiciler) | claude.ai mesaj seçicilerini değiştirirse sayfa yoluyla ölçüm (asıl ölçüm yolu, gönderim Worker'dan yapılıyor) sessizce durur; yalnızca Sağlık ekranında görünür. Yanlış sayı göstermez, ama öğrenme durur. | Onaylı ve sohbet sayfasındayken N gönderimde hiç ölçüm yoksa hapta tek seferlik "ölçüm yapılamıyor" bilgisi. |
| düşük | `content.js:567` | Sayfa betiği biçimce doğru bir `send`/`done` çifti taklit ederek bu cihazdaki kalibrasyona sahte ölçüm ekleyebilir. Sayfa zaten `fetch`'i ve DOM'u kontrol ettiği için kimlik doğrulama (nonce) bütünlük sağlamaz. Etki: yalnızca o cihazdaki tahmin. | Kabul edilen risk. Sayı sınırları (`validObservation`, en çok 8 gözlem) etkisini sınırlar. |
| düşük | `extension/inject/hook.js` (done) | Claude'un cevap metni `window.postMessage` ile içerik betiğine aktarılıyor (cevap uzunluğu için). Mesaj sayfanın içinde kalır, sayfa metni zaten görüyor; cihazdan çıkmaz. | İstenirse kanca metin yerine yalnızca karakter/token sayısı yollar. |
| düşük | – | Onayı geri alma arayüzü yok (yalnızca eklentiyi kapatma/kaldırma). Açık sekmeler onay kaldırılırsa yeniden yükleme olmadan durmaz. | Ayarlara "Onayı geri al" (consent'i sil + açık sekmelere `disable`). |
| düşük, olası | `extension/lib/usage.js:59` | /usage ölçeği 0–100'den 0–1'e geçerse (%0,19 gibi) fark edilemez; çok küçük yüzdeler görünür, uyarılar gelmez. Yanlış ama "fazla iyimser" yönde. | SSE (0–1) ve /usage değerlerini karşılaştır; tutarsızsa "okunamadı". |
| düşük | `extension/manifest.json:59` | `web_accessible_resources` claude.ai'ye açık: claude.ai eklentinin kurulu olduğunu dosya adresiyle anlayabilir. | MV3'te `use_dynamic_url: true`. |
| düşük | `extension/background.js` (tier) | Plan bir kez okunduktan sonra kuruluş cevabı tanınmaz biçime geçerse eski plan kullanılmaya devam eder. | Plan okumasına zaman damgası; 1 günden eskiyse "okunamadı". |
| düşük | `extension/background.js:190` | Pencere yenilendikten sonra rozet en çok 5 dk eski yüzdeyi gösterebilir (alarm aralığı). `liveUsage` yenilenme zamanı geçmiş pencereyi düşürür, gecikme yalnızca yeni değeri almakta. | Yenilenme alarmında (`reset:*`) rozeti hemen güncelle. |
| düşük | `content.js:821`, `:823` | Yazarken `input` olayı 250 ms'lik hesap planlıyor ama hemen ardından gelen MutationObserver 900 ms'ye çekiyor; hap yazmayı 0,9 sn geriden izliyor. Performans değil, tepkisellik. | Mesaj kutusunun içindeki değişiklikleri MutationObserver'da yok say. |
| düşük | `background.js:367` | Yedek içe aktarmada `recPrefs` ve `learnPersonal` biçim denetimsiz alınıyor (kullanıcının seçtiği dosya). Bozuk dosya öneri ayarlarını bozabilir. | `migrateCalib` gibi doğrulayıcı. |
| düşük | `tools/build-release.mjs:15`, `tools/aggregate.mjs:20` | `new URL(import.meta.url).pathname` Windows'ta `/C:/…` verir, betikler Windows'ta kök dizini bulamaz; `zip` komutu PATH'te olmalı. | `fileURLToPath(import.meta.url)`; zip için Node içinde arşivleme ya da PowerShell `Compress-Archive`. |
| düşük | `site/build/build.py:4`, `:7`, `tools/i18n/ext/build.py:2` | Sabit `/home/claude/...` yolları: başka makinede çalışmaz. | Betiğin konumuna göre göreli yol. |
| düşük | `site/build/index.src.html:4` | Site Google Fonts yüklüyor: ziyaretçinin IP'si Google'a gider (eklenti değil, site). | Yazı tiplerini `docs/` altında barındır. |

## Gizlilik denetimi: neye bakıldı

- **Statik (`tests/privacy.test.mjs`, kaynağın tamamı):** `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, WebRTC,
  `new Image`/`img.src`, `importScripts`, uzak betik/çerçeve, `storage.sync`, geniş tarayıcı API'leri, `eval` yok; `fetch`
  çağrıları yalnızca bilinen 4 yerde (3 claude.ai uç noktası + eklentinin kendi dil dosyası); kaynaktaki tüm adresler izinli
  listede; HTML sayfalarında uzak kaynak yok; izinler en az (`storage`, `alarms`, `notifications`, `https://claude.ai/*`);
  `postMessage` hedef kökeni `location.origin`; kanca uykuda başlıyor ve istem metnini yaymıyor; `innerHTML` kullanım sayısı
  sabit ve panel şablonlarındaki her ifade kaçışlı; arka plan gönderen kimliğini denetliyor; sekme açılışları bilinen adreslere;
  gizlilik politikası kodla eşleşiyor.
- **e2e'nin önceki ağ denetimi neyi kapsamıyordu:** yalnızca istek yöntemi ve adresi kaydediliyordu (gövde yoktu); WebSocket
  izlenmiyordu (Playwright'ta istek olayı üretmez); depo içeriği aranmıyordu; onay öncesi kanca, sahte sayfa mesajları ve
  CSP denenmiyordu. **Eklenenler (e2e 69 → 93 kontrol):** istek gövdeleri kaydedilir ve testte yazılan her metin/dosya adı
  sayfanın kendi `/completion` gövdesi dışında hiçbir adreste ve gövdede aranır; okunan uç nokta listesi sabit; WebSocket yok;
  depo dökümünde metin yok, bilinmeyen anahtar yok, `storage.sync`/`storage.session` boş; dışa aktarılan yedekte metin yok;
  onay öncesi kanca sessiz; sahte mesajlar depoya girmiyor; CSP dış bağlantıyı engelliyor; onay sayfası hatasız.
- **Hâlâ kapsanmayan:** gerçek claude.ai (gönderim Worker'dan yapılıyor, sahte sayfa bunu taklit etmiyor); Chrome'un kendi
  eklenti güncelleme/telemetri trafiği (eklentinin kontrolünde değil); bildirim içerikleri (yalnızca yüzde ve saat içeriyor,
  kodla doğrulandı, testle değil).

## Yanlış sayı yerine "okunamadı" (sağlamlık özeti)

| claude.ai'de değişen | Önce | Şimdi |
|---|---|---|
| Model seçici metni | Sonnet 5.5 varsayılır | Sohbetin modeli (işaretli) ya da "Okunamadı" |
| Sohbet modeli API kimliği | ağırlık 4 + "?" | Kimlik çözülür; çözülemezse "Okunamadı" |
| Kuruluş/plan biçimi | free ya da Pro varsayılır | "Okunamadı" |
| /usage biçimi ya da ölçek dışı değer | sayı olarak kabul | pencere yok sayılır |
| /usage hata verir | eski yüzde süresiz gösterilir | 20 dk sonra "okunamadı", rozet "?" |
| Yenilenme zamanı geçti | eski yüzde | pencere düşer |
| Sohbet API biçimi | geçmiş 0 | sayfadan sayılır + uyarı, kalibrasyona yazılmaz |
| Kalibrasyon şeması / bozuk veri | sessizce silinir | taşınır ya da `calibBackup`'a yedeklenir |
