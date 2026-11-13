# Grup 14

Ölçüt: doğruluk, eksiksizlik, istemin istediğini yapma. 1–5 (yarım puan olur). Etiketler her istemde yeniden karıştırıldı.


---

## r05

**İSTEM:**

Bu cümleyi İngilizceye çevir: Yarın toplantıya katılamayacağım.

### r05 · A

**I won't be able to attend the meeting tomorrow.**

Alternatifler:
- Daha resmi: *I will be unable to attend tomorrow's meeting.*
- Daha gündelik: *I can't make it to the meeting tomorrow.*

### r05 · B

"I won't be able to attend the meeting tomorrow."

### r05 · C

Çeviri: "I won't be able to attend the meeting tomorrow."

Daha resmi bir alternatif: "I will not be able to attend tomorrow's meeting."

Kısa not: "Yarın" ifadesi "tomorrow" olarak çevrildi. "Katılamayacağım" gelecek zamanda olumsuzluk olduğu için "won't be able to attend" kalıbıyla karşılandı.


---

## r26

**İSTEM:**

Prove that every bounded monotone sequence of real numbers converges, rigorously.

### r26 · A

**Theorem (Monotone Convergence).** If $(a_n)_{n\ge 1}$ is a monotone sequence of real numbers that is bounded, then $(a_n)$ converges. More precisely, an increasing sequence converges to $\sup_n a_n$, and a decreasing sequence converges to $\inf_n a_n$.

**The tool we rely on: the Completeness Axiom.** Every nonempty subset of $\mathbb{R}$ that is bounded above has a least upper bound (supremum) in $\mathbb{R}$.

---

### Case 1: $(a_n)$ is increasing and bounded above

Suppose $a_n \le a_{n+1}$ for all $n$, and there is some $M$ with $a_n \le M$ for all $n$.

Let $S = \{a_n : n \ge 1\}$. The set $S$ is nonempty because it contains $a_1$, and it is bounded above by $M$. By the Completeness Axiom, $L = \sup S$ exists in $\mathbb{R}$.

**Claim:** $a_n \to L$.

Let $\varepsilon > 0$.

1. **$L$ is an upper bound.** So $a_n \le L$ for every $n$.
2. **$L$ is the *least* upper bound.** So $L - \varepsilon$ is not an upper bound of $S$. That means some index $N$ has $a_N > L - \varepsilon$.
3. **Monotonicity.** For every $n \ge N$ we have $a_n \ge a_N > L - \varepsilon$. (A simple induction on $a_k \le a_{k+1}$ shows that $a_N \le a_n$ whenever $n \ge N$.)

Putting these together, for all $n \ge N$:
$$L - \varepsilon < a_n \le L < L + \varepsilon, \quad\text{so}\quad |a_n - L| < \varepsilon.$$

We chose $\varepsilon > 0$ arbitrarily, so by the definition of a limit, $\lim_{n\to\infty} a_n = L = \sup_n a_n$. $\blacksquare$

---

### Case 2: $(a_n)$ is decreasing and bounded below

Suppose $a_n \ge a_{n+1}$ for all $n$, and there is some $m$ with $a_n \ge m$ for all $n$.

Define $b_n = -a_n$. Then:
- $b_n \le b_{n+1}$, so $(b_n)$ is increasing;
- $b_n \le -m$, so $(b_n)$ is bounded above.

By Case 1, $b_n \to L' = \sup_n b_n$. Since $x \mapsto -x$ preserves limits ($|a_n - (-L')| = |b_n - L'|$), we get $a_n \to -L'$. Also $-\sup_n(-a_n) = \inf_n a_n$, so $a_n \to \inf_n a_n$. $\blacksquare$

---

### Conclusion

A bounded sequence is bounded both above and below. If it is monotone, it is either increasing (Case 1) or decreasing (Case 2), so it converges in either case.

---

**Remarks.**
- **Completeness is essential.** In $\mathbb{Q}$ the theorem fails. For example, the truncated decimal expansions $1,\ 1.4,\ 1.41,\ 1.414,\dots$ of $\sqrt{2}$ form an increasing sequence of rationals bounded by $2$. Their limit $\sqrt2$ is not rational, so the sequence has no limit in $\mathbb{Q}$.
- **Only one bound is needed.** An increasing sequence needs only an upper bound, and a decreasing sequence needs only a lower bound. The other bound holds automatically, given by $a_1$.

