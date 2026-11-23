> **Kural 1:** Show HN, insanların deneyebileceği, senin üzerinde çalıştığın ve başlıkta konuşabileceğin bir proje için; başlık "Show HN:" ile başlar, kayıt istemeden denenebilir olmalı; arkadaşlarından oy/yorum isteme ([Show HN kuralları](https://news.ycombinator.com/showhn.html)). Mart 2026'da yeni hesapların Show HN'ini kısıtlama tartışması oldu; resmî bir karma sınırı bulamadım.
> **Kural 2:** "Don't post generated text or AI-edited text" — kural gönderilere de uygulanıyor; başlıkta abartı, büyük harf, ünlem yok; HN'i esas olarak tanıtım için kullanma ([HN guidelines](https://news.ycombinator.com/newsguidelines.html)). **Bu yüzden burada hazır metin yok:** metni ve yorum cevaplarını kendin yazmalısın.

---

## Ne gönderilir

- **URL:** https://github.com/H-ENES1/ai-assistant-claude (HN okuru kaynağı görmek ister; mağaza sayfası "landing page" gibi durur). Mağaza bağlantısını kendi ilk yorumuna koy.
- **Başlık (≤ 80 karakter), seçenekler — istersen kendi kelimelerinle değiştir:**
  - `Show HN: Forecast how much of your Claude usage limit a message will use`
  - `Show HN: A browser extension that learns your Claude plan size from rounded %`
- **Hesap:** Eski ve biraz yorum geçmişi olan bir hesaptan gönder. Hiç kullanmadığın yeni bir hesapsa önce birkaç hafta normal yorum yap.

## İlk yorumunda değinebileceğin malzeme (cümleleri sen kur)

HN'de iyi giden ilk yorum: kim olduğun, neden yaptığın, teknik olarak ilginç olan şey, zayıf noktalar. Madde madde gerçekler:

1. Sorun: claude.ai limiti yüzde olarak gösteriyor, ama yalnızca harcandıktan sonra. Sen limitin iş ortasında bittiğini yaşadın (kendi deneyiminle anlat).
2. Ne yapar: gönderimden önce 5 saatlik ve haftalık limitin yüzde kaçı, %80 aralıkla; model ve effort önerisi gerekçesiyle; emin değilse hafif model önermez.
3. İlginç kısım 1 (HN'in seveceği): yüzdeler tam sayıya yuvarlanıyor, kısa mesajlarda Δ çoğunlukla 0 ya da 1. Oranların ortalaması yanlı; Gamma-Poisson eşlenik güncellemesiyle (a += Δ, b += C) toplamların oranı. 45 günlük yarı ömür. (`extension/lib/calibrate.js`)
4. İlginç kısım 2: claude.ai mesajı Web Worker'dan gönderiyor; fetch kancası görmüyor; ölçüm sayfa yapısından (son kullanıcı mesajı değişti = gönderildi).
5. Token sayımı: tarayıcıda Claude tokenizer'ı yok; dil başına doğrusal özellikler, o200k'ya NNLS ile oturtulmuş (tipik hata EN %3, TR %7, kod %9) × 1,4 (lugia19'un ölçümü, İngilizce).
6. Sayılar ve sınırları: 300 sanal planda medyan hata 1,68 → 20 mesajda 1,13 kat. Gerçek hesapta yalnızca temel akış doğrulandı (3 ölçüm). Tek mesaj ~1,7 kat tabanının altına inemez.
7. Öneri kalitesi: kör ilk ölçüm, model hakem (insan yok); Haiku önerilen 13/13'te iyi; 58'de 5 gerekenden hafif; 33'ünde gerekenden ağır (400 kelime sınırı yüzünden abartılı olabilir).
8. Gizlilik: sunucu yok, analitik yok; yalnızca claude.ai'ye kullanıcının oturumuyla istek; e2e testi ağı denetliyor.
9. AGPL-3.0, ücretsiz, öğrenci projesi, Anthropic'le bağlantısı yok.
10. Kodun büyük kısmı Claude Code ile yazıldı. HN bunu soracak; baştan dürüstçe söylemek daha iyi.

## Beklenen eleştiriler (cevapları kendin yaz; TAKVIM.md'deki SSS'den yararlan)

- "Bu ToS'a aykırı mı / hesabım kapanır mı?"
- "Neden Anthropic bunu kendisi göstermiyor?"
- "Tahmin bu kadar belirsizse ne işe yarar?" (cevap: blok toplamı ve aralık; tek mesaj değil)
- "Model hakem ile kalite ölçmek döngüsel değil mi?" (haklı; insan hakem yok, bunu kabul et)
- "Firefox?"

## Davranış

- Gönderdikten sonra ilk 2–3 saat başında ol, her yoruma cevap ver.
- Yorumları ve cevapları yapay zekâya yazdırma (kural). Çeviri/yazım düzeltme aracı istisna.
- Kimseye link atıp "oy ver" deme; HN bunu tespit edip gönderiyi cezalandırıyor.
