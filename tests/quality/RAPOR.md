# Model önerisinin kalitesi: ilk ölçüm (11.11.2026)

Eklenti "bu mesaj için şu model yeter" diyor. Bu rapor, o önerinin gerçekten yeterli en hafif modeli gösterip
göstermediğini ilk kez ölçüyor. Tüm sayılar `analyze.mjs` çıktısıdır (`tablolar.md`, `sonuc.json`); elle
hesaplanan ya da tahmin edilen her sayı "tahmin" diye işaretlidir.

## Kısa sonuç

- **Haiku önerisi tuttu.** Kendi başına cevaplanabilir 13 istemde Haiku önerildi; 13'ünde de Haiku'nun cevabı
  4 ve üstü puan aldı, 12'sinde en iyi cevaba 0,5 puan içindeydi. Tek istisna tek kelimelik bir çeviri (c09):
  çeviri doğru, eklenen telaffuz notu yanlış.
- **Hafif öneri hatası: 58 istemde 5 (%9; Wilson %95 aralığı %4–19).** Bunların 4'ü "Sonnet önerildi, yalnızca
  Opus yetti" türünde. Biri ölçüm düzeninin kusuru (dil kayması); o sayılmazsa 4.
- **Gereksiz ağır öneri: 58 istemde 33 (%57; %44–69).** Çoğu "Sonnet önerildi, Haiku da yetti" (27 istem);
  Opus önerilen 6 istemin 6'sında daha hafif bir model yetti. **Bu sayı olduğundan büyük görünüyor:** cevaplar
  400 kelimeyle sınırlandı, tek mesajlık ve eksiz istemlerle ölçüldü. Mimari tasarım, uzun türetme, uzun yazı
  gibi işlerde güçlü modelin farkı 400 kelimeye sığmaz (bkz. Sınırlar).
- **Eşik değişikliği önermiyorum.** Hafif hatalar tek bir eşiğin çevresinde toplanmıyor; ağır öneriler ise bu
  ölçümün en zayıf olduğu yerde. Ayrıntı: "Eşikler" bölümü.

## Yöntem

1. **İstemler (80):** `tests/rec-cases.json` (50), `tests/advisor.test.mjs` içindeki sohbet cümleleri (10),
   `tests/traps.test.mjs` tuzakları (15) ve kontrolleri (5). Her biri için `advise()` çıktısı (model ailesi +
   effort) `prompts.json`'a yazıldı. Öneri dağılımı: Haiku 18, Sonnet 55, Opus 7, Fable 0.
2. **Bağlamsız istemler (22):** "Devam et", "Bu makaleyi özetle", "Bu CSV'yi analiz et" gibi metni, dosyası
   ya da önceki sohbeti eksik istemler. Cevaplar görülmeden önce işaretlendi. Bunlarda doğru cevap "metni
   gönderir misin" olduğundan kalite farkı ölçülemez; ana sayılar kalan **58 istem** üzerindendir.
3. **Cevaplar (240):** Her istem üç ayrı alt ajana (Haiku 5.5, Sonnet 5.5, Opus 5.5) verildi. Alt ajan yalnızca
   istemi ve "sohbet asistanı olarak cevapla, araç kullanma, istemin dilinde, en fazla 400 kelime" talimatını
   aldı. Model kimlikleri üç deneme ajanıyla doğrulandı.
4. **Körleme:** Alt ajanlar cevabı dosyaya yazdı, ana oturuma yalnızca "tamam" döndü. `blind.mjs` her istemde
   üç cevabı rastgele A/B/C yaptı ve istem sırasını karıştırdı. Eşleme, puanlar commit edildikten sonra açıldı
   (commit `bf49601` puanlar, sonraki commit eşleme).
5. **Hakem:** Fable 5.2, 5'er istemlik 16 grup. Ölçüt: doğruluk, eksiksizlik, istemin istediğini yapma; 1–5,
   yarım puanlı. Her istem için tek cümle gerekçe `scores/` altında.
