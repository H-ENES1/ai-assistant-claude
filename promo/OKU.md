# promo/ — duyuru taslakları

Bu klasördeki her şey **taslak**tır. Hiçbiri bir yere gönderilmedi, hiçbir hesap açılmadı. Paylaşımı Üstad kendisi yapar.

Kurallar 13.11.2026'da okundu. Platform kuralları değişir; göndermeden önce her dosyanın başındaki 2 satırı o günkü kural sayfasıyla karşılaştır.

## Dosyalar

| Dosya | Platform | Dil | Durum |
|---|---|---|---|
| `TAKVIM.md` | Sıra, gün/saat (Türkiye saati), yorumlar için 10 soru-cevap (EN + TR) | TR/EN | hazır |
| `en-reddit-claudeai.md` | r/ClaudeAI | EN | hazır taslak |
| `en-reddit-chromeextensions.md` | r/chrome_extensions | EN | hazır taslak |
| `en-producthunt.md` | Product Hunt (ad, slogan, açıklama, ilk yorum, galeri sırası) | EN | hazır taslak |
| `en-devto.md` | dev.to makalesi | EN | hazır taslak (yapay zekâ beyanı şart, dosyada) |
| `en-hackernews-showhn.md` | Hacker News "Show HN" | EN | **yalnızca not**: HN yapay zekâ ile yazılmış metne izin vermiyor |
| `tr-linkedin.md` | LinkedIn video gönderisi + ilk yorum | TR | hazır taslak |
| `tr-technopat.md` | Technopat Sosyal | TR | koşullu taslak (önce bölümü/moderatörü kontrol et) |

## Listeden çıkarılanlar

