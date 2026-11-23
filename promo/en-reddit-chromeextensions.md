> **Kural 1:** Kendi eklentini paylaşmak serbest görünüyor: gönderilerde "Self Promotion" flair'i kullanılıyor (alt dizin yansımalarında görülen flair listesi); "Sharing Journey/Experience" ve "Idea Validation / Need feedback" flair'leri de var. Yalnızca link olan reklam, sahte yorum ve spam kaldırılıyor ([Thread Otter genel notu](https://www.threadotter.com/subreddit-rules/chrome_extensions)).
> **Kural 2:** Resmi kural metnini okuyamadım (reddit.com bot erişimine kapalı). Göndermeden önce Rules'a ve flair listesine bak; gövdede gerçek içerik olsun, yalnızca link bırakma.

---

**Flair:** Self Promotion
**Tür:** Metin gönderisi + 1 görsel (`store/en/screenshot-1-forecast.png`)

## Title

My first published MV3 extension: a usage forecast for claude.ai that runs entirely on-device

## Body

I'm a student and this is the first extension I've published on the Chrome Web Store. It estimates how much of your Claude usage limit a message will use **before** you send it, and suggests which model and effort level are enough.

Some things I learned building it that might be useful to others here:

- **The site sends messages from a Web Worker**, so wrapping `fetch` in the page (MAIN world) doesn't see the send at all. The reliable signal turned out to be the page structure: "the last user message changed" = sent, "the answer stopped growing" = done. Usage is then read at send time and a few seconds after the answer.
- **Consent before reading anything.** The 2026 Web Store rules ask you to show, inside the extension, what you read and get explicit consent, even when everything is processed locally. On install a welcome page explains it; until you agree, the content script only shows an "open" button and the service worker reads nothing.
- **Small permissions:** `storage`, `alarms`, `notifications`, and host access to `claude.ai` only. No remote code, no analytics, no server.
- **Network test in CI:** the Playwright end-to-end test runs against a mock claude.ai and fails if the extension makes any request other than GETs to claude.ai. (If you test MV3 service workers with Playwright: I needed `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`, otherwise the worker's requests skip the mock server.)
- **Everything learned stays in `chrome.storage.local`**, versioned, with a migration step if the schema changes. Export/import exists so people don't lose their calibration when reinstalling.

What it shows: a small draggable pill with the forecast (% of the 5-hour and weekly limit, with an 80% range), a reasoned model/effort suggestion, cache and peak-hour countdowns, and a local weekly report. The forecasts are estimates; Anthropic doesn't publish limit sizes, so the extension learns them from your own usage.

Free, open source (AGPL-3.0), interface in 10 languages.

- Web Store: https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige
- Source: https://github.com/H-ENES1/ai-assistant-claude

Feedback on the UX or the code is very welcome, especially from people who've dealt with fragile selectors on sites that change often.

---

**Not:** Teknik maddeler depodan doğrulandı (CLAUDE.md, README, `extension/manifest.json` izinleri, `tests/e2e.cjs`). "first extension I've published" bilgisini sen doğrula; değilse sil.