6. **Kural:** Kabul edilebilir = puan ≥ 4 ve en iyi cevaptan en fazla 0,5 düşük. Yeterli en hafif model =
   kabul edilebilir ilk model (Haiku → Sonnet → Opus). (a) hafif öneri: öneri bundan hafif. (b) ağır öneri:
   öneri bundan ağır.

## Sayılar

### Genel

| | n | uygun | (a) hafif | (b) ağır | ölçülemedi |
|---|---|---|---|---|---|
| Kendi başına cevaplanabilir | 58 | 19 | 5 | 33 | 1 |
| Bağlamsız | 22 | 4 | 2 | 16 | 0 |
| Tümü | 80 | 23 | 7 | 49 | 1 |

Bundan sonraki bütün sayılar 58 istem içindir.

| | Haiku | Sonnet | Opus |
|---|---|---|---|
| Ortalama puan | 4,48 | 4,75 | 4,92 |
| Kabul edilebilir cevap | 43 | 50 | 57 |
| 4'ün altında puan | 7 | 4 | 1 |
| "Yeterli en hafif" olduğu istem | 43 | 10 | 4 |

58 istemin 40'ında üç model de kabul edilebilirdi; 22'sinde üçü aynı puanı aldı. Bir istemde (r19) hiçbiri 4'e
ulaşmadı.

### Önerilen modele göre

| Öneri | n | uygun | (a) hafif | (b) ağır | ölçülemedi | önerilen modelin kendi cevabı kabul edilebilir |
|---|---|---|---|---|---|---|
| Haiku | 13 | 12 | 1 | 0 | 0 | 12 |
| Sonnet | 39 | 7 | 4 | 27 | 1 | 31 |
| Opus | 6 | 0 | 0 | 6 | 0 | 6 |

Opus önerilen 6 istemde yeterli en hafif model 4 kez Haiku, 2 kez Sonnet çıktı.

### İş türüne göre

| Tür | n | uygun | (a) hafif | (b) ağır | ölçülemedi |
|---|---|---|---|---|---|
| translate | 7 | 6 | 1 | 0 | 0 |
| rewrite | 3 | 3 | 0 | 0 | 0 |
| short_qa | 3 | 3 | 0 | 0 | 0 |
| explain | 6 | 2 | 0 | 4 | 0 |
| writing | 6 | 1 | 0 | 4 | 1 |
| math | 6 | 0 | 0 | 6 | 0 |
| code_write | 18 | 3 | 1 | 14 | 0 |
| code_fix | 3 | 0 | 1 | 2 | 0 |
| research | 4 | 1 | 1 | 2 | 0 |
| file_create | 2 | 0 | 1 | 1 | 0 |

### Konu alanına göre

Yalnızca n ≥ 7 olan alanlar; tamamı `tablolar.md`'de. Diğer alanlarda n ≤ 4, okunmaz.

| Alan | n | uygun | (a) hafif | (b) ağır |
|---|---|---|---|---|
| software | 15 | 1 | 2 | 12 |
| language | 11 | 6 | 1 | 4 |
| general | 8 | 5 | 0 | 3 |
| math | 7 | 0 | 0 | 7 |

### Sonuç kurala ne kadar bağlı

| En az puan | En iyiden en fazla fark | uygun | (a) hafif | (b) ağır | ölçülemedi |
|---|---|---|---|---|---|
| 4 | 0,5 (ana kural) | 19 | 5 | 33 | 1 |
| 4 | 1 | 18 | 1 | 38 | 1 |
| 4 | sınırsız | 18 | 1 | 38 | 1 |
| 4,5 | 0,5 | 18 | 7 | 32 | 1 |

