// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Ek dosyaların token maliyetini tahmin eder. Dosyalar tamamen yerelde, tarayıcıda
// incelenir; hiçbir yere gönderilmez.
//
// Kaynaklar (Anthropic belgeleri, Ekim 2026):
// - Görsel: token = ⌈genişlik/28⌉ × ⌈yükseklik/28⌉. Standart modellerde uzun kenar 1568 px,
//   en fazla 1568 token; Claude 4.7 ve sonrasında uzun kenar 2576 px, en fazla 4784 token.
//   https://platform.claude.com/docs/en/build-with-claude/vision
// - PDF: sayfa başına tipik olarak 1.500–3.000 metin tokenı + sayfanın görüntü maliyeti.
//   https://platform.claude.com/docs/en/build-with-claude/pdf-support

import { estimateTokens } from "./tokens.js";

const MAX_READ_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;

export const IMAGE_TIERS = {
  standard: { edge: 1568, tokens: 1568 },
  highRes: { edge: 2576, tokens: 4784 }
};

export function imageTokens(w, h, tier) {
  if (!(w > 0 && h > 0)) return 0;
  let s = Math.min(1, tier.edge / Math.max(w, h));
  let W = w * s, H = h * s;
  const count = () => Math.ceil(W / 28) * Math.ceil(H / 28);
  let t = count();
  if (t > tier.tokens) {
    const s2 = Math.sqrt((tier.tokens * 784) / (W * H));
    W *= s2; H *= s2; t = count();
    while (t > tier.tokens) { W *= 0.99; H *= 0.99; t = count(); }
  }
  return t;
}

// PDF sayfası başına aralık.
// Claude.ai: 100 sayfa ve altı → metin + görseller; 101–1000 sayfa → yalnızca metin;
// 1000 sayfa üstü yüklenemez. https://support.claude.com/en/articles/8241126
const PDF_PAGE = { low: 1000, high: 3000 + IMAGE_TIERS.standard.tokens };
const PDF_PAGE_TEXT_ONLY = { low: 400, high: 2500 };
export const PDF_VISUAL_MAX_PAGES = 100;
export const PDF_MAX_PAGES = 1000;

export function pdfTokens(pages) {
  const per = pages > PDF_VISUAL_MAX_PAGES ? PDF_PAGE_TEXT_ONLY : PDF_PAGE;
  return { low: pages * per.low, high: pages * per.high, textOnly: pages > PDF_VISUAL_MAX_PAGES, tooLarge: pages > PDF_MAX_PAGES };
}

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|ipynb|java|c|h|cpp|hpp|cs|go|rs|rb|php|sh|bat|ps1|sql|yaml|yml|toml|ini|cfg|log|tex|bib|r|m|swift|kt|lua|pl|srt|vtt)$/i;
const OFFICE_EXT = /\.(docx|xlsx|pptx|odt|ods|odp)$/i;

export function classify(file) {
  const name = file.name || "";
  const type = file.type || "";
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (OFFICE_EXT.test(name)) return "office";
  if (type.startsWith("text/") || TEXT_EXT.test(name) || type === "application/json") return "text";
  return "other";
}

async function imageSize(file) {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file);
    const size = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return size;
  }
  return null;
}

export function countPdfPages(bytes) {
  const s = new TextDecoder("latin1").decode(bytes);
  const pages = (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  if (pages > 0) return pages;
  let max = 0;
  for (const m of s.matchAll(/\/Count\s+(\d+)/g)) max = Math.max(max, Number(m[1]));
  return max;
}

// --- Office dosyaları (zip içindeki XML'lerden metni çıkarır) ---
async function inflateRaw(data) {
  const ds = new DecompressionStream("deflate-raw");
  const buf = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

export async function readZipEntries(bytes, wanted) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip: no end record");
  const entries = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  const dec = new TextDecoder();
  for (let n = 0; n < entries; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted.test(name)) continue;
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compSize);
    const data = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (data) out.push({ name, text: dec.decode(data) });
  }
  return out;
}

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function xmlText(xml) {
  const parts = [];
  for (const m of xml.matchAll(/<(?:w:t|a:t|t|v|text:p|text:span)(?:\s[^>]*)?>([^<]*)</g)) {
    if (m[1]) parts.push(m[1]);
  }
  return parts.join(" ").replace(/&(\w+);/g, (_, e) => XML_ENTITIES[e] ?? " ");
}

async function officeText(bytes) {
  const files = await readZipEntries(
    bytes,
    /^(word\/document\.xml|word\/(header|footer|footnotes)\d*\.xml|ppt\/slides\/slide\d+\.xml|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml|content\.xml)$/
  );
  return files.map((f) => xmlText(f.text)).join("\n");
}

// --- Ana fonksiyon ---
// Dönüş: { kind, name, low, high, detail, confidence }
export async function analyzeFile(file, { fallbackTr = 0 } = {}) {
  const kind = classify(file);
  const base = { kind, name: file.name || "", size: file.size };
  try {
    if (kind === "image") {
      const sz = await imageSize(file);
      if (!sz) throw new Error("no image size");
      return {
        ...base,
        low: imageTokens(sz.w, sz.h, IMAGE_TIERS.standard),
        high: imageTokens(sz.w, sz.h, IMAGE_TIERS.highRes),
        detail: sz,
        confidence: "high"
      };
    }
    if (kind === "pdf") {
      const bytes = new Uint8Array(await file.slice(0, MAX_READ_BYTES).arrayBuffer());
      let pages = countPdfPages(bytes);
      let confidence = "medium";
      if (!pages) { pages = Math.max(1, Math.round(file.size / 60000)); confidence = "low"; }
      const pt = pdfTokens(pages);
      return { ...base, low: pt.low, high: pt.high, detail: { pages, textOnly: pt.textOnly, tooLarge: pt.tooLarge }, confidence };
    }
    if (kind === "office") {
      const bytes = new Uint8Array(await file.slice(0, MAX_READ_BYTES).arrayBuffer());
      const text = await officeText(bytes);
      const e = estimateTokens(text, { fallbackTr });
      return { ...base, low: e.low, high: Math.ceil(e.high * 1.15), detail: { chars: text.length }, confidence: "medium" };
    }
    if (kind === "text") {
      const text = await file.slice(0, MAX_TEXT_BYTES).text();
      const e = estimateTokens(text, { fallbackTr });
      const scale = file.size > MAX_TEXT_BYTES ? file.size / MAX_TEXT_BYTES : 1;
      return { ...base, low: Math.round(e.low * scale), high: Math.round(e.high * scale), detail: { chars: text.length }, confidence: "high" };
    }
  } catch (e) {
    console.debug("[Token Forecast] ek incelenemedi:", file.name, e?.message || e);
  }
  // Bilinmeyen tür ya da hata: boyuttan kaba tahmin
  return { ...base, kind: "other", low: Math.round(file.size / 8), high: Math.round(file.size / 2.5), detail: {}, confidence: "low" };
}

export function analyzePastedText(text, { fallbackTr = 0 } = {}) {
  const e = estimateTokens(text, { fallbackTr });
  return { kind: "pasted", name: text.slice(0, 40), size: text.length, low: e.low, high: e.high, detail: { chars: text.length }, confidence: "high" };
}