### r26 · B

# Theorem

Every bounded monotone sequence of real numbers converges.

Let $(a_n)_{n\ge 1}$ be a real sequence. It is **monotone** if it is nondecreasing ($a_n \le a_{n+1}$ for all $n$) or nonincreasing ($a_n \ge a_{n+1}$ for all $n$). It is **bounded** if there is $M$ with $|a_n| \le M$ for all $n$.

## Tool: the completeness axiom

Every nonempty subset of $\mathbb{R}$ that is bounded above has a least upper bound (supremum) in $\mathbb{R}$.

## Case 1: nondecreasing sequence

Let $S = \{a_n : n \ge 1\}$. $S$ is nonempty and bounded above by $M$, so $L = \sup S$ exists in $\mathbb{R}$.

We show $a_n \to L$. Let $\varepsilon > 0$. Since $L - \varepsilon < L$ and $L$ is the least upper bound, $L - \varepsilon$ is not an upper bound of $S$. Hence there exists $N$ with $a_N > L - \varepsilon$.

Let $n \ge N$. Monotonicity gives $a_n \ge a_N > L - \varepsilon$. Also $a_n \le L$, because $L$ is an upper bound of $S$. So $L - \varepsilon < a_n \le L$, which gives $|a_n - L| < \varepsilon$.

Since $\varepsilon > 0$ was arbitrary, $a_n \to L$.

## Case 2: nonincreasing sequence

Let $b_n = -a_n$. Then $(b_n)$ is nondecreasing and $|b_n| = |a_n| \le M$. By Case 1, $b_n \to L$ for some $L \in \mathbb{R}$. Since $|a_n - (-L)| = |b_n - L|$, we get $a_n \to -L$.

Both cases are covered, so every bounded monotone sequence converges. $\blacksquare$

## Remark

Completeness is essential. Over $\mathbb{Q}$, the decimal truncations $1,\ 1.4,\ 1.41,\ 1.414,\ \dots$ of $\sqrt{2}$ form a bounded increasing sequence of rationals with no rational limit. In $\mathbb{R}$ the limit is $\sqrt{2}$.

### r26 · C

**Theorem (Monotone Convergence).** Every bounded monotone sequence of real numbers converges.

**Tool used.** The Completeness Axiom (least upper bound property): every nonempty subset of R that is bounded above has a supremum (a least upper bound) in R.

**Proof.** Let (a_n) be bounded and monotone.

*Case 1: (a_n) is non-decreasing*, i.e. a_n ≤ a_{n+1} for all n.

Let S = {a_n : n ∈ N}. S is nonempty and bounded above (since the sequence is bounded), so by completeness L = sup S exists in R. We claim a_n → L.

Let ε > 0. Since L − ε < L, the number L − ε is not an upper bound of S (L is the *least* upper bound). Hence there exists N with a_N > L − ε.

Now let n ≥ N. Because the sequence is non-decreasing, a_n ≥ a_N > L − ε. Because L is an upper bound of S, a_n ≤ L < L + ε. Therefore

L − ε < a_n ≤ L < L + ε, so |a_n − L| < ε for all n ≥ N.

Since ε > 0 was arbitrary, this is exactly the definition of a_n → L.

*Case 2: (a_n) is non-increasing*, i.e. a_n ≥ a_{n+1} for all n.

Define b_n = −a_n. Then (b_n) is non-decreasing (a_n ≥ a_{n+1} gives −a_n ≤ −a_{n+1}) and bounded (|b_n| = |a_n|). By Case 1, b_n → M for some M ∈ R. Then for every ε > 0 there is N such that |b_n − M| < ε for n ≥ N, and

|a_n − (−M)| = |−b_n + M| = |b_n − M| < ε for n ≥ N.

So a_n → −M.

In both cases the sequence converges. ∎

**Remarks.**

1. The limit is identified explicitly: sup{a_n} for a non-decreasing sequence, and inf{a_n} for a non-increasing one (in Case 2, −M = −sup{−a_n} = inf{a_n}).

