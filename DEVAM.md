# DEVAM — kalite ölçümü (dal: kalite-olcumu)

İş yarıda: kullanım limiti iki kez doldu. Bu dosya iş bitince silinir.
Çalışma klasörü: `C:\Users\henes\ai-assistant-claude-kalite` (git worktree; ana klasörde başka bir oturum `fable-5-2` dalında).

## Bitti
- İstem seti + eklentinin önerisi: `tests/quality/prompts.json` (80 istem, 22'si bağlamsız).
- 240 cevap (80 istem × haiku/sonnet/opus): `tests/quality/answers/*.json`.
- Körleme: `tests/quality/blind/grup-01..16.md`.
- Kör hakemlik: **grup 01–15 puanlandı** (`tests/quality/scores/grup-NN.json`). Eşleme henüz AÇILMADI.
- `run.md` (yeniden çalıştırma kılavuzu), `olaylar.txt` (körlüğü zedeleyen olaylar).

## Kaldı (sırayla)
1. `blind/grup-16.md`'yi oku, `scores/grup-16.json` yaz (aynı biçim; İngilizce isteme Türkçe cevap −1 ve `"langSlip": ["X"]`).
2. Puanları commit et. SONRA `blind/key.json`'ı commit et (dosya yalnızca bu klasörde, depoda yok: SİLME, puanlama bitmeden AÇMA).
3. `analyze.mjs`'e `langSlip` duyarlılık hesabını ekle (cezayı geri alınca sonuç değişiyor mu), sonra `node tests/quality/analyze.mjs` → `sonuc.json`, `tablolar.md`.
4. `tests/quality/RAPOR.md`: sayılar, 10 örnek, sınırlar. Rapora girecek bilinen sınırlar:
   - r19: istem 1500 kelime istiyor, düzen 400 kelimeyle sınırlıyor → ölçülemedi.
   - r38: alt ajanlar deponun CLAUDE.md'sini görüyor, istem tam bu eklentiyi tarif ediyor (bulaşma).
   - r10, r12: bazı cevaplar düzenin iç talimatını kullanıcı metni sandı.
   - Dil kayması: CLAUDE.md "Türkçe konuş" dediği için bazı cevaplar İngilizce isteme Türkçe.
   - Effort önerisi ölçülmedi (alt ajan effort'u ayarlanmadı); Fable cevaplatılmadı.
5. Kanıt varsa ayrı commit'te en fazla 3 eşik önerisi (otomatik değiştirme yok; `npm run test` ≥ %96 ve hafif = 0 geçmeli).
6. `npm run test` + `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 npm run e2e` (e2e için `npx playwright install chromium` gerekebilir), CLAUDE.md'deki "ölçülmedi" satırını güncelle, DEVAM.md'yi sil, push, PR.

## Ortam
Node bu makinede kurulu değil; oturumda geçici klasöre taşınabilir Node 22 indirildi (kalıcı değil).
Kalıcı kurulum: `winget install OpenJS.NodeJS.LTS`. `node_modules` bu worktree'de kurulu.
