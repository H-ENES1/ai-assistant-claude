# DEVAM — site ve video işi (dal `yayin-0-13`, 14.11.2026)

Kullanım limiti dolduğu için iş yarıda kaldı. Bu dosya kalan işi anlatır; iş bitince silinir.

## Biten
- **Site** (commit'lendi): canlı kahraman sahnesi (büyük Tiko fareyi izler, temsili sohbet, tahmin hapı, Tiko cevabın üstünde),
  kaydırma hikâyesi (yaz → tahmin → model önerisi → Tiko → haftalık rapor → Doğa), "Ölçüm" bölümü (RAPOR.md ve kör setler olduğu gibi),
  10 dilde metinler. Dokunmatik ekranda Tiko'nun karşılama balonu metni örtüyordu, kapatıldı.
- Testler (son derlemeden sonra): `node site/build/site-test.cjs` 339/339, `node site/build/multilang-test.cjs` 104/104, `npm run test` geçti.
- Ölçülen: siteye eklenen betik ≈ +25 KB (sınır 100 KB; site-test denetliyor).

## Yarım: videolar (`site/build/video/`)
Yazıldı ama **hiçbir kareye henüz bakılmadı, hiçbir video üretilmedi**:
- `data.mjs` → `data.js`: videodaki bütün sayılar eklentinin kendi motorundan (çalışıyor, çıktısı kontrol edildi).
- `qr.py` → `qr.js`: mağaza adresinin QR ızgarası; `python qr.py kare.png` bir karedeki QR'ı okuyup doğrular.
- `anim4.html`: yeni sahne dosyası, `window.render(t)`. Videolar: `main` (75 sn), `tiko`, `water`, `model` (Shorts), `linkedin` (56 sn), `demo` (30 sn).
  Sohbet arayüzü geneldir, üstünde "claude.ai'de · temsili arayüz" yazar; Tiko sitedeki ızgaranın aynısı.
- `rec4.cjs`: `onizle` (PNG kareler) ve `kaydet` (kareleri ffmpeg'e akıtır; H.264, veryfast, CRF 20).
  İlk önizleme hatasız çalıştı (ana video, TR, 19 kare) ama kareler gözle incelenmedi: taşma, üst üste binme, okunabilirlik bilinmiyor.

## Kalan iş (sırayla)
1. Önizleme karelerine bak (dört biçim: 1920×1080, 1080×1920, 1080×1350, 1080×1080; TR ve EN), `anim4.html`'i düzelt.
2. Müzik: kodla sentezlenen WAV (`music.py`, numpy) — henüz yazılmadı.
3. Hepsini üret → `site/build/video/out/` (`.gitignore`'a ekle): ana tanıtım TR+EN, 3 Shorts × TR+EN, LinkedIn TR+EN,
   demo EN 1920×1080 ve 1080×1080 + ≤ 8 MB 800 px GIF (`promo/video/`). Her videodan 2 saniyede bir kare çıkarıp bak; son karede QR'ı `qr.py` ile doğrula.
4. Siteye küçük sürüm: `site/video/tanitim-{tr,en}.mp4` (720p) ve `kapak-{tr,en}.jpg`; `.vid` kutusu artık 16:9 (CSS'e `aspect-ratio` ekle);
   eski `tanitim-*-v.mp4` dosyalarını kaldır; README'lerdeki "47 saniyelik" → 75; `promo/tr-linkedin.md` ve `promo/OKU.md` video adları.
5. `tests/site-shots.cjs` ile `site/img/{tr,en}` ekran görüntülerini yenile; Lighthouse/LCP'yi yeniden ölç (SITE-SEO.md tabanı: mobil 96–99, LCP 1,1–1,4 sn). **Ölçülmedi.**
6. `store/descriptions/*.txt` (10 dil): Tiko ve su/enerji raporu.
7. `site/build/OKU.md` ve `CLAUDE.md` notu; `npm run e2e` (bu oturumda **çalıştırılmadı**), site testleri, gönder.

## Ortam notu
Node PATH'te yok: taşınabilir Node 22 + `PLAYWRIGHT_BROWSERS_PATH`; ffmpeg `pip install imageio-ffmpeg` ile gelir (`FFMPEG` ortam değişkeni).