2. Both hypotheses are needed. The sequence a_n = n is monotone but unbounded and does not converge. The sequence a_n = (−1)^n is bounded but not monotone and does not converge.

3. Completeness is essential, not just convenient. In Q, the sequence of decimal truncations of √2 (1, 1.4, 1.41, 1.414, ...) is bounded and increasing, but has no limit in Q. The theorem is in fact equivalent to the Completeness Axiom in an ordered field that is Archimedean.


---

## r07

**İSTEM:**

Şu paragrafı Almancaya tercüme eder misin? Merhaba, ben Antalya'da fizik okuyorum.

### r07 · A

Tabii, işte Almancası:

**Hallo, ich studiere Physik in Antalya.**

Küçük notlar:
- "Merhaba" yerine daha samimi bir ortamda **"Hi"**, resmi bir ortamda **"Guten Tag"** da kullanabilirsin.
- Kendini tanıtırken ismini de eklemek istersen: *"Hallo, ich bin [İsim] und studiere Physik in Antalya."*
- Üniversitenin adını belirtmek istersen: *"Ich studiere Physik an der Akdeniz-Universität in Antalya."*

### r07 · B

Elbette! İşte Almanca çevirisi:

**„Hallo, ich studiere Physik in Antalya."**

Küçük notlar:
- „Merhaba" için resmi olmayan ortamlarda "Hallo" uygundur; daha resmi bir ortamda "Guten Tag" da kullanabilirsiniz.
- „Fizik okuyorum" ifadesi Almancada "Ich studiere Physik" olarak karşılanır (üniversitede okumak anlamında "studieren" kullanılır).

Başka bir metni çevirmemi isterseniz yardımcı olabilirim.

### r07 · C

Almancası:

Hallo, ich studiere Physik in Antalya.


---

## t10

**İSTEM:**

Bir özetleme uygulaması yapmak istiyorum, nasıl başlamalıyım

### t10 · A

# Özetleme uygulamasına başlarken

**1. Kapsamı netleştir**
- Girdi ne? Düz metin, PDF, web sayfası, ses ya da video (önce transkript gerekir)?
- Çıktı ne kadar uzun olacak: üç cümle mi, madde listesi mi, bölüm bölüm özet mi?
- Hedef kullanıcı kim ve veri hassas mı?

