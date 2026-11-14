# Site: arama motoru ve ilk ziyaret (dal `site-seo`, 12.11.2026)

Site: https://h-enes1.github.io/ai-assistant-claude/ (GitHub Pages, `docs/`). Yayın yalnızca PR `main`'e girince olur.

## Sorun

Site tek adresteydi ve dil JavaScript ile, tarayıcı diline göre değişiyordu. Google sayfayı çoğunlukla dil ayarı
İngilizce olan bir tarayıcıyla, ama HTML'deki ham metinle değerlendirir: HTML'de yalnızca Türkçe vardı, `<html lang="tr">`,
başlık ve açıklama Türkçeydi. Diğer 9 dilin kendi adresi olmadığı için dizine girmeleri mümkün değildi.

## Ne değişti

**Dil başına statik sayfa.** `/` = Türkçe, `/en/`, `/de/`, `/fr/`, `/es/`, `/it/`, `/pt/`, `/ru/`, `/ja/`, `/zh/`.
Her sayfada:

- o dilin metni HTML'de hazır (JS kapalıyken de okunur; `site/build/prerender.cjs` sayfayı derlemede gerçek tarayıcıda bir kez
  çalıştırıp çıkan metni HTML'e yazar: çeviriler, demo çıktısı, model kartları, grafikler);
- `<html lang>` (pt-BR, zh-CN), dile özel `<title>` ve `meta description` (`site/build/seo.json`), `canonical` (kendi adresi);
- 10 dil için `hreflang` + `x-default` → `/en/`;
- Open Graph ve Twitter kartı (`og:locale` + diğer diller `og:locale:alternate`), 1200×630 paylaşım görseli;
- JSON-LD `SoftwareApplication` (dile özel ad, açıklama, `inLanguage`, adres) ve `FAQPage` (sayfadaki 12 SSS, görünen metinle birebir aynı).