- **DonanımHaber forumu:** Yönetim, "direkt kendi sitenize ya da firmanıza ait olan bir yazı, link veya resim"i reklam sayıyor; mesaj silinip ceza verilebiliyor ([kural konusu, 2014](https://forum.donanimhaber.com/bolumde-yapilan-reklamlar-hakkinda--87352680); imza ve Sıcak Fırsatlar kuralları da aynı yönde). Kendi eklentimizin bağlantısı bu tanıma giriyor. Taslak yazılmadı.
- **Hacker News için hazır metin:** Show HN kendini tanıtmaya açık, ama HN kuralları "Don't post generated text or AI-edited text" diyor ve bunun gönderilere de uygulandığını yazıyor ([newsguidelines](https://news.ycombinator.com/newsguidelines.html)). Benim yazdığım bir metni oraya koymak kurala aykırı olur. Bu yüzden HN dosyası hazır metin değil; başlık seçenekleri, kurallar ve Üstad'ın kendi cümleleriyle yazacağı malzeme listesi.

## Doğrulayamadıklarım (dürüst not)

- **Reddit kural sayfalarını doğrudan okuyamadım:** reddit.com bot isteklerine kapalı, Chrome bağlantısı bu oturumda yanıt vermedi. r/ClaudeAI ve r/chrome_extensions kurallarını ikincil kaynaklardan derledim (dosyalarda kaynakları var). **Göndermeden önce subreddit'in "Rules" bölümünü ve gönderi oluştururken çıkan flair listesini kendin oku.**
- **Technopat kural sayfası** bot isteğine 403 döndü. Arama sonuçlarına göre reklam yasak; kendi eklentisini paylaşan bir kullanıcıya moderatörlerin kaynak kodu açık paylaşmasını şart koştuğu yazıyor. Proje AGPL ile açık kaynak olduğu için bu koşul sağlanıyor, ama bölüm adını ve güncel kuralı doğrulayamadım.

## Sayılar: hangisi nereden

Taslaklarda yalnızca depoda kaynağı olan sayılar var. Her biri sınırıyla birlikte yazıldı.

| Sayı | Kaynak | Sınır |
|---|---|---|
| Kalibrasyon: ilk mesajda medyan hata 1,68 kat → 20 mesajda 1,13 → 100 mesajda 1,08 | README "Does it actually learn?", `site/build/sim.mjs` | 300 **sanal** plan, gerçek hesap değil |
| Blok toplam hatası 2,04 → 1,40 kat (öğrenmeyen ~2,1–2,2); %80 aralığı ≈ %79 tutuyor; tek mesaj tabanı ~1,7 kat | README, `npm run proof` | 200 **sanal** kullanıcı |
| İş türü tanıma: kurallar %64 → kurallar + öğrenen model %88 (test 2, 120 mesaj); tehlikeli hata 16 → 4 | README, `tests/ml/` | Mesajları proje yazdı; gerçek kullanıcı mesajıyla ölçülmedi |
| Token sayımı: o200k'ya göre tipik hata EN %3, TR %7, kod %9; Claude/o200k ≈ 1,4 | `extension/lib/tokens.js` başlığı | 1,4 lugia19'un ölçümü, İngilizce metinden; Türkçede ayrıca ölçülmedi |
| Öneri kalitesi: Haiku önerilen 13 istemin 13'ünde Haiku cevabı 4/5 ve üstü; gerekenden hafif öneri 58'de 5 (%9; %95 aralığı %4–19); gereksiz ağır öneri 58'de 33 (%57) | `tests/quality/RAPOR.md` (**kalite-olcumu dalında**, 0.13.0 ile main'e gelir) | Hakem bir model (Fable 5.2, kör); insan hakem yok; cevaplar 400 kelimeyle sınırlı; effort önerisi ölçülmedi |
| Gerçek claude.ai'de doğrulama: v0.9.5, 3 ölçüm (Ekim 2026) | CLAUDE.md, README | Küçük örnek; yeni özellikler yalnızca sahte sayfada test edildi |

**Kullanmadığım sayı:** Sitedeki "önerilere uyunca ≈ %40 daha az işlem gücü (240 örnek mesaj, %38–50)". Depoda bu hesabı üreten bir betik ya da hangi varsayılan model/effort'a göre karşılaştırıldığını gösteren bir kayıt bulamadım (commit e7e6c37 yalnızca site metnini ekliyor). Yeniden üretilemeyen bir sayıyı "testlerimizde" diye yazmadım. Ayrıca kalite ölçümü, önerilerin %57'sinin gereğinden ağır olduğunu gösteriyor; yani önerilere uymanın tasarrufu, önerilerin kendisi iyileşince değişecek. Bu sayıyı kullanmak istersen önce hesabı `tests/` altına betik olarak ekle; sonra taslaklara "tahmin" etiketiyle girer.

## Bağlantılar (taslaklarda kullanılan)

- Chrome Web Store: https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige
- Kaynak kod: https://github.com/H-ENES1/ai-assistant-claude
- Site: https://h-enes1.github.io/ai-assistant-claude/
- Gizlilik politikası: https://h-enes1.github.io/ai-assistant-claude/privacy.html
- YouTube (EN, 4 dk): https://www.youtube.com/watch?v=TKogrZgveAM · (TR): https://www.youtube.com/watch?v=6Y4qZ-G2AS0
- Videolar (depoda): `site/video/tanitim-tr.mp4` (kare, 47 sn), `tanitim-tr-v.mp4` (dikey), `tanitim-en.mp4`, `tanitim-en-v.mp4`
- Görseller: `store/en/`, `store/tr/` (1280×800 ekran görüntüleri, 1400×560 ve 440×280 tanıtım görselleri)

## Genel uyarı: kendi sesinle yaz

Reddit, HN ve dev.to toplulukları yapay zekâ ile yazılmış tanıtım metnine tepkili. dev.to beyan istiyor, HN yasaklıyor. Bu taslakları malzeme olarak kullan; cümleleri kendi ağzınla, kendi deneyiminle değiştir. Özellikle "neden yaptım" kısmı senin hikâyen olmalı; taslaktaki hâli tahminimdir.
