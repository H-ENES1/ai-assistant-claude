# Paylaşım takvimi ve yorum cevapları

## Ön koşul

Taslaklar **0.13.0 Chrome Web Store'da yayında olduktan sonra** paylaşılmalı:
- Kalite ölçümü sayıları `tests/quality/RAPOR.md`'den; bu dosya 0.13.0 birleşmesiyle main'e geliyor. Önce paylaşırsan GitHub'da bağlantı boşa çıkar.
- İnsanlar ilk gün kurup dener; mağazadaki sürüm, yazılanla aynı olmalı (Fable 5.2 desteği vb.).

Mağaza incelemesi birkaç gün sürebilir. Aşağıdaki tarihler **örnektir**: 0.13.0 yayına girdikten sonraki ilk pazartesiye kaydır, gün sırasını koru.

## Saat farkı

Türkiye yıl boyu UTC+3. ABD 1 Kasım 2026'da kış saatine geçti (8 Mart 2027'ye kadar): **TSİ = ET + 8 = PT + 11**. Örnek: 08:00 ET = 16:00 TSİ; 00:01 PT = 11:01 TSİ.

## Sıra ve neden

Her gün tek platform. Sebep: ilk 2–3 saatte yorumlara cevap vermen gerekiyor ve bir platformda çıkan hatayı bir sonrakinden önce düzeltebilmelisin.

| # | Örnek tarih | Saat (TSİ) | Platform | Dosya | Neden bu sırada / bu saatte |
|---|---|---|---|---|---|
| 0 | 23–27 Kas | — | Hazırlık | — | PH sayfasını taslak olarak kur, logoyu 240×240 üret; Reddit ve HN hesaplarında son haftalarda normal etkinlik olsun. **26 Kas ABD Şükran Günü haftası; ABD platformlarına paylaşma.** |
| 1 | Pzt 30 Kas | 16:00 | dev.to | `en-devto.md` | Önce teknik makale: sonraki gönderilerde "nasıl çalışıyor" sorusuna bağlantı olur. 08:00 ET, ABD iş günü başı. |
| 2 | Sal 1 Ara | 16:00–17:00 | r/ClaudeAI | `en-reddit-claudeai.md` | En ilgili ve en büyük kitle. ABD sabahı (08:00–09:00 ET); Avrupa öğleden sonrası. |
| 3 | Çar 2 Ara | 08:30–09:30 | LinkedIn (TR) | `tr-linkedin.md` | Türk ağın iş günü başında akışa bakıyor. Video gönderisi, bağlantılar ilk yorumda. |
| 4 | Per 3 Ara | 17:00–18:00 | Hacker News (Show HN) | `en-hackernews-showhn.md` | 09:00–10:00 ET / 06:00–07:00 PT. Reddit'te gelen eleştirilerle metni kendin olgunlaştırmış olursun. **Metni sen yaz** (HN kuralı). |
| 5 | Cmt 5 Ara | 17:00 | r/chrome_extensions | `en-reddit-chromeextensions.md` | Küçük, geliştirici odaklı alt dizin; hafta sonu daha az gönderiyle yarışır. |
| 6 | Paz 6 Ara | 20:30 | Technopat | `tr-technopat.md` | Türk forum kitlesi akşam saatlerinde aktif. Önce bölümü/moderatörü kontrol et. |
| 7 | Cmt 12 Ara | 11:01 | Product Hunt | `en-producthunt.md` | En sona: önceki geri bildirimlerle düzeltilmiş sürüm ve yorumlar hazır olur. 00:01 PT'de başlar, gün boyu sürer. Hafta sonu daha az lansman olur (yaygın tavsiye, ölçmedim); ağı olmayan küçük bir proje için rekabet daha az. İlk yorumu yayına girer girmez yaz. |

**Saatler hakkında:** Bu saatler yaygın tavsiyelere ve hedef kitlenin saat dilimine dayanıyor; kendi ölçümüm değil. Hiçbir platform "en iyi saati" resmî olarak yayımlamıyor.

**Kaçın:** 21 Aralık–3 Ocak (tatil dönemi, ABD/Avrupa trafiği düşük), ABD resmî tatilleri, Anthropic'in büyük duyuru yaptığı günler (gündem dolar).

**Her paylaşımdan sonra:** Gelen hata/öneri bildirimlerini GitHub'a konu olarak gir. Yorumlarda söz verdiğin şeyi (ör. "Firefox'a bakacağım") bir yere not et.

---

## Yorumlara verilecek 10 olası soru

Kısa cevaplar. Yorumlarda kendi cümlelerinle kullan (HN'de yapay zekâ metni yasak; Reddit'te de kopyala-yapıştır cevap kötü karşılanır).

### English

**1. Where does my data go?**
Nowhere. There's no server and no analytics. Your messages, attachments and chats are processed in your browser and never leave it. The extension only talks to claude.ai with your own session, to read the same usage numbers the Settings page shows. The end-to-end test fails if it makes any other request. Privacy policy: https://h-enes1.github.io/ai-assistant-claude/privacy.html

