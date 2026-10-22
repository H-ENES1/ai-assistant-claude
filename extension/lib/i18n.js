// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Dil desteği. chrome.i18n dili tarayıcıya göre seçer ve çalışırken değiştirilemez;
// kullanıcı ayarlardan dil seçebilsin diye messages.json dosyalarını kendimiz yükleriz.
// Biçim, Chrome'un messages.json biçimiyle aynıdır ($1, $2 ve adlandırılmış yer tutucular).

// Desteklenen arayüz dilleri: kod → { klasör (_locales), biçim yerel ayarı, kendi adı }
// Chrome'un geçerli yerel ayar klasör adları gerekir (pt_BR, zh_CN); dil kodu ise kısa tutulur.
export const LANGS = {
  tr: { dir: "tr", locale: "tr-TR", name: "Türkçe" },
  en: { dir: "en", locale: "en-US", name: "English" },
  de: { dir: "de", locale: "de-DE", name: "Deutsch" },
  fr: { dir: "fr", locale: "fr-FR", name: "Français" },
  es: { dir: "es", locale: "es-ES", name: "Español" },
  it: { dir: "it", locale: "it-IT", name: "Italiano" },
  pt: { dir: "pt_BR", locale: "pt-BR", name: "Português" },
  ru: { dir: "ru", locale: "ru-RU", name: "Русский" },
  ja: { dir: "ja", locale: "ja-JP", name: "日本語" },
  zh: { dir: "zh_CN", locale: "zh-CN", name: "简体中文" }
};
const SUPPORTED = Object.keys(LANGS);
const cache = new Map();

export function resolveLang(setting, uiLang = (globalThis.chrome?.i18n?.getUILanguage?.() || "en")) {
  if (SUPPORTED.includes(setting)) return setting;
  const base = String(uiLang).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(base) ? base : "en";
}

async function loadMessages(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const url = chrome.runtime.getURL(`_locales/${LANGS[lang]?.dir || lang}/messages.json`);
  const json = await (await fetch(url)).json();
  cache.set(lang, json);
  return json;
}

export function format(entry, subs = []) {
  if (!entry) return "";
  let msg = entry.message || "";
  const list = Array.isArray(subs) ? subs.map(String) : [String(subs)];
  if (entry.placeholders) {
    for (const [name, ph] of Object.entries(entry.placeholders)) {
      const val = String(ph.content || "").replace(/\$(\d)/g, (_, d) => list[Number(d) - 1] ?? "");
      msg = msg.replace(new RegExp(`\\$${name}\\$`, "gi"), val);
    }
  }
  msg = msg.replace(/\$(\d)/g, (_, d) => list[Number(d) - 1] ?? "");
  return msg.replace(/\$\$/g, "$");
}

export async function makeI18n(setting = "auto") {
  const lang = resolveLang(setting);
  const [main, fallback] = await Promise.all([loadMessages(lang), loadMessages("en")]);
  const t = (key, subs) => format(main[key] || fallback[key], subs) || key;
  const locale = LANGS[lang]?.locale || "en-US";
  const nf = new Intl.NumberFormat(locale);
  // Küçük yüzdelerde daha fazla ondalık: 0,03 · 0,4 · 7
  const pctFmt = (x) => {
    const v = !(x > 0) ? 0 : x < 0.1 ? Math.max(0.01, Math.round(x * 100) / 100) : x < 1 ? Math.round(x * 10) / 10 : x < 10 ? Math.round(x * 10) / 10 : Math.round(x);
    return t("pct", [nf.format(v)]);
  };
  return { lang, t, num: (n) => nf.format(Math.round(n)), pct: pctFmt, locale };
}

export function duration(t, ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(totalMin / 1440), h = Math.floor((totalMin % 1440) / 60), m = totalMin % 60;
  if (d > 0) return t("durDH", [String(d), String(h)]);
  if (h > 0) return t("durHM", [String(h), String(m)]);
  return t("durM", [String(m)]);
}

export function clock(ts, locale) {
  const date = new Date(ts);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
