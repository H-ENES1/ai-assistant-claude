> **Kural 1:** Tanıtım yalnızca moderatör izniyle ya da belirlenmiş başlıklarda serbest ([Thread Otter özeti, Ağustos 2026](https://www.threadotter.com/subreddit-rules/claudeai)); Claude ile yapılmış işler "Built with Claude" flair'iyle ya da karma düşükse (~50 altı) "Built with Claude" megathread'inde paylaşılıyor ([ikincil not](https://github.com/Zontak-LLC/usehourly/issues/8)).
> **Kural 2:** Link gövdede serbest; ne yaptığın, nasıl yaptığın, ekran görüntüsü/demo beklenir. Resmi sayfayı okuyamadım (reddit.com bot erişimine kapalı): göndermeden önce Rules + flair listesine bak, gerekirse modlara yaz.

---

**Flair:** Built with Claude (yoksa: Productivity / Showcase benzeri olanı)
**Tür:** Görsel + metin gönderisi (ilk görsel: `store/en/screenshot-1-forecast.png`), ya da 30 saniyelik demo (`promo/video/demo-en-1080x1080.mp4`; yalnız görsel kabul eden yerde `promo/video/demo-en-800.gif`)

## Title

I built a free extension that shows how much of your Claude limit a message will use, before you send it

<sub>Alternatif: "Built with Claude: a pre-send usage forecast for claude.ai (free, open source, runs locally)"</sub>

## Body

I kept running out of my 5-hour limit in the middle of something, usually on a message I didn't expect to be expensive. Settings → Usage only tells you what you've already spent, so I built a small Chrome extension that tells you *before* you press send.

**What it does**

- A small pill next to the message box shows roughly what % of your 5-hour and weekly limit the message will use, with an 80% range. It counts the prompt, attachments, chat history, model, effort and whether the history is still cached.
- It suggests which model and effort level are enough, and shows why (detected task, topic, what it looked at). If it isn't sure, it never suggests a lighter model.
- It warns you when switching models mid-chat would make the new model re-read the whole history.
- It learns your plan over time: after each message it compares the forecast with how your usage actually moved.
- A weekly report (model/task mix, hourly heatmap, most expensive messages), computed locally.

**Privacy**

No server, no analytics. Your messages, attachments and chats never leave your browser. It only talks to claude.ai with your own session (it reads the same usage numbers the Settings page shows) and it never sends messages or changes settings for you. It asks for consent before reading anything. The end-to-end test checks the network: only requests to claude.ai.

**How I built it with Claude**

I'm a physics student, zero budget. Most of the code was written with Claude Code; I did the design, the measurements and the decisions about what counts as "good enough". Claude was also useful for the boring-but-important parts: test sets for the task classifier, a blind quality check of the model suggestions (below), and catching my own overclaims in the README.

**Honest numbers (and their limits)**

- Anthropic doesn't publish limit sizes, so every forecast is an estimate. In a simulation with 300 virtual plans, the plan-size error went from 1.68× at the first message to 1.13× after 20 messages. Real accounts may differ; the report shows whether it's learning *your* plan.
- A single message can't be predicted exactly (answer length and hidden thinking are random). The goal is to get the block total and the range right.
- I tested the model suggestions blind: 58 self-contained prompts, answers from Haiku, Sonnet and Opus, scored by a model judge without knowing which was which. When it suggested Haiku (13 prompts), Haiku's answer scored 4/5 or higher every time. It suggested something lighter than needed in 5 of 58 (9%). It's also too cautious: in 33 of 58 a lighter model would have done. No human judge yet, so take this as a first check, not proof.
- The basics were verified on the real claude.ai; newer features were only tested on a mock page. If Anthropic changes the page, it needs an update (there's a health check that shows it).

**Free and open source** (AGPL-3.0). Chrome, Edge, Brave; Opera with its Chrome-extensions add-on. Interface in 10 languages; message analysis only in English and Turkish for now.

- Chrome Web Store: https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige
- Source: https://github.com/H-ENES1/ai-assistant-claude

Not affiliated with Anthropic. I'd really like to hear where the forecast is way off for you, and what you'd want it to show.

---

**Not:** "I kept running out..." ve "How I built it" paragrafları senin hikâyen; kendi cümlelerinle yaz. Kalite sayıları `tests/quality/RAPOR.md`'den; bu dosya 0.13.0 birleşmesinden önce main'de yok, o yüzden gönderiyi 0.13.0'dan sonra at (TAKVIM.md).