**2. Yöntemi seç**
- **Hazır bir dil modeli API'si (önerilen başlangıç):** Claude API ile metni bir prompt'a koyup özet istersin. Kendi model eğitmene gerek yoktur.
- **Çıkarımsal (LLM'siz) yöntemler:** Cümleleri skorlayıp en önemlilerini seçersin (ör. TF-IDF). Daha ucuzdur ama sonuçlar daha kaba olur.

**3. Minimum prototip**
Python ile başlayabilirsin:

```python
import anthropic

client = anthropic.Anthropic()  # API anahtarı ANTHROPIC_API_KEY ortam değişkeninden okunur

def ozetle(metin: str) -> str:
    yanit = client.messages.create(
        model="<güncel-claude-modeli>",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f"Aşağıdaki metni Türkçe, en fazla 5 madde halinde özetle. "
                       f"Yalnızca metinde geçen bilgileri kullan.\n\n{metin}",
        }],
    )
    return yanit.content[0].text
```

**4. Girdiyi hazırla**
- PDF için `pypdf`, web için `requests` ve `BeautifulSoup` kullan.
- Metni temizle: fazla boşlukları, sayfa numaralarını ve tekrarlayan başlık ya da altbilgileri ayıkla.

**5. Uzun metinleri işle**
Metin modelin bağlam sınırını aşıyorsa parçalara böl, her parçayı ayrı özetle, sonra parça özetlerini birleştirip son bir özet üret. Parçalar arasında kısa bir örtüşme bırakmak bağlam kaybını azaltır.

**6. Çıktıyı kontrol et**
- Özette kaynakta olmayan bilgi var mı? Rastgele on örnekte insan kontrolü yap.
- Prompt'a "yalnızca verilen metindeki bilgileri kullan" kuralını ekle.
- Uzunluk, dil ve biçim gibi beklentileri prompt'ta açıkça belirt.

**7. Arayüzü ekle**
Önce komut satırı aracıyla başla, sonra Streamlit ya da FastAPI ile basit bir web arayüzü ekle.

**8. Maliyet ve gizlilik**
Ücret token sayısına göre hesaplanır; uzun belgeler için maliyeti önceden tahmin et. Hassas verileri göndermeden önce veri işleme koşullarını gözden geçir.

**Önerilen ilk adım:** Bir sayfalık bir metinle yukarıdaki scripti çalıştır, çıktının kalitesine bak, ardından girdi türünü ve uzun metin stratejisini belirle.

### t10 · B

Özetleme uygulamasına başlamak için önce neyi, kim için özetleyeceğini netleştirmek en doğrusu. Aşağıdaki sırayı öneririm.

**1. Kapsamı belirle**
- Ne özetlenecek: web makaleleri, PDF'ler, toplantı notları, e-postalar, YouTube videoları?
- Kullanıcı kim ve çıktı nasıl olmalı: kısa paragraf, madde işaretleri, uzunluk seçeneği?
- Dil: sadece Türkçe mi, çok dilli mi?
- Platform: web, mobil, masaüstü veya komut satırı?

**2. Yaklaşımı seç**
- **Çıkarımsal (extractive):** Metindeki önemli cümleleri seçer. Basit ve hızlıdır, ama akıcılığı düşüktür.
- **Soyutlayıcı (abstractive):** Metni yeniden yazar. Büyük bir dil modeline (LLM) API ile istek atarak yapılır ve bugün en pratik yoldur. Türkçede de iyi sonuç verir.

Başlangıç için LLM API'si kullanmanı öneririm. Kendi modelini eğitmek hem pahalıdır hem zordur.

**3. Küçük bir prototip yap**
Önce arayüzsüz, tek bir betikle başla (Python iyi bir seçim):
1. Metni al (yapıştırma, dosya veya URL).
2. Gerekirse temizle (HTML etiketleri, gereksiz boşluklar).
3. Bir prompt ile modele gönder, örneğin "Aşağıdaki metni 5 maddede özetle".
4. Çıktıyı göster.

**4. Uzun metinleri yönet**
Metin modelin bağlam sınırına sığmazsa parçalara böl, her parçayı özetle, sonra özetleri tekrar özetle (map-reduce yöntemi).

**5. Arayüz ekle**
Prototip çalışınca basit bir arayüz kur: Streamlit veya Gradio hızlı bir başlangıçtır. Daha ciddi bir ürün için FastAPI ile arka uç ve React veya benzeri bir ön yüz düşünebilirsin.

**6. Kaliteyi ölç**
- 10-20 örnek metin ve elle yazılmış özetlerden küçük bir test seti oluştur.
- Prompt'u değiştirdikçe sonuçları bu sette karşılaştır.
- Sık hatalara dikkat et: uydurma bilgi, önemli noktanın atlanması, çok uzun veya çok kısa çıktı.

**7. Sonradan düşünülecekler**
Maliyet ve hız (daha küçük modeller, önbellekleme), gizlilik (kullanıcı metinleri nereye gidiyor), hata yönetimi ve kullanıcı geri bildirimi.

**Önerilen ilk adım:** Bu hafta sonu tek bir betik yaz. Bir metin dosyasını okusun, bir LLM API'sine göndersin ve özeti yazdırsın. Bu seni birkaç saatte çalışan bir prototipe götürür ve asıl zor kısımların (uzun metin, kalite) nerede olduğunu gösterir.

İstersen hangi içerik türüyle ve hangi dille çalışmak istediğini söyle. Ona göre daha somut bir mimari ve örnek kod önerebilirim.

### t10 · C

Güzel bir proje. En hızlı yol: önce kapsamı netleştirip küçük bir prototip çıkarmak, sonra büyütmek. Adım adım şöyle ilerleyebilirsin:

**1. Neyi özetleyeceğine karar ver**
- **Girdi türü:** Düz metin mi, PDF/Word mü, web sayfası mı, YouTube videosu veya toplantı kaydı mı? Ses/video için önce konuşmayı metne çevirmen (ör. Whisper) gerekir.
- **Kullanıcı:** Kendin için mi, öğrenciler için mi, şirket içi mi? Bu, arayüzü ve gizlilik ihtiyacını belirler.
- **Çıktı biçimi:** Tek paragraf, madde işaretleri, "ana fikir + aksiyon maddeleri" gibi.

**2. Teknik yaklaşımı seç**
- **Hazır büyük dil modeli API'si (önerilen):** Claude, GPT veya Gemini gibi bir modele metni ve iyi bir talimat (prompt) gönderirsin. Kalite yüksek, kurulum çok kolay.
- **Açık kaynak model:** Ollama ile yerelde Llama/Mistral ya da Hugging Face'teki BART/T5 gibi özetleme modelleri. Veri dışarı çıkmaz, ama donanım ve kalite ayarı gerekir.
- **Klasik yöntem (çıkarımsal):** TextRank gibi algoritmalarla metindeki en önemli cümleleri seçmek. Ücretsiz ve hızlı, ama özetler daha mekanik olur.

**3. Basit bir prototip yap**
Python biliyorsan şu üçlü yeterli:
- **Streamlit** veya **Gradio** ile bir metin kutusu + "Özetle" butonu,
- **pypdf** ile PDF'ten metin okuma,
- Seçtiğin modelin SDK'sı ile özet isteği.

Bu, bir iki akşamda çalışır hale gelir. Web uygulaması istiyorsan arka uç için FastAPI, ön yüz için React/Next.js düşünebilirsin.

**4. Uzun metin sorununu çöz**
Modellerin bir bağlam sınırı vardır. Çok uzun belgelerde metni parçalara böl, her parçayı özetle, sonra bu özetleri birleştirip tekrar özetle ("map-reduce" yaklaşımı).

**5. Kaliteyi test et**
5-10 örnek metin seç, çıkan özetleri kendin değerlendir: Önemli bilgi atlanmış mı? Metinde olmayan bir şey uydurulmuş mu? Talimatı buna göre iyileştir (ör. "yalnızca metindeki bilgileri kullan", "en fazla 5 madde").

**6. Sonra geliştir**
Özet uzunluğu seçimi, dil seçimi, geçmiş özetleri kaydetme, dosya yükleme, maliyet ve hız takibi gibi özellikleri ekle.

**Dikkat edilecekler:** API maliyeti (token başına ücret), kullanıcı verilerinin gizliliği ve API anahtarını asla kodun içinde/ön yüzde açıkta bırakmamak.

İstersen hangi tür içeriği özetlemek istediğini ve hangi dili/teknolojiyi bildiğini söyle; sana ona göre örnek bir başlangıç kodu hazırlayayım.


---

## t04

**İSTEM:**

Sitemi çeviri eklentisiyle ingilizceye açmak istiyorum, nasıl bir yol izlemeliyim

### t04 · A

Sitenin altyapısını belirtmediğin için en yaygın senaryo olan WordPress'e göre anlatıyorum. Mantık diğer platformlarda da aynı.

## 1. Önce hedefini netleştir
- **Sadece ziyaretçi okuyabilsin yeter mi?** Basit bir çeviri widget'ı (ör. GTranslate'in ücretsiz sürümü) işini görür. Ama bu çeviriler genelde Google'da indekslenmez.
- **İngilizce aramalardan trafik mi istiyorsun?** O zaman her dilin kendi URL'si olmalı (ör. `site.com/en/...`) ve sayfalarda `hreflang` etiketleri bulunmalı. SEO açısından asıl önemli olan bu.

