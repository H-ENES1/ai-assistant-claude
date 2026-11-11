# DEVAM — kalite ölçümü (dal: kalite-olcumu)

Bu dosya iş yarıda kalırsa bir sonraki oturum içindir; iş bitince silinir.

## Ne bitti
- `tests/quality/build-prompts.mjs` → `prompts.json`: 80 istem + her biri için eklentinin önerisi (model + effort). 22 istem "bağlamsız" diye önceden işaretli.
- `tests/quality/blind.mjs` (cevapları topla + körle), `analyze.mjs` (puanları eşlemeyle birleştir, tabloları üret). İkisi de yazıldı; analyze henüz gerçek veriyle çalıştırılmadı.
- Cevaplar: r01–r50 × haiku/sonnet/opus = 150 cevap + c01.haiku (`answers/*.json`). Alt ajan başına ≈ 42 bin token ölçüldü; 150 ajan bir oturum limitini doldurdu.
- `olaylar.txt`: körlüğü zedeleyen dönüş mesajları ve limit kesintisi.

## Ne kaldı
1. Cevaplar: c01 (sonnet, opus), c02–c10, t01–t15, k01–k05 → 89 ajan. Şablon ve sıra: `tests/quality/run.md` (henüz yazılmadı; şablon aşağıda).
2. `node tests/quality/blind.mjs` → `blind/grup-01..16.md`. `blind/key.json` puanlama bitene kadar AÇILMAZ.
3. Hakemlik: her grup için `scores/grup-NN.json` (`{"items":[{"id","A","B","C","note"}]}`), 1–5, yarım puan olur. Puanları commit et, SONRA anahtarı aç.
4. `node tests/quality/analyze.mjs` → `sonuc.json`, `tablolar.md`.
5. `RAPOR.md`, `run.md`; kanıt varsa ayrı commit'te en fazla 3 eşik önerisi (eşikleri otomatik değiştirme).
6. `npm run test` + e2e, push, PR.

## Alt ajan şablonu (model: haiku | sonnet | opus, tür: general-purpose, istem başına bir ajan)
```
Aşağıdaki İSTEM'i bir sohbet asistanı olarak cevapla. Araç kullanma (dosya okuma, arama, komut yok); tek istisna cevabı kaydetmek için Write. İstemin dilinde, en fazla 400 kelimeyle cevap ver. Cevabın tamamını, başına sonuna hiçbir şey eklemeden şu dosyaya yaz: <depo>\tests\quality\answers\raw\<id>.<model>.md
Sonra bana yalnızca "tamam" yaz; cevabı tekrarlama.

İSTEM:
<istem>
```
Aynı anda en fazla 20 alt ajan çalışır. Ajan cevabı dönüş mesajında tekrar ederse dosyayı sil, yeniden başlat, `olaylar.txt`'ye yaz.

## Ortam notu
Bu makinede Node kurulu değildi; oturumda geçici klasöre taşınabilir Node 22 indirildi (kalıcı değil). Kalıcı kurulum: `winget install OpenJS.NodeJS.LTS`.

## Klasör notu
Ana klasörde (`C:\Users\henes\ai-assistant-claude`) başka bir oturum `fable-5-2` dalında çalışıyor. Bu iş ayrı bir
git worktree'de: `C:\Users\henes\ai-assistant-claude-kalite` (dal `kalite-olcumu`). Komutları buradan çalıştır;
ana klasörde dal değiştirme.
