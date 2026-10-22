// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Öğrenen iş türü sınıflandırıcısı (cihazda çalışır, hiçbir şey dışarı gitmez).
//
// Yöntem: çok sınıflı lojistik regresyon (softmax). Özellikler:
//  - kelimeler ve kelime ikilileri (Türkçe küçük harf + aksan katlama: "çevir" = "cevir")
//  - kelime içi karakter 3-5'lileri (Türkçe ekler: "çevirir misin", "çevirebilir" aynı kökü paylaşır)
//  - mesajın ilk ve son kelimeleri (talimat genelde başta ya da sondadır)
//  - kural tabanlı sınıflandırıcının puanları (lib/classify.js) → iki yöntem birbirini tamamlar
// Özellikler "hashing trick" ile sabit boyutlu bir vektöre katlanır (sözlük saklanmaz).
//
// Ağırlıklar tests/ml/train.mjs ile eğitilip lib/learn-weights.js'e yazılır (int8, base64).
// Kişisel öğrenme: kullanıcı "iş türü yanlış" deyip doğrusunu seçerse, ağırlıklara küçük bir
// kişisel düzeltme eklenir (personalStep). Metin saklanmaz; yalnızca ağırlık farkları saklanır.

export const LEARN_TYPES = ["short_qa", "explain", "math", "code_write", "code_fix", "translate",
  "writing", "rewrite", "summarize", "data_analysis", "research", "file_create"];

const FOLD = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
export function normalize(text) {
  return String(text || "").toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (c) => FOLD[c]).normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

// FNV-1a 32 bit
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const RULE_SCALE = 1 / 3;

// Seyrek özellik listesi: [[indeks, değer], ...]
export function featurize(text, ruleScores = null, dim = 8192) {
  const raw = String(text || "");
  const cut = raw.length > 1200 ? raw.slice(0, 800) + " " + raw.slice(-400) : raw;
  const norm = normalize(cut);
  const words = norm.match(/[\p{L}]+|\d+/gu) || [];
  const feats = new Map();
  const add = (key, v = 1) => { const i = hash(key) % dim; feats.set(i, (feats.get(i) || 0) + v); };
  for (let i = 0; i < words.length; i++) {
    const w = words[i].slice(0, 24);
    add("w:" + w);
    if (i + 1 < words.length) add("b:" + w + "_" + words[i + 1].slice(0, 24));
    if (/^\d+$/.test(w)) continue;
    const g = "<" + w + ">";
    for (let n = 3; n <= 5; n++) for (let j = 0; j + n <= g.length; j++) add("c" + n + ":" + g.slice(j, j + n), 0.5);
  }
  for (const w of words.slice(0, 3)) add("f:" + w.slice(0, 24));
  for (const w of words.slice(-3)) add("l:" + w.slice(0, 24));
  const nw = words.length;
  add("len:" + (nw <= 3 ? "a" : nw <= 8 ? "b" : nw <= 20 ? "c" : nw <= 60 ? "d" : "e"));
  if (/```/.test(raw) || raw.split("\n").filter((l) => /[{}();=]/.test(l) && /[a-zA-Z_]\w*\s*[(=]/.test(l)).length >= 2) add("sig:code", 2);
  if (/(error|exception|traceback|hata|err!|undefined|segfault|\b\d{3}\b bad gateway)/i.test(raw)) add("sig:err");
  if (/\?\s*$/.test(raw.trim())) add("sig:q");
  if (/[=∫∑√∂≤≥π^]|\d\s*[x*/+\-]\s*\d/.test(raw)) add("sig:math");
  if (/[^\x00-ɏ\s\d\p{P}]/u.test(raw)) add("sig:script"); // Latin dışı yazı (çeviri ipucu)
  if (ruleScores) {
    let best = null, bv = 0;
    for (const t of LEARN_TYPES) {
      const v = ruleScores[t] || 0;
      if (v > 0) add("r:" + t, Math.min(3, v * RULE_SCALE));
      if (v > bv) { bv = v; best = t; }
    }
    add("rt:" + (best || "none"));
  }
  // L2 normalizasyonu: uzun mesajlar kısa mesajları ezmesin
  let nrm = 0; for (const v of feats.values()) nrm += v * v;
  nrm = Math.sqrt(nrm) || 1;
  return [...feats].map(([i, v]) => [i, v / nrm]);
}

// Model: { dim, classes, W: Float32Array(dim*K), b: Float32Array(K) }
export function predict(model, feats, personal = null) {
  const K = model.classes.length;
  const z = Array.from(model.b);
  for (const [i, v] of feats) {
    const off = i * K;
    for (let k = 0; k < K; k++) z[k] += model.W[off + k] * v;
    const p = personal?.w?.[i];
    if (p) for (let k = 0; k < K; k++) z[k] += (p[k] || 0) * v;
  }
  const m = Math.max(...z);
  const e = z.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  const probs = e.map((x) => x / s);
  let top = 0; for (let k = 1; k < K; k++) if (probs[k] > probs[top]) top = k;
  const sorted = [...probs].sort((a, b) => b - a);
  return { type: model.classes[top], prob: probs[top], margin: sorted[0] - sorted[1], probs: Object.fromEntries(model.classes.map((c, k) => [c, probs[k]])) };
}

// Kişisel düzeltme: tek örnekle birkaç küçük gradyan adımı. personal = { w: {indeks: [K]}, n }
export function personalStep(model, personal, feats, label, { lr = 0.6, steps = 3, maxKeys = 6000 } = {}) {
  const K = model.classes.length;
  const y = model.classes.indexOf(label);
  if (y < 0) return personal;
  const P = personal && personal.w ? personal : { w: {}, n: 0 };
  for (let s = 0; s < steps; s++) {
    const pr = predict(model, feats, P);
    const g = model.classes.map((c, k) => pr.probs[c] - (k === y ? 1 : 0));
    for (const [i, v] of feats) {
      const row = (P.w[i] ||= new Array(K).fill(0));
      for (let k = 0; k < K; k++) row[k] = Math.round((row[k] - lr * g[k] * v) * 1000) / 1000;
    }
  }
  P.n = (P.n || 0) + 1;
  const keys = Object.keys(P.w);
  if (keys.length > maxKeys) for (const k of keys.slice(0, keys.length - maxKeys)) delete P.w[k];
  return P;
}

// int8 + ölçek ile sıkıştırılmış ağırlıkları aç
export function decodeModel(packed) {
  const bin = typeof atob === "function" ? atob(packed.W) : Buffer.from(packed.W, "base64").toString("binary");
  const W = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) { let q = bin.charCodeAt(i); if (q > 127) q -= 256; W[i] = q * packed.scale; }
  return { dim: packed.dim, classes: packed.classes, W, b: Float32Array.from(packed.b), meta: packed.meta || null };
}

export function encodeModel(model, meta = null) {
  let mx = 0; for (const x of model.W) mx = Math.max(mx, Math.abs(x));
  const scale = mx / 127 || 1;
  let bin = "";
  for (const x of model.W) { let q = Math.round(x / scale); q = Math.max(-127, Math.min(127, q)); bin += String.fromCharCode(q < 0 ? q + 256 : q); }
  const W = typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return { dim: model.dim, classes: model.classes, scale, b: Array.from(model.b, (x) => Math.round(x * 1e4) / 1e4), W, meta };
}