Kural gevşetilince hafif hatalar 5'ten 1'e iniyor: geriye yalnızca r44 kalıyor. r33, r42 ve c09'da önerilen
modelin cevabı 4 almış, yalnızca en iyi cevaptan 1 puan geride: bunlar "kötü cevap" değil, "daha iyisi vardı"
türünde. Önerilen modelin kendi cevabının 4'ün altında kaldığı hafif hatalar ikidir: r44 ve t02 (ikisinde de
Sonnet 3,5).

Dil kayması cezası geri verilirse (bkz. Sınırlar 5): uygun 18, hafif 4, ağır 35, ölçülemedi 1.

### rec-cases etiketleriyle karşılaştırma

`rec-cases.json` her istem için yazarın "kabul edilebilir" saydığı modelleri tutuyor. Ölçülen "yeterli en hafif
model" 57 istemin 30'unda bu listenin içinde. 25 istemde yazarın listesindeki en hafif model ölçülenden ağır,
2 istemde listedeki en ağır model ölçülenden hafif (r33, r44). Yazar etiketleri de, eklenti de aynı yöne
(temkinli) eğimli.

## 10 örnek

| # | İstem | Öneri | H / S / O | Yeterli en hafif | Sonuç | Ne oldu |
|---|---|---|---|---|---|---|
| 1 | k01 "Bu cümleyi İngilizceye çevir: yarın görüşürüz" | Haiku | 5 / 5 / 5 | Haiku | uygun | Üç çeviri de doğru. Haiku kapısının beklenen çalışması. |
| 2 | c09 "Bu kelimeyi Fransızcaya çevir: kitap" | Haiku | 4 / 5 / 5 | Sonnet | hafif | Haiku "livre" dedi (doğru), ama eklediği telaffuz notu yanlıştı. Kural gereği hafif; kötü cevap değil. |
| 3 | r44 "Bütçe takibi için bir Excel dosyası oluştur" | Sonnet | 3 / 3,5 / 5 | Opus | hafif | Haiku çok ölçütlü toplamda yanlış işlevi kullandı, Sonnet'in bir formülünde başvuru hatası vardı; yalnızca Opus'un formülleri çalışır durumdaydı. En net hafif hata. |
| 4 | t02 "Çok dilli … kullanıcı girişli, veritabanlı. Baştan sona kodla." | Sonnet | 4 / 3,5 / 5 | Opus | hafif | Opus çalışır bir iskelet verdi; Sonnet çoğunlukla soru sordu, Haiku parça kod verdi. Karmaşıklık 0,45, Opus eşiğinin (0,5) hemen altında. |
| 5 | r42 "Plazmonik indis artırımı üzerine son 5 yılın literatürü…" | Sonnet | 3,5 / 4 / 5 | Opus | hafif | Opus terimi "etkin kırılma indisinin artırılması" olarak okudu; Haiku ve Sonnet algılayıcı duyarlılığına yordu. |
| 6 | r33 "TypeError: Cannot read properties of undefined (reading 'map')" | Sonnet | 3,5 / 4 / 5 | Opus | hafif | İçerik üçünde de doğruydu; Haiku ve Sonnet İngilizce isteme Türkçe cevap verdi. Düzen kusuru: ceza geri alınınca Haiku yeterli. |
| 7 | r22 "x^2 - 5x + 6 = 0 denklemini çöz" | Sonnet, effort yüksek | 5 / 5 / 5 | Haiku | ağır | Üçü de iki yöntemle doğru çözdü. r23 (integral) ve r24 (olasılık) aynı. |
| 8 | r34 "Kapsamlı bir e-ticaret sitesinin mimarisi… production seviyesinde" | Opus, effort çok yüksek | 5 / 5 / 4,5 | Haiku | ağır | 400 kelimelik özet düzeyinde üç model de aynı başlıkları saydı. Gerçek kullanımdaki uzun, ayrıntılı tasarımı ölçmüyor. |
| 9 | r17 "Hocama ödev teslimini ertelemesi için kibar bir e-posta yaz" | Sonnet | 3,5 / 5 / 5 | Sonnet | uygun | Haiku'nun konu satırında yazım hatası vardı ve öğrenci kendini tanıtmıyordu. Önerinin Haiku'ya inmemesi doğru. |
| 10 | r19 "Kara delikler… 1500 kelimelik popüler bilim makalesi" | Sonnet | 3 / 3,5 / 3,5 | yok | ölçülemedi | İstem 1500 kelime istiyor, düzen 400'le sınırlıyor. Üç cevap da doğru ama kısaltılmış. |

