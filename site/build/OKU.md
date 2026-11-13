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
