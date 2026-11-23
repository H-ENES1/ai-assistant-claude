> **Kural 1:** Kendi profilinden kendi projeni paylaşmak serbest; LinkedIn'de bilinen bir kural engeli yok. Metin üst sınırı 3000 karakter; akışta yaklaşık ilk 2–3 satır görünür, gerisi "…daha fazla"nın arkasında kalır, bu yüzden ilk satır önemli.
> **Kural 2:** Bağlantılar ilk yoruma konuyor (yaygın uygulama: gönderi gövdesindeki dış bağlantının erişimi düşürdüğü düşünülüyor; LinkedIn bunu resmî olarak doğrulamıyor, ölçmedim). Video doğrudan yüklenir (YouTube bağlantısı değil).

---

**Video:** `site/build/video/out/linkedin-tr.mp4` (4:5, 1080×1350, 56 sn, müzikli; İngilizcesi `linkedin-en.mp4`). Dosya büyük olduğu için depoya girmez; klasörde yoksa `node site/build/video/render4.cjs linkedin` ile üretilir (bkz. `site/build/OKU.md`). Kapak: `site/video/kapak-tr.jpg`. Videoda arayüz temsilidir ve üstünde böyle yazar; ses şart değil, bütün anlatım ekrandaki yazılarda. LinkedIn'de çoğu kişi sessiz izliyor, yazıların okunduğunu telefonda bir kez kontrol et.

## Gönderi metni

Claude'a bir mesaj atmadan önce, o mesajın limitimden ne kadar yiyeceğini bilmek istedim. Bilemeyince kendim yaptım. 🙂

Fizik öğrencisiyim. Claude'u ödevlerde, kodda ve okuduklarımı anlamakta çok kullanıyorum. Sık yaşadığım şey şu: 5 saatlik limit tam işin ortasında bitiyor, hem de pahalı olacağını hiç düşünmediğim bir mesajda. claude.ai harcadığını gösteriyor ama ancak harcadıktan sonra.

Bu yüzden ücretsiz bir Chrome eklentisi yazdım: Token Tahmini.

▪ Mesaj kutusunun yanında, göndermeden önce 5 saatlik ve haftalık limitin yaklaşık yüzde kaçının gideceğini bir aralıkla gösteriyor.
▪ Bu iş için hangi model ve effort seviyesinin yeteceğini, nedenini de yazarak öneriyor. Emin değilse daha hafif model önermiyor.
▪ Kullandıkça planını öğreniyor: her mesajdan sonra tahminini gerçek değişimle karşılaştırıyor.
▪ Haftalık bir rapor çıkarıyor.

Gizlilik benim için pazarlık konusu değildi: sunucu yok, analitik yok. Mesajların, eklerin, sohbetlerin bilgisayarından çıkmıyor; eklenti yalnızca claude.ai ile senin oturumunla konuşuyor.

Dürüst olayım: Anthropic limit büyüklüklerini yayımlamıyor, bu yüzden sayılar tahmin. Simülasyonda 20 mesajdan sonra plan tahmini hatası 1,68 kattan 1,13 kata iniyor; gerçek hesaplarda bu daha az sınandı. Model önerilerini de bir kez kör test ettim: yeterince iyi ama gereğinden temkinli, geliştirmeye devam ediyorum.

Açık kaynak (AGPL-3.0), arayüz 10 dilde. Kodun büyük kısmını Claude Code ile yazdım; tasarım, ölçümler ve kararlar benim.

Kullanırsan, tahminin nerede çok saptığını yazarsan çok sevinirim. Bağlantılar ilk yorumda. 👇

#Claude #YapayZeka #AçıkKaynak #ChromeEklentisi #Öğrenci

## İlk yorum (gönderiden hemen sonra kendin yaz)

🔗 Chrome Web Store (ücretsiz): https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige
🌐 Site ve canlı demo: https://h-enes1.github.io/ai-assistant-claude/
💻 Kaynak kod: https://github.com/H-ENES1/ai-assistant-claude
▶️ 4 dakikalık anlatım (YouTube): https://www.youtube.com/watch?v=6Y4qZ-G2AS0
🔒 Gizlilik politikası: https://h-enes1.github.io/ai-assistant-claude/privacy.html

Edge ve Brave aynı mağaza sayfasından kurabiliyor; Opera'da "Install Chrome Extensions" eklentisiyle çalışıyor. Anthropic ile bir bağlantısı yok, bağımsız bir öğrenci projesi.

---

**Not:** "Fizik öğrencisiyim…" paragrafı senin hikâyen; kendi cümlelerinle değiştir. Uzunluk: gönderi metni 3000 karakterin altında (kontrol edildi).
