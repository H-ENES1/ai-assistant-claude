> **Kural 1:** dev.to yapay zekâ yardımıyla yazılmış makalelerde beyan istiyor (başta #abotwrotethis etiketi ya da makalede bir not), bilgiyi yayından önce kontrol etmeni ve anlamadığın eğitim içeriği yayımlamamanı şart koşuyor; yapay zekâ ile yazılmış yorum yasak ([dev.to AI kılavuzu](https://dev.to/guidelines-for-ai-assisted-articles-on-dev)).
> **Kural 2:** Gönderi esas olarak tanıtım ya da backlink için olmamalı, "substantial content" içermeli, yalnızca dışarı link vermemeli ([dev.to terms, 11. bölüm](https://dev.to/terms)). Bu yüzden makale yöntemi anlatıyor; eklenti bağlantısı yalnızca sonda.

---

Front matter (dev.to editöründe):

```
---
title: How I estimate my Claude usage limit before sending a message
published: false
tags: ai, javascript, statistics, opensource
---
```

---

# How I estimate my Claude usage limit before sending a message

claude.ai gives you a 5-hour limit and a weekly limit, shown as percentages. What it doesn't tell you is how much of that a message will use until after you've sent it. I'm a physics student, and I wanted the number *before* pressing send. This post is about how I estimate it in the browser, what I measured, and where the estimate is still weak.

The short version: count tokens with a cheap linear model, multiply by a per-model weight, treat the answer length as a random variable, and learn the one unknown that matters (how big your plan is) from how your usage percentage actually moves.

## 1. The cost model

Anthropic doesn't publish how the limit is computed. I use a model shaped like API pricing, where output costs about 5× input:

```
cost   = w_model × [ new input + uncached history + tool input + 5 × (answer + thinking) ]
limit% = k_plan × cost
```

- `w_model` is a relative weight per model (heavier models drain the limit faster). These are **priors**, partly guessed from API price ratios; for some models the weight in subscription limits isn't published at all.
- `uncached history`: if the chat was used within the last hour, the history is read from the cache and, as far as I can tell from Anthropic's docs and my own measurements, doesn't count. Switching model mid-chat means the new model reads the whole history cold, which is one of the more useful warnings the extension gives.
- `k_plan` is "how many % of the limit one cost unit is". It depends on your plan and isn't published. It's the main thing the extension learns.

## 2. Counting tokens without the tokenizer

Claude's current tokenizer isn't available to run in the browser. I needed something fast enough to run on every keystroke.

I split the text into Turkish, English and code segments and count simple features: words, letters, digits, symbols, newlines. Then for each segment type I fit non-negative least squares weights against an open-source tokenizer (o200k, via `gpt-tokenizer`) on sample texts:

| | word | letter | digit | symbol | newline |
|---|---|---|---|---|---|
| Turkish | 1.10 | 0.154 | 0.8 | 0.30 | 1.0 |
| English | 0.90 | 0.042 | 0.8 | 0.12 | 1.0 |
| Code | 1.01 | 0.017 | 1.03 | 0.46 | 1.17 |

Typical error against o200k: about 3% for English, 7% for Turkish, 9% for code. Turkish costs more per letter because it's agglutinative: long words get split into many pieces.

Then I need Claude's tokens, not o200k's. I use a factor of **1.4** (Claude's current tokenizer produces about 1.4× as many tokens as o200k). That number isn't mine: it's a measurement published by another open-source project (lugia19's Claude Usage Extension, credited in the README; no code was copied). It was measured on English text, so the Turkish range is kept wider.

For other languages I measured o200k on six sample prompts each (~700 letters): other Latin-script languages come out ≈ 1.22× the English model (1.12–1.34), Cyrillic ≈ 1.54×, Chinese/Japanese ≈ 0.73 tokens per character. Six prompts is a small sample, so the forecast range is wide there too.

**Weak spot:** the 1.4 factor is borrowed, and the Claude/o200k ratio for CJK wasn't measured separately. Calibration (below) absorbs a constant error, but not one that changes with language.

## 3. The answer is the expensive part, and it's random

Output counts 5×, and you don't know how long the answer will be. I model answer length as log-normal per task type (12 types: translation, short question, code writing, math…), with parameters derived from the CASTILLO dataset of LLM response lengths. Hidden thinking adds more, depending on the effort level.

So the forecast isn't a number, it's a distribution: 800 Monte Carlo samples (seeded, so it's reproducible) give a median and an 80% range. The pill shows the median and the range.

The task type comes from rules plus a small logistic-regression model (128 KB) that runs in the browser. On a test set of 120 everyday messages written without looking at the rules, rules alone got the task type right 64% of the time and rules + model 88%. Those messages were written by the project, not by real users, so treat that as an upper bound.

## 4. Learning your plan from integer percentages

This is the part I like most. claude.ai reports usage as a percentage, and for a short message the change is often 0 or 1 point. If you estimate `k` as the average of `Δ% / cost` per message, rounding makes it biased.

Instead I use a Gamma-Poisson conjugate update. Treat the observed change `Δ` as a count with rate `k × C`, where `C` is the message's realized cost (computed with the actual answer length, once the answer is on screen):

```
k ~ Gamma(a, b)
after each message:  a += Δ,  b += C
```

That's a ratio of sums instead of an average of ratios, which stays unbiased when most `Δ` are 0 or 1. On top of that:

- old observations decay with a 45-day half-life, because Anthropic can change limits;
- an outlier filter drops measurements where you obviously used the account elsewhere at the same time (another tab, Claude Code);
- peak hours get their own multiplier, also learned;
- answer length gets a hierarchical normal correction: a global "Claude answers you longer/shorter than the prior" offset, plus per-task offsets that shrink toward the global one.

**How well does it work?** In a simulation where each virtual plan's true `k` is up to ~2× away from the prior (300 plans), the median error of `k` is 1.68× before the first message, 1.13× after 20 messages and 1.08× after 100. In a second simulation (200 virtual users, 120 messages each, running the extension's real forecast and calibration code), the error on a block's total went from 2.04× to 1.40×, while a copy that doesn't learn stayed around 2.1–2.2×. The 80% interval contained the truth 79% of the time.

What that doesn't prove: those users are simulated. On real accounts I've only checked the basics (3 measurements in October 2026). The extension's weekly report has a "learning proof" section that compares the first and last measurements on *your* account and says so if the error isn't shrinking.

And there's a floor: for a single message the error can't go much below ~1.7×, because answer length and thinking are random. A perfect predictor that knew everything except the dice would also sit there. The goal is to get the block total and the range right, not each message.

## 5. Measuring when you can't see the request

The obvious approach is to wrap `fetch` and watch the request. On claude.ai that doesn't work: messages are sent from a Web Worker, so a hook in the page never sees them. The measurement uses the page structure instead: the last user message changed means "sent", the answer stopped growing means "done". Usage is read at send time and again 4 s and 30 s after the answer. That's fragile (selectors change) so there's a health check that shows which step broke.

## 6. Is the model suggestion any good?

The extension also says "Haiku is enough for this" or "use Sonnet". I checked that once, blind: 80 prompts, answers from Haiku, Sonnet and Opus, shuffled, scored 1–5 by a model judge (Fable 5.2) that didn't know which model wrote what. On the 58 prompts that could be answered without missing context:

- when it suggested Haiku (13 prompts), Haiku's answer scored 4+ in all 13;
- it suggested something lighter than needed in 5 of 58 (9%, 95% interval 4–19%);
- it suggested something heavier than needed in 33 of 58 (57%). That's probably overstated: answers were capped at 400 words, which hides the difference on long tasks.

No human judge, the prompts were written by the project, and the effort suggestion wasn't tested. It's a first check, and the main lesson was that the cautious bias is real.

## What's still weak

- Plan sizes and model weights start as rough priors.
- Thinking tokens aren't visible on claude.ai; they're learned only indirectly.
- Everything depends on undocumented internals of the site.

## The code

All of this runs locally in a Chrome extension. There's no server and the message text never leaves the browser. It's open source (AGPL-3.0) if you want to check the numbers or reproduce the simulations (`npm run proof`):

- Source: https://github.com/H-ENES1/ai-assistant-claude
- Chrome Web Store: https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige

If you know a better way to learn a rate from rounded percentages, I'd like to hear it.

*Disclosure: I wrote this article with help from Claude (Anthropic's AI) and checked every number against the code and test results in the repository. Much of the extension's code was also written with Claude Code.*

---

**Kaynak kontrolü (yayından önce):** katsayı tablosu `extension/lib/tokens.js`; maliyet formülü, simülasyon sonuçları ve 3 ölçüm README; Gamma-Poisson ve 45 gün `extension/lib/calibrate.js`; kalite sayıları `tests/quality/RAPOR.md` (0.13.0 ile main'e gelir); 800 örnek `extension/lib/forecast.js`. "As far as I can tell... doesn't count" cümlesini kendi bildiğinle değiştir. Yayın: kendi sesinle elden geçirdikten sonra `published: true`.