**2. Firefox? Safari? Mobile?**
Not yet. It's a Manifest V3 extension for Chromium browsers: Chrome, Edge, Brave, and Opera with its Chrome-extensions add-on. Firefox is on the to-do list but not started. Safari and mobile browsers aren't planned (mobile Chrome doesn't run extensions).

**3. Why are these numbers estimates?**
Anthropic doesn't publish how big the limits are or how each model counts against them. Answer length and hidden thinking are random too. So the extension gives a range, starts from rough priors, and learns your plan from how your usage percentage actually moves after each message.

**4. How accurate is it?**
In simulations (not real accounts) the plan-size error drops from 1.68× at the first message to 1.13× after 20. For a single message it can't get much below ~1.7× because the answer length is random; the goal is the total and the range. On real claude.ai I've only verified the basics so far. The weekly report shows whether it's learning on your account.

**5. Is this official? What if claude.ai changes?**
No, it's an independent student project, not affiliated with Anthropic. It relies on undocumented parts of the site, so a change can break it until I ship an update. There's a health check in the extension that shows which step stopped working.

**6. Can this get my account in trouble?**
I can't promise anything on Anthropic's behalf. What it does: it reads your usage every 5 minutes and around your messages, the same data the Settings → Usage page loads, with your own session. It never sends messages, changes settings or automates anything.

**7. Why should I trust the model suggestion?**
You don't have to; it shows its reasons and you can turn it off. I ran one blind check (58 prompts, model judge, no human judge): when it said Haiku, Haiku's answer was good 13 out of 13 times; it was too light 5 times out of 58, and too cautious more often. If it isn't sure, it never suggests a lighter model.

**8. Which plans and languages? Claude Code? Desktop app?**
It learns whichever plan you're on (Free, Pro, Team, Max), since the limit size is learned, not hard-coded. Interface in 10 languages; task and model analysis only for English and Turkish messages. It works on claude.ai in the browser only: not in Claude Code, the API or the desktop app.

**9. Did you write it with AI?**
Yes, much of the code was written with Claude Code. I did the design, the measurements and the decisions, and every number in the README comes from a test or script in the repo that you can rerun.

**10. Is it really free? Why AGPL?**
Free, no account, no paid tier, no ads. AGPL-3.0 so that anyone who ships a modified version has to share their source too. The name and logo aren't covered by the license, so forks need a different name.

### Türkçe

**1. Verilerim nereye gidiyor?**
Hiçbir yere. Sunucu yok, analitik yok. Mesajların, eklerin ve sohbetlerin tarayıcında işleniyor, dışarı çıkmıyor. Eklenti yalnızca claude.ai'ye senin oturumunla istek atıyor; Ayarlar sayfasının gösterdiği kullanım bilgisini okuyor. Başka bir istek atarsa uçtan uca test kırmızı oluyor. Gizlilik politikası: https://h-enes1.github.io/ai-assistant-claude/privacy.html

**2. Firefox? Safari? Telefon?**
Henüz yok. Chromium tabanlı tarayıcılar için (Chrome, Edge, Brave; Opera'da "Install Chrome Extensions" ile). Firefox yapılacaklar listesinde ama başlamadım. Safari ve telefon tarayıcıları planda yok (telefondaki Chrome eklenti çalıştırmıyor).

**3. Bu sayılar neden tahmin?**
Anthropic limitlerin büyüklüğünü ve her modelin limitten nasıl düştüğünü yayımlamıyor. Cevabın uzunluğu ve gizli düşünme de rastgele. Bu yüzden eklenti bir aralık veriyor, kaba bir başlangıç değerinden başlıyor ve her mesajdan sonra kullanım yüzdenin gerçekte ne kadar değiştiğine bakarak planını öğreniyor.

**4. Ne kadar doğru?**
Simülasyonda (gerçek hesap değil) plan tahmininin hatası ilk mesajda 1,68 kat, 20 mesajdan sonra 1,13 kat. Tek mesajda ~1,7 katın altına inemez, çünkü cevap uzunluğu rastgele; hedef toplam ve aralık. Gerçek claude.ai'de şimdilik temel akışı doğruladım. Haftalık rapor senin hesabında öğrenip öğrenmediğini gösteriyor.

**5. Resmî mi? claude.ai değişirse?**
Hayır, bağımsız bir öğrenci projesi; Anthropic ile bağlantısı yok. Sitenin belgelenmemiş iç yapısına dayanıyor; site değişirse güncelleme çıkana kadar bozulabilir. Eklentideki sağlık ekranı hangi adımın durduğunu gösteriyor.

**6. Hesabımın başı derde girer mi?**
Anthropic adına söz veremem. Yaptığı şu: kullanımını 5 dakikada bir ve mesajlarının çevresinde, Ayarlar → Kullanım sayfasının yüklediği aynı veriyi senin oturumunla okuyor. Mesaj göndermiyor, ayar değiştirmiyor, hiçbir şeyi otomatikleştirmiyor.

**7. Model önerisine neden güveneyim?**
Güvenmek zorunda değilsin; gerekçesini gösteriyor ve kapatılabiliyor. Bir kez kör test ettim (58 istem, model hakem, insan hakem yok): Haiku dediğinde 13'ün 13'ünde Haiku'nun cevabı iyiydi; 58'in 5'inde gerekenden hafif önerdi, daha sık da gereğinden temkinli davrandı. Emin değilse daha hafif model önermiyor.

**8. Hangi planlar, hangi diller? Claude Code? Masaüstü uygulaması?**
Planı (Free, Pro, Team, Max) sabit kodlamıyor, ölçerek öğreniyor. Arayüz 10 dilde; iş türü ve model analizi yalnızca Türkçe ve İngilizce mesajlarda. Yalnızca tarayıcıdaki claude.ai'de çalışıyor; Claude Code, API ve masaüstü uygulamasında değil.

**9. Yapay zekâ ile mi yazdın?**
Evet, kodun büyük kısmını Claude Code ile yazdım. Tasarım, ölçümler ve kararlar benim; README'deki her sayı depodaki bir test ya da betikten geliyor, tekrar çalıştırılabilir.

**10. Gerçekten ücretsiz mi? Neden AGPL?**
Ücretsiz; hesap yok, ücretli sürüm yok, reklam yok. AGPL-3.0 seçtim ki değiştirip dağıtan da kaynağını açmak zorunda olsun. Ad ve logo lisansın dışında; çatallar başka ad kullanmalı.
