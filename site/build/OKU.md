# Site kaynağı

`python site/build/build.py` (kökte bir kez `npm install`; Python'da Pillow; yazı tipi alt kümesi için ağ)

- Girdiler: `index.src.html` (sayfa + kod, Türkçe metin `data-i` ile), `entry.js` (demo motoru, `extension/lib`'den esbuild),
  `msgs.json`, `sim.json`, `learn.json`, `l10n/<dil>.json` (`tools/i18n/mk.py` üretir), `seo.json` (dil başına başlık,
  açıklama, paylaşım başlığı, dil önerisi şeridi), `static/` (gizlilik, robots.txt, Search Console doğrulaması).
- Çıktılar:
  - `docs/` — GitHub Pages: dil başına statik sayfa (`/` = tr, `/en/` … `/zh/`), ortak `app.js`, WebP görseller (1x/2x),
    paylaşım görselleri (`img/og-tr.png`, `img/og-en.png`), `sitemap.xml` (hreflang'lı). Metin `prerender.cjs` ile HTML'e yazılır.
  - `site/index.html` — claude.ai artifact sürümü (tek parça, dil JS ile değişir).
  - `site/standalone.html` — görseller ve video gömülü tek dosya (git'e girmez).
- Testler: `node site/build/site-test.cjs` ve `node site/build/multilang-test.cjs` (her dil sayfası), `node site/build/shot.cjs` (ekran görüntüleri).
- Yeni site metni: Türkçesi `index.src.html`'de, İngilizcesi aynı dosyadaki `EN` sözlüğünde ve `tools/i18n/l10n_en.tsv`'de,
  diğer diller `tools/i18n/site/<dil>.tsv` → `python tools/i18n/mk.py de fr es it pt ru ja zh`.
- Ayrıntı ve ölçümler: kökte `SITE-SEO.md`.

## Videolar (`site/build/video/`)

Tanıtım videolarının hepsi tek sahne dosyasından çıkar; kare kare çizilir, hazır video ya da ses malzemesi kullanılmaz.

- `anim4.html` — sahneler. `window.render(t)` sayfayı t. saniyeye getirir (durum tutmaz). `?v=main|tiko|water|model|linkedin|demo&lang=tr|en&w=…&h=…`.
  Dört yerleşim: yatay (16:9), dikey (9:16), 4:5 ve kare. Tarayıcıda açıp konsoldan `render(12.5)` ile bakılabilir.
- `data.mjs` → `data.js` — videodaki bütün sayılar: eklentinin kendi tahmin, öneri ve su/enerji kodu çalıştırılır (Pro planı, yeni kurulum varsayımı).
  Ölçüm sahnesindeki sayılar `tests/quality/RAPOR.md` ve CLAUDE.md'deki kör set tablosundan elle yazılmıştır; o belgeler değişirse `anim4.html`'deki `m1`–`m3` ve `mL` metinleri de değişir.
- `qr.py` → `qr.js` — son karedeki QR (mağaza adresi). `python qr.py kare.png` bir karedeki QR'ı okuyup adresi doğrular.
- `music.py` — müzik: numpy ile sentezlenir (Am–F–C–G, 100 vuruş/dk), telifli malzeme yok.
- `rec4.cjs` — `onizle` (seçilen saniyelerin PNG'si) ve `kaydet` (kareleri ffmpeg'e akıtır: H.264, veryfast, CRF 20, AAC).
- `render4.cjs` — hepsini üretir ve depoya giren küçük sürümleri yazar.

```
node site/build/video/data.mjs
python site/build/video/qr.py
FFMPEG=<ffmpeg yolu> node site/build/video/render4.cjs          # hepsi; ad süzgeci verilebilir: render4.cjs shorts
python site/build/build.py                                       # site videoyu site/video/'dan alır
```

- Çıktılar `site/build/video/out/` altında kalır (git'e girmez): `tanitim-{tr,en}.mp4` (1920×1080, 75 sn), `shorts-{tiko,su,model}-{tr,en}.mp4`
  (1080×1920, 24–27 sn), `linkedin-{tr,en}.mp4` (1080×1350, 56 sn), `demo-en-1920x1080.mp4`, `demo-en-1080x1080.mp4` (30 sn).
- Depoya girenler: `site/video/tanitim-{tr,en}.mp4` (1280×720) ve `kapak-{tr,en}.jpg`; `promo/video/` altında iki demo MP4'ü.
  800 px GIF (`promo/video/demo-en-800.gif`, 8 MB'ın altına inene kadar kare hızı ve renk sayısı düşürülür) aynı klasöre yazılır ama depoya girmez (`.gitignore`).
- Kurallar: sohbet penceresi geneldir, claude.ai'nin kopyası değildir ve üstünde "claude.ai'de · temsili arayüz" yazar; Anthropic logosu, yazı tipi, marka ögesi yok.
  Tiko sitedeki ızgaranın aynısıdır (yeni çizim yok). Yazı tipleri sistemden gelir (Segoe UI, Cascadia Mono); başka makinede görünüm biraz değişir.
- Gereksinim: Node 22 + Playwright (kökte `npm install`), ffmpeg (`pip install imageio-ffmpeg` de olur), Python'da numpy, qrcode (doğrulama için opencv-python).
- Eski hat (`anim3.html`, `rec3.cjs`, `render3.sh`: 47 sn'lik kare video) kaldırıldı; gerekirse git geçmişinde.
