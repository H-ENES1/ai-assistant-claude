> **Kural 1:** Kişisel hesapla (şirket hesabı olmaz) maker olarak kendin gönderebilirsin; yeni hesabın gönderi izni alması gerekebilir. Ad ≤ 40, slogan ≤ 60 (abartı yok, "the best" gibi iddia yok), açıklama ≤ 500, ilk yorum ≤ 5000 karakter ([PH: Build your product page](https://help.producthunt.com/en/articles/17834537-4-build-your-product-page)).
> **Kural 2:** "Ask for feedback, never for upvotes": oy isteme, arkadaşlarına oy verdirme. Lansman Pasifik saatiyle gece yarısı başlar, bir gün sürer; en fazla 30 gün önceden planlanır ve incelemeden geçer. Galeri: en az 1 görsel, önerilen 1270×760, 3+ önerilir; video isteğe bağlı.

---

## Name (≤ 40)

Token Forecast for Claude

## Tagline (≤ 60)

See how much of your Claude limit a message uses, pre-send

<sub>Yedek: "Forecast your Claude usage before you hit send" · "Pre-send usage forecast for claude.ai, on-device"</sub>

## Description (≤ 500)

A free, open-source browser extension for claude.ai. Before you send a message, it estimates how much of your 5-hour and weekly limit it will use (with a range), suggests which model and effort level are enough and explains why, and learns your plan from your own usage. Everything runs in your browser: no server, no analytics, your messages never leave your device. A student project, not affiliated with Anthropic.

## Topics

Chrome Extensions · Productivity · Artificial Intelligence · Open Source

## Links

- Website: https://h-enes1.github.io/ai-assistant-claude/
- Chrome Web Store: https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige
- GitHub: https://github.com/H-ENES1/ai-assistant-claude
- Pricing: Free

## Gallery order

| # | Dosya | Neden bu sırada |
|---|---|---|
| Video | YouTube EN: https://www.youtube.com/watch?v=TKogrZgveAM | PH videoyu galerinin başında gösterir; 4 dakikalık tam anlatım |
| 1 | `store/en/screenshot-1-forecast.png` | Ana fikir tek karede: tahmin + gerekçeli öneri |
| 2 | `store/en/screenshot-3-task.png` | Farkı gösterir: "çeviri sistemi olan site" çeviri değil, Haiku önerilmez |
| 3 | `store/en/screenshot-2-effort.png` | Effort önerisi ve tasarruf |
| 4 | `store/en/screenshot-4-popup.png` | Limitler ve kalan limitin ne yapmaya yettiği |
| 5 | `store/en/screenshot-5-report.png` | Haftalık rapor |

Görseller 1280×800 (oran 1,60); PH 1270×760 (1,67) öneriyor. Yüklerken kenarlardan kırpılıp kırpılmadığına önizlemede bak. **Logo:** 240×240 gerekiyor; `extension/icons/icon128.png` büyütülürse bulanıklaşır, büyük sürümü kaynaktan üret.

## First comment (maker comment, ≤ 5000)

Hi Product Hunt 👋

I'm a physics student, and I built Token Forecast because my Claude limit kept running out halfway through a task, usually on a message I didn't expect to be expensive. claude.ai shows usage only after you've spent it (Settings → Usage). I wanted to see the cost *before* pressing send.

**What it does**
- Shows, next to the message box, roughly what % of your 5-hour and weekly limit the message will use, with an 80% range. It accounts for the prompt, attachments, chat history, model, effort and cache.
- Suggests which model and effort level are enough, with the reasons. When it isn't sure, it never suggests a lighter model.
- Warns you when switching models mid-chat would make the new model re-read the whole history.
- Learns your plan from your own usage, and shows a weekly report.

**Privacy**
No server, no analytics, no tracking. Your messages and attachments never leave your browser. It only talks to claude.ai with your own session, never sends messages or changes settings, and asks for consent before reading anything.

**What I'm honest about**
- Anthropic doesn't publish limit sizes, so these are estimates that improve as it measures your usage. In a simulation with 300 virtual plans, the error went from 1.68× at the first message to 1.13× after 20. Real accounts may differ.
- I ran a first blind check of the model suggestions (58 prompts, scored by a model judge, no human judge yet). When it suggested Haiku, Haiku's answer was good every time (13/13). It was too light 5 times out of 58, and too cautious more often than that.
- It depends on claude.ai's undocumented internals, so a site change can break it until an update.

It's free and open source (AGPL-3.0). Interface in 10 languages; message analysis currently in English and Turkish.

**My question for you:** which number would you actually look at before sending: the % of the 5-hour limit, the weekly %, or "how many more messages like this"? I'm deciding what the pill should show first.

---

**Not:** Kalite sayıları `tests/quality/RAPOR.md` (0.13.0 ile main'e gelir). Lansmanı 0.13.0 mağazada yayınlandıktan sonra planla. "Hi Product Hunt" paragrafını kendi cümlelerinle yaz.