## Eşikler

Görev: kanıt varsa en fazla 3 küçük eşik önerisi. **Kanıt yetmiyor; `advisor.js`'e dokunmadım, öneri commit'i
yok.** Nedenleri:

1. **Hafif hatalar bir eşikte toplanmıyor.** Sonnet önerilen dördünün türleri ayrı (file_create, code_fix,
   research, code_write), karmaşıklıkları sırasıyla 0,01 / 0,12 / 0,38 / 0,45. Opus eşiğini 0,5'ten 0,45'e çekmek t02'yi düzeltir, ama aynı
   bantta Sonnet'in ya da Haiku'nun yettiği 4 istemi (t01, t06, t13, t15) gereksiz ağırlaştırır.
2. **Ağır öneriler ölçümün en zayıf yerinde.** 400 kelime sınırı tam da Opus önerilen işlerin (mimari, türetme)
   farkını siliyor. Bu veriyle Opus ya da Sonnet eşiğini gevşetmek, projenin "hafif öneri en kötü hata" ilkesine
   aykırı bir riski tek hakemli 58 isteme dayandırmak olur.
3. **Testler izin vermiyor.** Haiku'nun yettiği kısa kod ve basit matematik istemlerinde (r22–r24, r28–r32)
   öneriyi Haiku'ya çekmek, `rec-cases.json`'da yalnızca Sonnet etiketli r23, r29, r30'u "gerekenden hafif"
   yapar ve "hafif öneri = 0" kuralını bozar. Bu, eşik değil etiket kararıdır.

Bir sonraki ölçümde sınanmaya değer üç varsayım (kod değişikliği değil):

- **"Baştan sona kodla / tamamını yaz" istekleri** karmaşıklık 0,45–0,5 bandında Sonnet'te kalıyor (t02). Kelime
  sınırı olmadan 10–15 benzer istemle ölçülmeli.
- **Dosya üretimi (file_create)** formül ve yapı doğruluğu istiyor; tek örnekte (r44) yalnızca Opus doğruydu.
  5–10 tablo/formül istemiyle tekrarlanmalı.
- **Basit matematik ve kısa kod** için Haiku bu ölçümde 8 istemin 8'inde yetti (r22–r24, r28–r32). Yazar etiketleri (r23, r29,
  r30) gözden geçirilirse Haiku kapısı bu türlere dar bir koşulla açılabilir; önce etiket, sonra eşik.

Eşik denemesi için yeni cevap gerekmez: `advisor.js` değiştirildikten sonra `build-prompts.mjs` ve `analyze.mjs`
aynı puanlarla yeni öneriyi karşılaştırır (bkz. `run.md`).

## Sınırlar

1. **Hakem de bir model.** Tek hakem (Fable 5.2), tek tur, insan denetimi yok. Hakem, cevaplayan modellerle
   aynı aileden; kendi tarzına yakın cevabı kayırıyor olabilir. Puanların insan gözüyle uyumu ölçülmedi.
2. **400 kelime sınırı farkları sıkıştırıyor.** 58 istemde ortalama cevap uzunluğu Haiku 202, Sonnet 250,
   Opus 260 kelime; sınırı aşan cevap sayısı 1 / 3 / 7.
   Uzun ve derin çıktı isteyen işlerde (mimari, türetme, 1500 kelimelik yazı) güçlü modelin üstünlüğü bu
   uzunlukta görünmez. "Gereksiz ağır öneri" sayısı bu yüzden bir üst sınır gibi okunmalı.