## 2. Eklentiyi seç
| Eklenti | Öne çıkan yanı | Dikkat edilecek nokta |
|---|---|---|
| **TranslatePress** | Sayfa üzerinde görsel düzenleme, kolay kullanım | Otomatik çeviri ve SEO özellikleri ücretli sürümde |
| **Polylang** | Ücretsiz sürümü güçlü, hafif | Çeviriyi kendin girersin, otomatik çeviri için ek araç gerekir |
| **WPML** | Kapsamlı, WooCommerce ile uyumu iyi | Ücretli ve biraz ağır |
| **Weglot** | Kurulumu çok hızlı, bulut tabanlı | Aylık abonelik, kelime sınırları var |

Küçük ve orta ölçekli bir site için TranslatePress ya da Polylang çoğu zaman yeterli olur. E-ticaret sitesiyse WPML veya Weglot daha sorunsuz çalışır.

## 3. Uygulama adımları
1. **Yedek al.** Site dosyalarının ve veritabanının tam yedeği olsun.
2. Eklentiyi kur, varsayılan dili Türkçe, ikinci dili İngilizce olarak ayarla.
3. URL yapısını seç: alt dizin (`/en/`) önerilir, kurması en kolay olan ve SEO'ya uygun seçenek bu.
4. Otomatik çeviriyi (DeepL veya Google) açıp ilk taslağı oluşturabilirsin.
5. **Çevirileri elden geçir.** Makine çevirisi özellikle başlıklarda, ürün açıklamalarında ve sloganlarda hata yapar.
6. Sık atlanan yerleri unutma: menüler, footer, widget'lar, form ve hata mesajları, otomatik e-postalar, görsellerin alt metinleri, SEO başlık ve açıklamaları, URL kısımları (slug).
7. Görünür bir **dil değiştirici** ekle (header veya menü). Ziyaretçiyi tarayıcı diline göre zorla yönlendirme, seçimi ona bırak.

