// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Bağlam penceresi (context window) boyutları ve uyarı seviyesi.
// Kaynak: https://support.claude.com/en/articles/8606394 (Ekim 2026, ücretli planlar, sohbet)
//   1M  : Fable 5.1, Opus 5.5, Opus 5, Sonnet 5.5, Sonnet 5, Haiku 5.5
//   500K: Fable 5, Opus 4.8, Opus 4.7, Opus 4.6, Sonnet 4.6
//   diğer: 200K
// Ücretsiz plan için resmi değer yayınlanmadığından, model algılanamazsa temkinli
// olarak 200K varsayılır.

const ONE_M = ["fable 5.1", "opus 5.5", "opus 5", "sonnet 5.5", "sonnet 5", "haiku 5.5"];
const HALF_M = ["fable 5", "opus 4.8", "opus 4.7", "opus 4.6", "sonnet 4.6"];
export const DEFAULT_WINDOW = 200_000;

// "Opus 5.5" → "opus 5.5"; tam eşleşme için sondaki sürümü ayrı tutar.
export function normalizeModel(name) {
  const m = String(name || "").toLowerCase().match(/(fable|opus|sonnet|haiku)\s*(\d+(?:\.\d+)?)/);
  return m ? `${m[1]} ${m[2]}` : null;
}

export function contextWindowFor(modelName) {
  const m = normalizeModel(modelName);
  if (!m) return { tokens: DEFAULT_WINDOW, known: false, model: null };
  if (ONE_M.includes(m)) return { tokens: 1_000_000, known: true, model: m };
  if (HALF_M.includes(m)) return { tokens: 500_000, known: true, model: m };
  return { tokens: DEFAULT_WINDOW, known: true, model: m };
}

// level: "ok" | "near" (alt sınır %80'i geçti ya da üst sınır pencereyi aşabilir) | "over" (alt sınır bile aşıyor)
export function contextLevel(total, windowTokens) {
  const lowPct = total.low / windowTokens;
  const highPct = total.high / windowTokens;
  let level = "ok";
  if (lowPct >= 1) level = "over";
  else if (lowPct >= 0.8 || highPct >= 1) level = "near";
  return { level, lowPct, highPct };
}
