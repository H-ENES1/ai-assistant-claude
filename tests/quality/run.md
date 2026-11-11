# Kalite ölçümünü yeniden çalıştırma

Eklentinin model önerisi (`advise()`) gerçekten "yeterli en hafif model"i mi gösteriyor? Bu klasör bunu ölçer.
Sonuçlar: `RAPOR.md`. Bu dosya aynı ölçümü baştan çalıştırmak içindir. Ölçüm Claude Code oturumunda yapılır
(alt ajanlar cevaplar, oturumdaki model hakemlik eder); ücretli API gerekmez ama **abonelik limitini harcar**.

## Maliyet (11.11.2026 turunda ölçüldü)
- 240 alt ajan (80 istem × 3 model). Alt ajan başına ≈ 42–46 bin token (çoğu sistem istemi; cevap kısa).
- İlk 150 alt ajan + ana oturum, aynı anda çalışan ikinci bir oturumla birlikte 5 saatlik limiti doldurdu.
  Tek oturumda çalıştır; gerekiyorsa iki limit penceresine böl (`DEVAM.md` bırak).

## Sıra

### 0. Yeni tur için temizlik
Eski turu saklamak istersen `answers/`, `blind/`, `scores/`, `sonuc.json`, `tablolar.md`, `olaylar.txt`
dosyalarını `arsiv/<tarih>/` altına taşı. `blind.mjs` var olan `blind/key.json` üstüne yazmaz.

### 1. İstem seti ve eklentinin önerisi
```
node tests/quality/build-prompts.mjs      # → prompts.json (80 istem, öneri: model + effort)
```
İstemler test dosyalarından okunur (`tests/rec-cases.json`, `tests/advisor.test.mjs` içindeki `chatty`,
`tests/traps.test.mjs` içindeki `TRAPS` ve `CONTROLS`). Yeni istem eklersen oraya ekle. Kendi başına
cevaplanamayan istemler `build-prompts.mjs` içindeki `NO_CONTEXT` listesindedir; **cevapları görmeden** güncelle.

### 2. Cevaplar (Claude Code'a verilecek istem)
> `tests/quality/prompts.json`'daki her istem için üç alt ajan başlat (Agent aracı, `subagent_type: general-purpose`,
> `model`: haiku, sonnet, opus). Her alt ajana yalnızca aşağıdaki şablonu ver. Aynı anda en fazla 18 ajan çalıştır.
> Ajanların dönüş mesajında cevap ya da özeti varsa o dosyayı sil, ajanı yeniden başlat ve `olaylar.txt`'ye yaz.
> Cevap dosyalarını OKUMA. Önce üç deneme ajanıyla model seçiminin çalıştığını doğrula (sistem istemindeki
> model kimliğini sor); çalışmıyorsa dur.

Alt ajan şablonu (`<id>`, `<model>`, `<istem>` doldurulur; başka hiçbir şey eklenmez):
```
Aşağıdaki İSTEM'i bir sohbet asistanı olarak cevapla. Araç kullanma (dosya okuma, arama, komut yok); tek istisna cevabı kaydetmek için Write. İstemin dilinde, en fazla 400 kelimeyle cevap ver. Cevabın tamamını, başına sonuna hiçbir şey eklemeden şu dosyaya yaz: <depo>\tests\quality\answers\raw\<id>.<model>.md
Sonra bana yalnızca "tamam" yaz; cevabı tekrarlama.

İSTEM:
<istem>
```
Neden dosyaya yazdırıyoruz: cevap ana oturuma dönerse hakem hangi cevabın hangi modelden geldiğini görür.

### 3. Körleme
```
node tests/quality/blind.mjs      # ham cevapları answers/<model>.json'a toplar, blind/grup-01..16.md yazar
```
Her istemde üç cevap rastgele A/B/C olur; istem sırası da karışır. Eşleme `blind/key.json`'da. **Açma.**

### 4. Hakemlik (Claude Code'a verilecek istem)
> Kör hakemsin. `tests/quality/blind/grup-NN.md` dosyalarını sırayla oku. Her istem için A, B, C cevaplarına
> 1–5 puan ver (yarım puan olur). Ölçüt: doğruluk, eksiksizlik, istemin istediğini yapma. Uzunluk kendi başına
> artı değil; istenmeyen dolgu eksi. Bağlamı eksik istemde doğru davranış eksik bilgiyi istemektir; uydurmak eksi.
> Her grup için `tests/quality/scores/grup-NN.json` yaz: `{"group": N, "items": [{"id", "A", "B", "C", "note"}]}`,
> `note` tek cümle. `blind/key.json`, `answers/` ve `prompts.json`'daki öneriyi puanlama bitene kadar açma.
> Bitince puanları commit et.

### 5. Analiz
```
git add tests/quality/scores && git commit -m "Kalite ölçümü: kör puanlar"   # önce puanlar sabitlenir
node tests/quality/analyze.mjs    # → sonuc.json, tablolar.md
```
Kural: kabul edilebilir = puan ≥ 4 ve en iyi cevaptan en fazla 0,5 düşük. Yeterli en hafif model = kabul
edilebilir ilk model (haiku → sonnet → opus). (a) hafif öneri: öneri bundan hafif. (b) ağır öneri: öneri bundan ağır.

### 6. Rapor ve eşikler
`RAPOR.md`'yi `tablolar.md`'deki sayılarla güncelle. Eşikleri (`extension/lib/advisor.js`) bu ölçüme bakarak
OTOMATİK değiştirme: öneriyi ayrı commit'te yap, `npm run test` (uygunluk ≥ %96, gerekenden hafif = 0) geçmeli,
değişen her davranış için `tests/rec-cases.json`'a örnek ekle.

## Bilinen tuzaklar
- Alt ajanlar Claude Code sistem istemiyle çalışır ve deponun `CLAUDE.md` dosyasını görür: claude.ai'deki
  cevapla birebir aynı değildir. Depo sahibiyle ilgili istemler (ör. "… kimdir") bulaşmalıdır.
- Aynı klasörde ikinci bir oturum dal değiştirirse commit'ler yanlış dala gider. Bu ölçümü ayrı bir
  `git worktree` içinde çalıştır.
- Oturum limiti dolarsa yarım kalan ajan dosyayı yazmış olabilir; `blind.mjs` eksikleri listeler.
