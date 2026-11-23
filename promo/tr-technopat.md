> **Kural 1:** Technopat Sosyal'de reklam ve reklam içerikli mesaj yasak; imzada ticari adres olmaz; ceza 1 aylık uyarıdan başlıyor ([Technopat Sosyal Kuralları](https://www.technopat.net/sosyal/konu/technopat-sosyal-kurallari.3056861/), [Uyarı süreleri](https://www.technopat.net/sosyal/konu/technopat-sosyal-uyari-sureleri-ve-yasakli-siteler.3058110/); sayfalar bot erişimine 403 verdi, arama özetinden okundu).
> **Kural 2:** Kendi Chrome eklentisini paylaşmak isteyen bir kullanıcıya moderatörlerin **kaynak kodu açık paylaşma** şartı koyduğu görülüyor ([eklenti etiketi](https://www.technopat.net/sosyal/etiket/eklenti)). Proje açık kaynak olduğu için uygun; yine de **açmadan önce doğru bölümü seç ya da bir moderatöre özel mesajla sor.** Kaynak kod bağlantısı ilk sırada olsun, imzaya link koyma.

---

**Bölüm:** Yazılım / programlama ile ilgili, kullanıcı projelerinin paylaşıldığı bölüm (adını sitede doğrula). Emin değilsen moderatöre sor.
**Ton:** Reklam değil, "yaptım, kodu açık, geri bildirim istiyorum".

## Başlık

Claude limitini mesajı göndermeden önce tahmin eden açık kaynak bir Chrome eklentisi yaptım, geri bildirim arıyorum

## Mesaj

Merhaba,

Fizik öğrencisiyim. Claude'u (claude.ai) çok kullanıyorum ve sık sık 5 saatlik limitin iş ortasında bittiğini yaşıyorum. Ayarlar → Kullanım sayfası yalnızca harcadığını gösteriyor, mesaj atmadan önce ne kadar gideceğini söylemiyor. Bunun için bir Chrome eklentisi yazdım; kodu tamamen açık, burada da paylaşıp görüş almak istedim.

**Ne yapıyor**
- Mesaj kutusunun yanında, göndermeden önce mesajın 5 saatlik ve haftalık limitin yaklaşık yüzde kaçını harcayacağını bir aralıkla gösteriyor. Mesajı, ekleri (resim, PDF, Word, Excel), sohbet geçmişini, modeli, effort'u ve önbelleği hesaba katıyor.
- Hangi model ve effort'un yeteceğini gerekçesiyle öneriyor. Emin değilse daha hafif model önermiyor; sağlık, hukuk, para sorularında hiç önermiyor.
- Uzun bir sohbette model değiştirince yeni modelin bütün geçmişi baştan okuyacağını (pahalı olduğunu) uyarıyor.
- Kullandıkça planını öğreniyor ve haftalık rapor çıkarıyor.

**Gizlilik**
Sunucu yok, analitik yok, takip yok. Mesaj metni, ekler ve sohbetler bilgisayardan çıkmıyor; eklenti yalnızca claude.ai'ye senin oturumunla istek atıyor. İzinleri: depolama, alarm, bildirim ve yalnızca claude.ai. İlk kurulumda neyi okuduğunu gösterip onay istiyor.

**Dürüst sınırlar**
- Anthropic limit büyüklüklerini yayımlamıyor; sayılar tahmin. Eklenti kullandıkça kendi hesabından öğreniyor. Simülasyonda 20 mesajdan sonra plan tahmininin hatası 1,68 kattan 1,13 kata iniyor; gerçek hesaplarda az sınandı.
- claude.ai'nin belgelenmemiş iç yapısına dayanıyor; site değişirse güncelleme gerekiyor (eklentide bunu gösteren bir sağlık ekranı var).
- Mesaj analizi (iş türü, model önerisi) şimdilik yalnızca Türkçe ve İngilizce mesajlarda çalışıyor.
- Resmî bir Anthropic aracı değil; bağımsız bir öğrenci projesi.

Ücretsiz, açık kaynak (AGPL-3.0). Chrome, Edge, Brave'de mağazadan kuruluyor; Opera'da "Install Chrome Extensions" eklentisiyle çalışıyor.

- Kaynak kod: https://github.com/H-ENES1/ai-assistant-claude
- Chrome Web Store: https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige

Özellikle tahminin çok saptığı durumları ve kafa karıştıran yerleri yazarsanız çok işime yarar. Teşekkürler.

---

**Not:** Kural sayfasını doğrudan okuyamadım. Konu açmadan önce kuralları kendin oku; moderatör "reklam" derse tartışma, konuyu kaldırmalarına izin ver. Bir ekran görüntüsü ekle: `store/tr/screenshot-1-forecast.png`.
