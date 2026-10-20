// Token tahmini: metni Türkçe / İngilizce / kod parçalarına ayırır ve her biri için
// ayrı katsayılarla token sayısını tahmin eder.
//
// Yöntem:
// 1) Katsayılar, açık kaynak o200k tokenizer'ı (gpt-tokenizer) referans alınarak örnek
//    TR/EN/kod metinleri üzerinde negatif olmayan en küçük kareler ile bulundu
//    (tipik hata: EN %3, TR %7, kod %9).
// 2) Güncel Claude tokenizer'ı o200k'dan yaklaşık 1,4 kat fazla token üretir. Bu değer
//    lugia19/Claude-Usage-Extension projesinin ölçümüdür (CONFIG.ESTIMATION_MULTIPLIER).
// 3) Tek sayı yerine aralık verilir: dile göre ± pay. Türkçede pay daha geniştir çünkü
//    1,4 katsayısı İngilizce metinden ölçülmüştür. Adım 10'daki kalibrasyon merkezi düzeltir.

const W = {
  tr:   { word: 1.10, letter: 0.154, digit: 0.8, symbol: 0.30, newline: 1.0 },
  en:   { word: 0.90, letter: 0.042, digit: 0.8, symbol: 0.12, newline: 1.0 },
  code: { word: 1.01, letter: 0.017, digit: 1.03, symbol: 0.46, newline: 1.17 }
};

export const CLAUDE_FACTOR = 1.4;
const SPREAD = { tr: 0.22, en: 0.12, code: 0.18 };

const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const TR_WORDS = new Set(
  "ve bir bu şu için ile de da mi mı mu mü ne ama çok daha gibi olarak var yok nasıl neden niye ben sen o biz siz onlar bana sana beni seni benim senin lütfen yani ki eğer hem ya veya ise kadar sonra önce şimdi bunu şunu bunun şunun olan olur oldu değil yap yaz anlat açıkla bana bir şey her hiç en".split(" ")
);
const EN_WORDS = new Set(
  "the and is are was were to of a an in on at you your it that this for with i me my can could would should what how why when where which do does did not be have has had will from by as or but if so please write explain".split(" ")
);

function countFeatures(text) {
  const f = { word: 0, letter: 0, digit: 0, symbol: 0, newline: 0 };
  for (const m of text.matchAll(/\p{L}+|\p{N}+|\n|[^\p{L}\p{N}\s]/gu)) {
    const t = m[0];
    if (t === "\n") f.newline++;
    else if (/^\p{N}+$/u.test(t)) f.digit += t.length;
    else if (/^\p{L}+$/u.test(t)) { f.word++; f.letter += t.length; }
    else f.symbol++;
  }
  return f;
}

function applyWeights(f, w) {
  return f.word * w.word + f.letter * w.letter + f.digit * w.digit +
         f.symbol * w.symbol + f.newline * w.newline;
}

// Düz metnin Türkçe payı (0..1). Hiç ipucu yoksa `fallbackTr` kullanılır.
export function turkishShare(text, fallbackTr = 0) {
  let tr = 0, en = 0;
  for (const m of text.matchAll(/\p{L}+/gu)) {
    const w = m[0];
    if (TR_CHARS.test(w) || TR_WORDS.has(w.toLocaleLowerCase("tr"))) tr++;
    else if (EN_WORDS.has(w.toLowerCase())) en++;
  }
  if (tr + en === 0) return fallbackTr;
  return tr / (tr + en);
}

function looksLikeCode(line) {
  const s = line.trim();
  if (s.length < 4) return false;
  const nonSpace = s.replace(/\s/g, "").length;
  const sym = (s.match(/[{}()[\];=<>:+\-*/\\|&!#"'`$.,]/g) || []).length;
  return sym / nonSpace > 0.18 && /[{}();=]/.test(s);
}

// Metni ``` blokları ve kod benzeri satırlara göre parçalara ayırır.
export function segment(text) {
  const parts = [];
  const fence = /```[\s\S]*?(```|$)/g;
  let last = 0;
  for (const m of text.matchAll(fence)) {
    if (m.index > last) parts.push(...splitLines(text.slice(last, m.index)));
    parts.push({ kind: "code", text: m[0] });
    last = m.index + m[0].length;
    if (m[0].length === 0) break;
  }
  if (last < text.length) parts.push(...splitLines(text.slice(last)));
  return parts;
}

function splitLines(chunk) {
  const out = [];
  let buf = [], bufKind = null;
  for (const line of chunk.split("\n")) {
    const kind = looksLikeCode(line) ? "code" : "prose";
    if (bufKind && kind !== bufKind) { out.push({ kind: bufKind, text: buf.join("\n") }); buf = []; }
    bufKind = kind; buf.push(line);
  }
  if (buf.length) out.push({ kind: bufKind, text: buf.join("\n") });
  return out;
}

const geo = (low, high) => Math.round(Math.sqrt(Math.max(low, 1) * Math.max(high, 1)));

// Ana fonksiyon: { low, mid, high, lang: {tr, en, code} (merkezi token payları), trShare }
export function estimateTokens(text, { fallbackTr = 0 } = {}) {
  if (!text) return { low: 0, mid: 0, high: 0, lang: { tr: 0, en: 0, code: 0 }, trShare: fallbackTr };
  const docTr = turkishShare(text, fallbackTr);
  const lang = { tr: 0, en: 0, code: 0 };
  let low = 0, high = 0;

  for (const p of segment(text)) {
    const f = countFeatures(p.text);
    if (p.kind === "code") {
      const c = applyWeights(f, W.code) * CLAUDE_FACTOR;
      lang.code += c; low += c * (1 - SPREAD.code); high += c * (1 + SPREAD.code);
    } else {
      const share = turkishShare(p.text, docTr);
      const cTr = applyWeights(f, W.tr) * CLAUDE_FACTOR * share;
      const cEn = applyWeights(f, W.en) * CLAUDE_FACTOR * (1 - share);
      lang.tr += cTr; lang.en += cEn;
      low += cTr * (1 - SPREAD.tr) + cEn * (1 - SPREAD.en);
      high += cTr * (1 + SPREAD.tr) + cEn * (1 + SPREAD.en);
    }
  }
  const mid = Math.round(lang.tr + lang.en + lang.code);
  return { low: Math.floor(low), mid, high: Math.ceil(high), lang, trShare: docTr };
}

// Sohbetteki mesajların toplamı.
export function estimateConversation(messages, opts) {
  let low = 0, mid = 0, high = 0;
  for (const m of messages) {
    const e = estimateTokens(m, opts);
    low += e.low; mid += e.mid; high += e.high;
  }
  return { low, mid, high };
}

export function sumRanges(...rs) {
  return rs.reduce((s, r) => ({
    low: s.low + (r?.low || 0),
    mid: s.mid + (r?.mid ?? geo(r?.low || 0, r?.high || 0)),
    high: s.high + (r?.high || 0)
  }), { low: 0, mid: 0, high: 0 });
}