## 4. Yayından sonra
- Google Search Console'da İngilizce sayfaların indekslenip indekslenmediğini kontrol et.
- Site haritasında `/en/` sayfalarının yer aldığından emin ol.
- Sayfa hızını ölç, bazı çeviri eklentileri siteyi yavaşlatabiliyor.
- Yeni içerik eklediğinde İngilizcesini de güncellemeyi alışkanlık haline getir.

Siten WordPress değil de Shopify, Wix ya da kendi yazdığın bir sistemse söyle, adımları ona göre uyarlayayım.

### t04 · B

Sitenizi İngilizceye açmak için önce hangi yöntemi kullandığınızı netleştirmeniz gerekir. Çeviri eklentileri hızlıdır ama sınırlıdır; gerçek çok dilli yapı daha kalıcı ve SEO açısından daha sağlıklıdır.

1. Mevcut durumu belirleyin
- Site hangi platformda? (WordPress, Shopify, Wix, Next.js, düz HTML vb.)
- Kaç sayfa var, metinler sık değişiyor mu?
- Arama motorlarında İngilizce sürümün de bulunması önemli mi?

2. Hızlı yol: çeviri eklentisi
- WordPress: TranslatePress, Weglot veya Polylang.
- Shopify: Weglot, Langify veya resmi çeviri uygulamaları.
- Wix: yerleşik "Çoklu dil" özelliği.
- Genel siteler: Google Translate widget'ı (ücretsiz ama kalitesi düşük, SEO için zayıf).
Kurulumdan sonra otomatik çevirileri mutlaka gözden geçirin. Ürün adları, fiyatlar, yasal metinler ve butonlar hatalı çevrilebilir.

3. Daha kalıcı yol: gerçek çok dilli yapı
- Her sayfanın İngilizce karşılığını ayrı URL'de oluşturun (ör. /en/hakkimizda).
- Metinleri JSON/YAML çeviri dosyalarında tutun; i18next, next-intl veya vue-i18n gibi kütüphanelerle okutun.
- Her sayfada hreflang etiketleri ve dile özel meta başlık/açıklama ekleyin.
- sitemap.xml dosyasına İngilizce URL'leri ekleyin.

4. Çeviri sonrası kontrol listesi
- Dil seçici her sayfada görünür ve çalışıyor mu?
- Görsellerin içindeki Türkçe metinler (banner, buton görselleri) için çözüm gerekiyor mu?
- Tarih, para birimi ve sayı biçimleri İngilizce kurala göre gösteriliyor mu?
- Formlar, hata mesajları ve e-posta bildirimleri de çevrildi mi?
- Mobilde taşma veya kırılma var mı? İngilizce metinler genelde daha uzundur.
- Yönlendirmeler dile göre doğru çalışıyor mu, kırık bağlantı var mı?

