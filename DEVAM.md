# DEVAM — fable-5-2 dalı (11.11.2026, kullanım sınırı nedeniyle yarıda kaldı)

## Bitti
- `forecast.js` MODELS'e `fable 5.2` (ağırlık 10, eff def medium, 1M), FAMILY_DEFAULT, RECOMMEND_LABEL;
  `advisor.js` FAMILY_MODEL; `context.js` 1M listesi. Regex'ler (forecast.js:~155, page.js:80) zaten tanıyor. `npm run test` yeşil.

## Kaynaklardan önemli bulgu
- anthropic.com/claude-fable-and-mythos-5-2: "Fable is included for **up to** 50% of weekly usage limits for Pro plans
  and standard seats on the Team plan" — **lansman promosyonu**. support.claude.com/en/articles/17506494: 9–16 Kasım 2026.
  → Metinlerde "%50" / "Pro" sabitleme; yalnızca claude.ai'nin döndürdüğü pencereyi göster.
- API varsayılan effort high, claude.ai varsayılanı medium (eklenti claude.ai'yi izler → medium).

## CJK kararı (commit mesajına yazılacak)
- `tokens.js:24-29` yorumu: "Diğer diller (0.11.3). o200k tokenizer'ı ile ölçüldü ... CJK ≈ 0,73 token/karakter".
  Sabit b789b13'te (v0.12.0, 22.10.2026) eklendi. → o200k ölçümü; CLAUDE_FACTOR CJK'ya uygulanmaya DEVAM (kod değişmez).
  Yorumu netleştiren küçük commit atılacak.

## Kalan
1. `lib/usage.js`: `familyWindow(usage, family)` — extras içinde anahtarı `seven_day_` ile başlayıp aile adını içeren
   (seven_day_fable, seven_day_fable_5_2, seven_day_fable_models …) pencere; tek seviye iç içe nesneleri düzleştir.
   seven_day_opus'u Fable'a EŞLEME (Opus'un kendi penceresi olabilir). `FAMILY_SHARE_WARN_PCT = 80`.
2. `content/content.js` viewModel: model ailesi fable + pencere varsa satır `t("rowFableShare")` = %X;
   ≥80 ise uyarı (sev warn, advisor ayarından bağımsız, limit uyarısı sayılır) `t("fableShareNear", [RECOMMEND_LABEL.opus])`.
3. `popup/popup.js`: lastContext.model Fable ise o pencereyi "Fable payı" etiketiyle ana bölümde göster, extras'tan çıkar, ≥80 notu.
4. 10 dilde anahtarlar: rowFableShare, fableShareNear (+popup etiketi). tests/lang.test.mjs anahtar eşitliğini denetler.
5. Testler: unit'e resolveModel("Fable 5.2") (approx değil, eff medium), familyWindow, eşik; e2e sahte /usage'a `seven_day_fable`.
6. manifest + README başlığı 0.12.2, CLAUDE.md 0.12.2 notu; push, PR.

## Ortam
- Node PATH'te yok: taşınabilir Node scratchpad'e indirildi (oturuma özel). Yeni oturumda Node kur ya da tekrar indir.
- e2e için `npx playwright install chromium` gerekti.
