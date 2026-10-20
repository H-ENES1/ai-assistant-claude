// Dil desteği. chrome.i18n dili tarayıcıya göre seçer ve çalışırken değiştirilemez;
// kullanıcı ayarlardan dil seçebilsin diye messages.json dosyalarını kendimiz yükleriz.
// Biçim, Chrome'un messages.json biçimiyle aynıdır ($1, $2 ve adlandırılmış yer tutucular).

const SUPPORTED = ["tr", "en"];
const cache = new Map();

export function resolveLang(setting, uiLang = (globalThis.chrome?.i18n?.getUILanguage?.() || "en")) {
  if (SUPPORTED.includes(setting)) return setting;
  const base = String(uiLang).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(base) ? base : "en";
}

async function loadMessages(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
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
  const nf = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US");
  // Küçük yüzdelerde daha fazla ondalık: 0,03 · 0,4 · 7
  const pctFmt = (x) => {
    const v = !(x > 0) ? 0 : x < 0.1 ? Math.max(0.01, Math.round(x * 100) / 100) : x < 1 ? Math.round(x * 10) / 10 : x < 10 ? Math.round(x * 10) / 10 : Math.round(x);
    return t("pct", [nf.format(v)]);
  };
  return { lang, t, num: (n) => nf.format(Math.round(n)), pct: pctFmt, locale: lang === "tr" ? "tr-TR" : "en-US" };
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