5. Önerilen sıra
1. Platformunuzu ve hedef kitleyi belirleyin.
2. Bir eklentiyi deneme amaçlı kurup ana sayfada test edin.
3. SEO önemliyse en önemli sayfaları profesyonel çeviriyle ayrı URL'lerde yayınlayın.
4. Kalan sayfaları aşamalı olarak ekleyin ve her adımda kontrol edin.

Platformunuzu ve sitenizin yapısını (sayfa sayısı, kullanılan teknoloji) paylaşırsanız daha somut bir kurulum planı çıkarabilirim.

### t04 · C

Önce sitenizin hangi altyapıda olduğu (WordPress, Wix, Shopify, özel kod vb.) yolu belirler. Genel bir yol haritası şöyle:

**1. Hedefi netleştirin**
- Sadece ziyaretçiye "anlık çeviri" mi istiyorsunuz, yoksa Google'da İngilizce aramalarda da çıkmak mı? İkincisi için sayfaların gerçekten ayrı bir URL'de (örn. /en/) yayınlanması gerekir.

**2. Eklenti türünü seçin**
- **Tarayıcı tarafı widget'lar (Google Translate widget gibi):** Kurulumu en kolay ve ücretsizdir. Ancak çeviri ziyaretçinin tarayıcısında yapılır, Google bu içeriği dizine eklemez, kalite de denetlenemez. Sadece kullanıcı kolaylığı için uygundur.
- **Sunucu tarafı / kalıcı çeviri eklentileri:** WordPress'te TranslatePress, Weglot, WPML, Polylang (+ otomatik çeviri eklentisi) gibi seçenekler var. Bunlar ayrı dil URL'leri üretir, SEO açısından çok daha değerlidir ve çevirileri düzenleyebilirsiniz. Wix, Shopify gibi platformların kendi çok dilli özellikleri ya da uygulama mağazası eklentileri vardır.

**3. Kurulum adımları (WordPress örneği)**
1. Siteyi tam yedekleyin (dosyalar ve veritabanı).
2. Eklentiyi önce bir test ortamında deneyin.
3. Ana dil Türkçe, ek dil İngilizce olarak ayarlayın.
4. URL yapısını seçin: alt dizin (site.com/en/) genellikle en pratik ve SEO dostu olanıdır.
5. Otomatik çeviriyi açın (DeepL veya Google ile en iyi sonucu alırsınız; API anahtarı gerekebilir).
6. Dil değiştirici (bayrak veya "TR | EN" menüsü) ekleyin.

**4. Kaliteyi kontrol edin**
- Otomatik çeviri çoğu zaman iyidir ama marka adları, ürün isimleri, menüler, butonlar ve hukuki metinler (KVKK, iade koşulları) hatalı çıkabilir. En azından ana sayfa, hakkımızda, iletişim ve satış sayfalarını elle gözden geçirin.
- Para birimi, tarih formatı, telefon numarası ve adres bilgilerini uluslararası okuyucuya göre düzenleyin.
- Görsellerin içindeki yazılar, formlar ve hata mesajları çoğu zaman otomatik çevrilmez; ayrıca kontrol edin.

**5. SEO ayarları**
- hreflang etiketlerinin eklendiğinden emin olun (çoğu eklenti bunu yapar).
- İngilizce sayfalar için başlık ve meta açıklamaları ayrıca çevirin.
- Sitemap'i güncelleyip Google Search Console'a gönderin.

**6. Performans ve maliyet**
- Çeviri eklentileri siteyi yavaşlatabilir; önbellek (cache) kullanın.
- Weglot gibi hizmetler kelime sayısına göre aylık ücret alır, DeepL/Google API'leri ise karakter başına faturalanır. Sitenizin kelime sayısına göre bütçe hesaplayın.

**Önerim:** Küçük, bilgi amaçlı bir site ise TranslatePress veya Polylang ile başlayın; büyük, ticari bir site ise Weglot ya da WPML tercih edin. Sadece hızlı bir çözüm arıyorsanız Google Translate widget yeterli olabilir, ama aramalarda görünürlük beklemeyin.

Hangi platformu kullandığınızı ve sitenin kaç sayfa olduğunu söylerseniz, size daha somut bir eklenti ve adım listesi önerebilirim.
