// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// claude.ai sayfasından prompt kutusunu, sohbet geçmişini ve ekleri okur.
// Claude.ai'nin sayfa yapısı değişebilir; bu yüzden her şey için birden çok seçici denenir.
// Sayfa değişirse düzeltilecek tek yer bu dosya.

const INPUT_SELECTORS = [
  'div.ProseMirror[contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
  'fieldset [contenteditable="true"]',
  "textarea"
];

const USER_MSG_SELECTORS = [
  '[data-testid="user-message"]',
  '[data-testid="user-human-turn"]'
];

const ASSISTANT_MSG_SELECTORS = [
  ".font-claude-response",
  "[data-is-streaming]",
  '[data-testid="assistant-message"]'
];

const ATTACHMENT_SELECTORS = [
  '[data-testid="file-thumbnail"]',
  '[data-testid*="attachment"]',
  'fieldset img[alt]'
];

function firstMatch(selectors, root = document) {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

function allMatches(selectors, root = document) {
  for (const s of selectors) {
    const list = [...root.querySelectorAll(s)];
    if (list.length) return list;
  }
  return [];
}

// Aynı mesajın iç içe iki eşleşmesini tekilleştirir (dıştakini tutar).
function outermost(list) {
  return list.filter((el) => !list.some((o) => o !== el && o.contains(el)));
}

export function getInputElement() {
  return firstMatch(INPUT_SELECTORS);
}

export function readPrompt() {
  const el = getInputElement();
  if (!el) return { found: false, text: "" };
  const text = el.tagName === "TEXTAREA" ? el.value : el.innerText;
  return { found: true, text: (text || "").replace(/ /g, " ").trim() };
}

export function readHistory() {
  const user = outermost(allMatches(USER_MSG_SELECTORS)).map((e) => e.innerText || "");
  const assistant = outermost(allMatches(ASSISTANT_MSG_SELECTORS)).map((e) => e.innerText || "");
  return {
    found: user.length + assistant.length > 0,
    user,
    assistant
  };
}

export function readAttachments() {
  const composer = getInputElement()?.closest("fieldset, form") || document;
  const items = outermost(allMatches(ATTACHMENT_SELECTORS, composer));
  return { count: items.length };
}

// Mesaj kutusunun yakınındaki model seçiciden model adını okur ("Opus 5.5" gibi).
const MODEL_RE = /\b(Fable|Opus|Sonnet|Haiku)\s+\d+(?:\.\d+)?\b/;
export function detectModel() {
  const composer = getInputElement()?.closest("fieldset, form") || document;
  const candidates = [
    ...composer.querySelectorAll('[data-testid*="model"], button'),
    ...document.querySelectorAll('[data-testid*="model-selector"]')
  ];
  for (const el of candidates) {
    const m = (el.innerText || el.textContent || "").match(MODEL_RE);
    if (m) return m[0];
  }
  return null;
}

// Effort / düşünme seviyesi seçicisi ("Orta", "High" gibi). Bulunamazsa null.
const EFFORT_RE = /(?:^|[\s·|()])(çok yüksek|ekstra yüksek|extra high|x-?high|düşük|orta|yüksek|maksimum|maks|low|medium|high|max)(?=$|[\s·|()])/i;
export function detectEffort() {
  const composer = getComposer() || document;
  for (const el of composer.querySelectorAll("button, [role='button'], [data-testid*='effort']")) {
    const text = (el.innerText || el.textContent || "").trim();
    if (!text || text.length > 40) continue;
    const m = text.toLocaleLowerCase("tr").match(EFFORT_RE);
    if (m) return m[1];
  }
  return null;
}

// Panelin yapışacağı kutu: mesaj kutusunu saran fieldset / form.
export function getComposer() {
  const input = getInputElement();
  if (!input) return null;
  return input.closest("fieldset") || input.closest("form") || input.parentElement;
}

export function isConversationPage() {
  // Mesaj kutusu olan her sayfa (sohbet, yeni sohbet, proje)
  if (getInputElement()) return true;
  return /^\/chat\//.test(location.pathname) || location.pathname === "/new";
}

// Gönderim/cevap tespiti için hafif sayımlar (metin okumadan).
export function countUserMessages() {
  return outermost(allMatches(USER_MSG_SELECTORS)).length;
}
// Son asistan mesajı: metni ve hâlâ yazılıyor mu (data-is-streaming="true")
export function lastAssistant() {
  const list = outermost(allMatches(ASSISTANT_MSG_SELECTORS));
  const el = list[list.length - 1];
  const streaming = !!document.querySelector('[data-is-streaming="true"]');
  return { count: list.length, text: el ? (el.innerText || "") : "", streaming, el: el || null };
}
// Son kullanıcı mesajı ve kısa bir kimlik (metnin başı + uzunluğu). claude.ai uzun sohbetlerde eski mesajları
// sayfadan kaldırdığı için mesaj SAYISI güvenilir değil; yeni gönderim, son mesajın değişmesinden anlaşılır.
export function lastUserMessage() {
  const list = outermost(allMatches(USER_MSG_SELECTORS));
  const el = list[list.length - 1] || null;
  const text = el ? (el.innerText || "") : "";
  return { el, key: el ? `${text.length}|${text.slice(0, 200)}` : "" };
}

// Mesaj kutusunun hemen üstünde claude.ai'nin kendi uyarısı (ör. kullanım bildirimi) varsa,
// bizim bildirimimiz onun üstüne yerleşsin diye en üst sınırı verir.
export function composerTop() {
  const c = getComposer();
  if (!c) return null;
  const r = c.getBoundingClientRect();
  let top = r.top, el = c;
  for (let depth = 0; depth < 3 && el; depth++) {
    let prev = el.previousElementSibling;
    while (prev) {
      if (!prev.hasAttribute?.("data-token-forecast")) {
        const pr = prev.getBoundingClientRect();
        const visible = pr.height > 0 && pr.width > 0;
        const overlapsX = pr.right > r.left && pr.left < r.right;
        if (visible && overlapsX && pr.bottom >= top - 12 && pr.bottom <= top + 2 && pr.height < 180) top = Math.min(top, pr.top);
        else if (visible && pr.bottom < top - 12) break;
      }
      prev = prev.previousElementSibling;
    }
    el = el.parentElement;
  }
  return top;
}
