# Claude için Token Tahmini (sürüm 0.9.1)

Bir mesajın Claude kullanım limitinin ne kadarını kullanacağını **göndermeden önce** tahmin eden, uygun olduğunda daha ucuz bir model öneren ve limit bitmeden uyaran tarayıcı eklentisi. Türkçe ve İngilizce.

## Ne yapar?

- **Gönderim öncesi tahmin:** Prompt, ekler (görsel, PDF, Word, Excel, metin), sohbet geçmişi, model, effort ve önbellek durumundan 5 saatlik ve haftalık limit yüzdesini %80 aralıkla verir.
- **Model ve effort önerisi:** Soru tipine ve karmaşıklığa göre Haiku / Sonnet / Opus / Fable'dan hangisinin yeteceğini ve ne kadar tasarruf sağlayacağını söyler.
- **Uyarılar:** "Bu mesaj limitine sığmaz", bağlam penceresi, önbellek süresi dolmuş sohbet, çok uzun sohbet, yoğun saat, büyük PDF kuralları.
- **Kalan limitle yapılabilecekler:** Kalan yüzdeyle kabaca kaç kısa soru, açıklama, kod düzeltme vb. yapılabileceğini temkinli olarak gösterir.
- **Bildirimler:** Eşik bildirimleri (varsayılan %50 / %75 / %90), "limit yenilendi" bildirimi, araç çubuğu rozeti.
- **Kişisel kalibrasyon:** Her mesajdan önce ve sonra gerçek kullanım yüzdesini ölçer, tahmini kullanıcının planına ve alışkanlıklarına göre düzeltir. Doğruluğu açıkça gösterir ("gerçek değerlerin %X'i aralıkta").

## Kurulum (geliştirici modu)

1. Depoyu indir (Code → Download ZIP) ve bir klasöre çıkar.
2. `chrome://extensions` (Opera: `opera://extensions`) → **Geliştirici modu** açık.
3. **Paketlenmemiş öğe yükle** → depodaki **`extension/`** klasörünü seç (içinde `manifest.json` olan klasör).

Not: 0.9.0'dan itibaren eklenti senin kullanımından öğrenir. Güncellerken eklentiyi **kaldırma**: klasördeki dosyaları yenileriyle değiştirip uzantılar sayfasında ↻ yenile'ye bas. Kaldırırsan öğrendikleri silinir.

## Geliştirme

```
cd tests && npm install
npm run test   # birim testler
npm run rec    # model önerisi testi (50 prompt)
npm run e2e    # Playwright ile uçtan uca (sahte claude.ai)
```

Geliştirici notları için `CLAUDE.md` dosyasına bak.

## Nasıl çalışır?

```
maliyet = w_model × [ yeni girdi + önbellekte olmayan geçmiş + araç girdisi + 5 × (cevap + düşünme) ]
limit %  = k_plan × maliyet  (× 1,5 yoğun saatte, yalnızca Free/Team)
```

- **Token sayımı:** TR / EN / kod için ayrı katsayılar (o200k tokenizer'ına göre en küçük kareler) × 1,4 (güncel Claude tokenizer farkı).
- **Cevap uzunluğu:** Log-normal model. Soru tipi sınıflandırıcısı (12 tip, TR+EN kural tabanlı) ve CASTILLO veri setinden öğrenilen katsayılar. Ayrılmış test verisinde %80 aralık, cevapların %77'sini kapsadı.
- **Belirsizlik:** Tüm parçalar Monte Carlo ile birleştirilir (800 örnek, tekrarlanabilir).
- **Kalibrasyon:** k için Gamma-Poisson, cevap uzunluğu için hiyerarşik normal güncelleme; aykırı değer filtresi, 45 günlük yarı ömür.

## Gizlilik

Her şey tarayıcıda hesaplanır. Mesaj metinleri, ekler ve sohbetler cihazdan çıkmaz; eklenti hiçbir sunucuya veri göndermez. Yalnızca claude.ai'de, kullanıcının kendi oturumuyla çalışır.

## Bilinen sınırlamalar

- claude.ai'nin **belgelenmemiş** iç API'lerine ve sayfa yapısına dayanır; Anthropic bunları değiştirirse ilgili modül (`lib/usage.js`, `lib/page.js`, `lib/conversation.js`, `inject/hook.js`) güncellenmelidir.
- Düşünme (thinking) tokenları claude.ai'de hiçbir yerde görünmez; yalnızca kullanım yüzdesindeki değişimden dolaylı olarak öğrenilir.
- Aynı limiti paylaşan başka bir cihaz ya da Claude Code aynı anda kullanılırsa ölçüm bozulabilir (aykırı değer filtresi çoğunu eler).
- Plan limit büyüklükleri başlangıçta kaba tahmindir; ilk birkaç mesajda aralık geniştir.
- Sınıflandırıcı: kendi test setinde %100, bağımsız Türkçe sette ilk denemede %68 (düzeltme sonrası %95), CASTILLO'da %85 uygunluk. Gerçek doğruluk muhtemelen ~%80.
- Model önerisi kural tabanlıdır, cevap kalitesi ölçülerek doğrulanmamıştır. 50 promptluk test setinde %98 doğru, gerekenden hafif öneri yok. Tip belirsizse Haiku önerilmez.

## Kaynaklar ve atıflar

- **lugia19/Claude-Usage-Extension** (GPL-3.0): claude.ai iç API alanları, cevap akışı (`message_limit`) yapısı, plan tespiti, sistem talimatı boyutu, önbellek süresi, yoğun saat çarpanı ve model ağırlığı yaklaşımı bu projenin **ölçüm ve notlarından** alınmıştır. Koddan kopya yapılmamıştır. https://github.com/lugia19/Claude-Usage-Extension
- **CASTILLO** (veri CC BY 4.0, kod Apache 2.0): Perez-Ramirez, Kostic, Boman. "CASTILLO: Characterizing Response Length Distributions of Large Language Models." https://arxiv.org/abs/2505.16881 · https://github.com/DanielFPerez/castillo
- **Anthropic belgeleri:** görsel tokenları, PDF desteği, fiyatlar, bağlam pencereleri, dosya yükleme kuralları (platform.claude.com, support.claude.com).
- **gpt-tokenizer** (MIT) ve **@anthropic-ai/tokenizer**: yalnızca katsayıları bulmak için geliştirme sırasında kullanıldı; eklentiye dahil değildir.

Bu eklenti bağımsız bir projedir; Anthropic ile bağlantılı değildir.