3. **İstem başına tek cevap.** 58 istemin 5'inde Haiku, Sonnet'ten en az 0,5 puan yüksek aldı; 2'sinde Sonnet
   Opus'tan yüksek aldı. Bu, tek örnekteki rastlantının yarım puan düzeyinde olduğunu gösteriyor. Tek tek
   istemlerin "yeterli en hafif modeli" gürültülü; toplam sayılara bakılmalı.
4. **İstemler sentetik ve tek mesajlık.** Gerçek kullanımdaki uzun sohbet, ek dosya ve yarım bağlam yok. 80
   istemin 22'si bağlamsız çıktı. Sınıflandırıcı gerçek kullanıcı mesajlarıyla da ölçülmemişti; bu ölçüm o boşluğu
   kapatmıyor.
5. **Ölçüm düzeni claude.ai değil.** Alt ajanlar Claude Code sistem istemiyle çalıştı ve deponun `CLAUDE.md`
   dosyasını gördü. Bilinen etkileri:
   - *Dil kayması:* `CLAUDE.md` "Türkçe konuş" dediği için 18 İngilizce istemin 4'ünde 5 cevap Türkçe geldi
     (Haiku 3, Sonnet 2, Opus 0). Hakem bunlardan 1 puan kesti; etkisi yukarıda ayrıca verildi.
   - *İç talimatın sızması:* "Şu metni sadeleştir" (r10) ve "TL;DR of this thread" (r12) istemlerinde bazı
     cevaplar düzenin alt ajana eklediği dönüş talimatını kullanıcı metni sandı. İkisi de bağlamsız grupta.
   - *Bulaşma:* r38 ("Claude limitlerini tahmin eden bir tarayıcı eklentisi tasarla") tam bu projeyi tarif
     ediyor ve alt ajanlar proje belgesini görüyordu. Önceden işaretlemedim; ana sayılarda duruyor (uygun).
6. **Körlük kusursuz değil.** Beş alt ajan dönüş mesajında cevabın niteliğini sezdirdi ve bir cevap metninde
   kendi modelini yazdı (hepsi bağlamsız istemlerde); bir alt ajan cevabı tekrar etti (r05; silinip yeniden
   cevaplatıldı). Hepsi `olaylar.txt`'de. Hakem ayrıca üslup ve uzunluktan modeli sezebilir.
7. **Effort ölçülmedi, Fable cevaplatılmadı.** Alt ajanların effort'u ayarlanmadı; eklentinin effort önerisi
   kaydedildi ama sınanmadı. Hiçbir isteme Fable önerilmediği için en üst kademe de sınanmadı.
8. **Örneklem küçük.** 58 istem; iş türü ve alan kırılımlarında hücrelerin çoğu n ≤ 7. Yüzdelerin güven aralığı
   geniş (hafif için %4–19). Kırılım tabloları eğilim gösterir, kanıt değildir.
9. **Maliyet.** Alt ajan başına 34–48 bin token ölçüldü; 240 cevap için toplam ≈ 10 milyon token (tahmin:
   240 × ~43 bin). İş, aynı hesapta çalışan ikinci bir oturumla birlikte 5 saatlik limiti iki kez doldurdu.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `prompts.json` | 80 istem, sınıflandırma ve eklentinin önerisi |
| `answers/{haiku,sonnet,opus}.json` | 240 cevap |
| `blind/grup-NN.md`, `blind/key.json` | Hakemin gördüğü körlenmiş gruplar ve eşleme |
| `scores/grup-NN.json` | Kör puanlar ve tek cümlelik gerekçeler |
| `sonuc.json`, `tablolar.md` | Analiz çıktısı; istem başına tablo burada |
| `olaylar.txt` | Körlüğü zedeleyen olaylar ve kesintiler |
| `run.md` | Ölçümü yeniden çalıştırma kılavuzu |