**Dil seçimi.** Seçici o dilin adresine gider (seçim `localStorage`'a yazılır). Tarayıcı diline göre **yönlendirme yok**.
Ziyaretçinin tarayıcı dili (ya da daha önce seçtiği dil) başka bir sayfa diliyse, en üstte o dilde
"Bu sayfa Türkçe de var · Türkçe sayfaya geç ×" şeridi çıkar; kapatılınca bir daha çıkmaz. Şerit ilk boyamadan önce
yerleşir (sayfa kaymaz). Altbilgide 10 dilin düz bağlantıları var (JS'siz tarayıcı ve arama motoru için).

**Site haritası ve robots.txt.** `docs/sitemap.xml` derlemede üretilir: 10 dil sayfası, her birinde 11 `xhtml:link`
(10 dil + x-default), gizlilik sayfası. Kontrol sonucu: GitHub Pages proje sitesinde `robots.txt` alan adının kökünde
değil (`h-enes1.github.io/robots.txt` 404, yani her şeye izin var); `/ai-assistant-claude/robots.txt`'yi tarayıcılar
okumaz. Bu yüzden site haritası Search Console'dan elle gönderilmeli (aşağıda). Dosya zararsız, yerinde kaldı.

**İçerik.** Her dilde insanların aradığı ifadeler doğal yerlerde: başlık, açıklama, sayfanın üst satırı ve iki yeni SSS
(TR: "Claude kullanım limiti nedir, ne zaman sıfırlanır?", "Claude için token sayacı olarak da çalışır mı?";
EN: "What is the Claude usage limit (rate limit), and when does it reset?", "Does it work as a Claude token counter?";
diğer 8 dilde karşılıkları: Nutzungslimit/Token-Zähler, limite d'utilisation/compteur de tokens, límite de uso/contador de
tokens, limite di utilizzo/contatore di token, limite de uso/contador de tokens, лимит/счётчик токенов, 使用制限/トークンカウンター,
使用限额/token 计数器). Her ifade sayfada bir ya da iki kez geçer; cevaplar yalnızca bilinen şeyleri söyler (limit büyüklüğünü
Anthropic yayımlamıyor, token sayısı tahmin). Yeni çeviriler makine çevirisidir.

**Paylaşım görseli.** `docs/img/og-tr.png`, `og-en.png` (1200×630, sitenin koyu teması, Tiko'nun sitedeki çizimi;
derlemede sayfadan alınır). Diğer diller İngilizcesini kullanır.

**Hız.**

| Ölçülen | Önce | Sonra |
|---|---|---|
| Sayfa HTML'i (tr) | 876 KB (gzip 331 KB), 10 dilin tüm metni ve eklenti mesajları içinde | 156 KB (gzip 46 KB); en büyüğü ru 241 KB (gzip 66 KB) |
| Betik | sayfanın içinde | ortak `app.js` 269 KB (gzip 139 KB), diller arasında önbellekten |
| Ekran görüntüleri (tr, 5 adet) | PNG 1272 KB | WebP 2x 469 KB, 1x 214 KB; `srcset`/`sizes`, gerçek `width/height`, `loading="lazy"` |
| Video kapağı | JPG 92 KB, video `preload="metadata"` | WebP 34 KB, `preload="none"` |
| Yazı tipleri (Lighthouse, tr) | Google Fonts, 3 aile, 10 dosya 406 KB; CSS işlemeyi engelliyordu | yalnızca sayfadaki harfler (Google Fonts `text=`), 4 dosya 148 KB, ilk boyamadan sonra |
| Kritik CSS | 25 KB sayfa içi | aynı (sayfa içi); ekran dışı bölümlerde `content-visibility: auto` |

İlk boyamayı geciktiren iki şey bulundu ve düzeltildi: demo, sınıflandırıcıyı ilk karede çalıştırıyordu (regex derlemesi,
4× yavaş CPU'da ~1,1 sn) → statik sayfada demo çıktısı HTML'de hazır, motor demoya ilk dokunuşta çalışır. Yazı tipleri ve
`app.js` tarayıcı "ilk içerikli boyama"yı bildirdikten sonra yüklenir; dil seçici ondan önce de çalışır.

Kayma (CLS): web yazı tipi gelince telefonda üst çubuk iki satırdan bire iniyor, bütün sayfa 34 px kayıyordu (tr 0,077);
İspanyolca başlık farklı satırlara kırılıyordu (0,26). Üst çubuk telefonda sabit iki satır oldu; yedek yazı tipleri
web yazı tiplerinin genişliğine ayarlandı (`size-adjust`, sayfa metniyle ölçüldü: Newsreader/Georgia başlık boyutunda %97,
Inter/Arial %106,2, IBM Plex Mono/Consolas %109,1). Playwright ile telefon görünümünde 10 dilde kayma 0,000.

Erişilebilirlik düzeltmeleri: YouTube bağlantısının yazı rengi yanlış değişkendi (açık temada beyaz, koyu temada siyah:
görünmüyordu), risk rozetinin kontrastı 3,95 → 4,5 üstü, marka bağlantısının `aria-label`'ı görünen adla çelişiyordu.

## Lighthouse: önce / sonra

**Yöntem.** Lighthouse 12.8.2 (npm), Playwright'ın Chromium 141'i (başsız). Yerel sunucu GitHub Pages gibi davranır
(`/ai-assistant-claude/` yolu, gzip, `max-age=600`). Mobil: Lighthouse varsayılanı (Moto G Power görünümü, benzetilmiş
yavaş 4G, 4× CPU); masaüstü: masaüstü ön ayarı. Her sayfa ve biçim 3 kez koşuldu, performans puanına göre medyan alındı.
"Önce" = `fable-5-2` dalındaki `docs/` (tek adres; dil, tarayıcı diline göre JS ile seçiliyordu, Chrome `--lang` ile
her dile ayarlandı). Ölçerken makinede başka iş çalışmadı.

Ölçüm notu: bu makinede başsız Chrome ilk boyamayı bazen 1,5–2,5 sn geç kaydediyor; Lighthouse'un benzetimi o ana kadar
inen her şeyi (yazı tipleri, betik) ilk boyamanın önüne saydığı için aynı sayfanın mobil puanı 68 ile 94 arasında
oynuyordu. Yazı tipleri ve `app.js` ilk içerikli boyamadan sonra yüklenince oynama kalktı (aynı sayfada 4 koşu: 95–98).
Laboratuvar ölçümüdür; PageSpeed Insights'ta ya da gerçek telefonda sayılar farklı olabilir.

### Mobil

| Dil | Performans | Erişilebilirlik | En iyi uygulamalar | SEO | LCP (sn) | CLS | Aktarılan |
|---|---|---|---|---|---|---|---|
| tr | 58 → **99** | 97 → **100** | 100 → **100** | 100 → **100** | 3,6 → 1,2 | 0,074 → 0,000 | 813 → 373 KB |
| en | 64 → **97** | 97 → **100** | 100 → **100** | 100 → **100** | 3,3 → 1,1 | 0,064 → 0,000 | 912 → 352 KB |
| de | 65 → **99** | 97 → **100** | 100 → **100** | 100 → **100** | 5,6 → 1,3 | 0,000 → 0,000 | 735 → 376 KB |
| fr | 65 → **97** | 97 → **100** | 100 → **100** | 100 → **100** | 5,6 → 1,3 | 0,000 → 0,000 | 735 → 390 KB |
| es | 65 → **97** | 97 → **100** | 100 → **100** | 100 → **100** | 5,6 → 1,2 | 0,000 → 0,000 | 735 → 376 KB |
| it | 65 → **97** | 97 → **100** | 100 → **100** | 100 → **100** | 5,6 → 1,2 | 0,000 → 0,000 | 735 → 372 KB |
| pt | 65 → **97** | 97 → **100** | 100 → **100** | 100 → **100** | 5,6 → 1,2 | 0,000 → 0,000 | 735 → 381 KB |
| ru | 64 → **99** | 97 → **100** | 100 → **100** | 100 → **100** | 5,8 → 1,3 | 0,000 → 0,000 | 759 → 349 KB |
| ja | 65 → **96** | 97 → **100** | 100 → **100** | 100 → **100** | 5,6 → 1,4 | 0,000 → 0,000 | 735 → 346 KB |
| zh | 65 → **97** | 97 → **100** | 100 → **100** | 100 → **100** | 5,6 → 1,3 | 0,000 → 0,000 | 735 → 347 KB |

Hepsi 90+: evet. Performans koşuları (3 koşu, medyan seçildi): tr [97, 99, 100], en [97, 97, 100], de [97, 99, 99], fr [97, 97, 99], es [96, 97, 99], it [97, 97, 99], pt [97, 97, 99], ru [96, 99, 99], ja [96, 96, 99], zh [97, 97, 99]

### Masaüstü

| Dil | Performans | Erişilebilirlik | En iyi uygulamalar | SEO | LCP (sn) | CLS | Aktarılan |
|---|---|---|---|---|---|---|---|
| tr | 99 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,029 → 0,001 | 813 → 373 KB |
| en | 98 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,057 → 0,001 | 912 → 352 KB |
| de | 97 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,095 → 0,001 | 912 → 376 KB |
| fr | 92 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,158 → 0,002 | 912 → 390 KB |
| es | 92 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,157 → 0,001 | 936 → 376 KB |
| it | 98 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,077 → 0,001 | 912 → 372 KB |
| pt | 96 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,099 → 0,001 | 912 → 381 KB |
| ru | 76 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,3 | 0,610 → 0,000 | 935 → 349 KB |
| ja | 97 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,4 | 0,079 → 0,000 | 912 → 346 KB |
| zh | 99 → **100** | 97 → **100** | 100 → **100** | 100 → **100** | 0,8 → 0,4 | 0,027 → 0,000 | 912 → 347 KB |

Hepsi 90+: evet. Performans koşuları (3 koşu, medyan seçildi): tr [100, 100, 100], en [100, 100, 100], de [100, 100, 100], fr [100, 100, 100], es [100, 100, 100], it [100, 100, 100], pt [100, 100, 100], ru [100, 100, 100], ja [100, 100, 100], zh [100, 100, 100]

Sonrada erişilebilirlik, en iyi uygulamalar ve SEO kategorilerinde başarısız denetim kalmadı. Öncedeki 97 erişilebilirlik puanı renk kontrastıydı (YouTube bağlantısı, risk rozeti).

Not: "Önce" SEO puanı da 100, çünkü Lighthouse SEO denetimi yalnızca açılan tek sayfaya bakar (başlık, açıklama, taranabilirlik). Asıl sorun, 9 dilin hiç ayrı adresi olmaması, bu puana yansımıyordu. "Önce" sütununda her dil aynı adresin o dile ayarlı tarayıcıdaki görünümüdür.


## Testler

- `node site/build/site-test.cjs`: 266 kontrol, hepsi geçti (her dil sayfası: etiketler, hreflang, yapısal veri, JS'siz metin,
  görseller, video, demo, Tiko, dil seçici, öneri şeridi, JS kapalı; site haritası, paylaşım görselleri).
- `node site/build/multilang-test.cjs`: 104 kontrol, hepsi geçti (10 dil × masaüstü/telefon, tarayıcı dili farklıyken).
- `npm run test` geçti, `npm run e2e` 69/69 (eklentiye dokunulmadı).

## Bilinen sınırlar

- Google, SSS zengin sonuçlarını 2023'ten beri yalnızca resmî kurum ve sağlık sitelerinde gösteriyor; `FAQPage` işaretlemesi
  geçerli ama aramada SSS kutusu büyük olasılıkla çıkmaz. `SoftwareApplication` zengin sonucu için puan/yorum gerekir, yok.
- Ölçümler laboratuvar ölçümü (yerel sunucu). Google sıralamada gerçek kullanıcı verisini (Core Web Vitals) kullanır; site
  az ziyaret aldığı için o veri bir süre oluşmayabilir.
- Video ve ekran görüntüleri yalnızca TR/EN; diğer diller İngilizcesini görür (önceden de böyleydi).
- Japonca ve Çince sayfada başlık yazı tipi (Newsreader) Latin harfleri için; CJK metni sistem yazı tipiyle görünür (önceden de böyleydi).

## Search Console'da elle yapılacaklar

Mülk: `https://h-enes1.github.io/ai-assistant-claude/` (URL ön eki mülkü; doğrulama dosyası `docs/google59c0812582c3d66d.html` yerinde).
PR `main`'e girip GitHub Pages yayını bittikten sonra (Actions sekmesinde "pages build and deployment" yeşil):

1. **Site haritasını gönder:** Search Console → Dizin oluşturma → Site haritaları → "Yeni site haritası ekle" kutusuna
   `sitemap.xml` yaz → Gönder. Eski gönderim varsa onu da "Yeniden gönder"le. Durum "Başarılı" ve "Bulunan URL'ler: 11" olmalı.
2. **Her dil adresi için dizine eklenmeyi iste:** üstteki "URL denetimi" kutusuna sırayla yapıştır, "Dizine eklenmeyi iste"ye bas
   (günlük kota var; bitmezse ertesi gün devam et):
   - https://h-enes1.github.io/ai-assistant-claude/
   - https://h-enes1.github.io/ai-assistant-claude/en/
   - https://h-enes1.github.io/ai-assistant-claude/de/
   - https://h-enes1.github.io/ai-assistant-claude/fr/
   - https://h-enes1.github.io/ai-assistant-claude/es/
   - https://h-enes1.github.io/ai-assistant-claude/it/
   - https://h-enes1.github.io/ai-assistant-claude/pt/
   - https://h-enes1.github.io/ai-assistant-claude/ru/
   - https://h-enes1.github.io/ai-assistant-claude/ja/
   - https://h-enes1.github.io/ai-assistant-claude/zh/
   Önce "Canlı URL'yi test et" → "Test edilen sayfayı görüntüle" → HTML'de o dilin metni olduğunu gör.
3. **Uluslararası hedefleme kontrolü:** Search Console'daki eski "Uluslararası hedefleme" raporu 2022'de kaldırıldı; hreflang
   hataları artık orada listelenmiyor. Yerine: (a) URL denetiminde her dil adresi için "Google tarafından seçilen standart URL"
   sayfanın kendi adresi olmalı (ör. `/de/` için `/de/`), Türkçe sayfaya katlanmış olmamalı; (b) birkaç hafta sonra
   Performans raporunda "Ülkeler" ve "Sayfalar" sekmelerinde dil sayfalarının ayrı göründüğünü kontrol et; (c) istersen
   ücretsiz bir hreflang denetleyicisiyle (ör. Merkle / technicalseo.com hreflang tester) `/en/` adresini sına.
4. Bing için (isteğe bağlı): Bing Webmaster Tools → "Google Search Console'dan içe aktar" → site haritası otomatik gelir.
