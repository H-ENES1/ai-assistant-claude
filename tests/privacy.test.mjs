// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Statik gizlilik denetimi. e2e ağ denetimi yalnızca testin GEZDİĞİ kod yollarını görür; bu test kaynağın
// tamamına bakar: veriyi cihazdan çıkarabilecek her yol (ağ çağrısı, uzak kaynak, geniş izin) ya yoktur
// ya da aşağıdaki açık listededir. Listeye bir şey eklemek = gizlilik kararını gözden geçirmek demektir;
// eklerken site/build/static/privacy.html ve onay metinlerini (welRead*, welStore) de güncelle.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };
const EXT = fileURLToPath(new URL("../extension/", import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => path.relative(EXT, p).replace(/\\/g, "/");
const files = walk(EXT).filter((p) => !/\.(png|md)$/i.test(p));
const src = Object.fromEntries(files.map((p) => [rel(p), readFileSync(p, "utf8")]));
const js = Object.keys(src).filter((f) => f.endsWith(".js"));
const html = Object.keys(src).filter((f) => f.endsWith(".html"));
const hits = (list, re) => list.flatMap((f) => src[f].split(/\r?\n/).map((line, i) => (re.test(line) ? `${f}:${i + 1}` : null)).filter(Boolean));

// 1) Hiç kullanılmaması gereken yollar
const FORBIDDEN = [
  ["XMLHttpRequest", /XMLHttpRequest/], ["sendBeacon", /sendBeacon/], ["WebSocket", /WebSocket/], ["EventSource", /EventSource/],
  ["WebRTC", /RTCPeerConnection|RTCDataChannel/], ["new Image / img.src ile istek", /new Image\s*\(|\.src\s*=[^=]/],
  ["importScripts", /importScripts/], ["uzak betik/çerçeve oluşturma", /createElement\(\s*["'](script|iframe|img|link|object|embed)["']/],
  ["storage.sync / managed (veri Google hesabına gider)", /storage\.(sync|managed)/],
  ["geniş tarayıcı API'leri", /chrome\.(cookies|webRequest|declarativeNetRequest|history|downloads|identity|bookmarks|topSites|debugger|scripting|management|webNavigation|tabCapture|desktopCapture)\b/],
  ["document.cookie", /document\.cookie/], ["eval / new Function", /\beval\s*\(|new Function\s*\(/],
  ["navigator.connection/geolocation/mediaDevices", /navigator\.(geolocation|mediaDevices|connection)\b/]
];
for (const [name, re] of FORBIDDEN) { const h = hits(js, re); t(`kaynakta yok: ${name}`, h.length === 0, h.join(", ")); }

// 2) Ağ çağrıları: her fetch çağrısı bilinen bir yerde ve bilinen bir adrese
const FETCH_SITES = {
  "lib/usage.js": [/fetchFn\(`\$\{BASE\}\/organizations`, \{ credentials: "include" \}\)/, /fetchFn\(`\$\{BASE\}\/organizations\/\$\{orgId\}\/usage`, \{ credentials: "include" \}\)/],
  "lib/conversation.js": [/fetchFn\(url, \{ credentials: "include" \}\)/],
  "lib/i18n.js": [/await fetch\(url\)\)\.json\(\)/]
};
const fetchCalls = hits(js, /\bfetch(Fn)?\s*\(/);
const expected = Object.values(FETCH_SITES).reduce((n, a) => n + a.length, 0);
t(`ağ çağrısı sayısı beklenen (${expected})`, fetchCalls.length === expected, fetchCalls.join(", "));
for (const [f, res] of Object.entries(FETCH_SITES)) for (const re of res) t(`ağ çağrısı yerinde: ${f} ${String(re).slice(1, 46)}…`, re.test(src[f]));
t("usage.js yalnızca https://claude.ai/api", /const BASE = "https:\/\/claude\.ai\/api";/.test(src["lib/usage.js"]));
t("conversation.js adresi https://claude.ai/api/… ile başlar", /const url = `https:\/\/claude\.ai\/api\/organizations\/\$\{orgId\}\/chat_conversations\/\$\{convId\}`/.test(src["lib/conversation.js"]));
t("i18n.js yalnızca eklentinin kendi dosyasını okur", /const url = chrome\.runtime\.getURL\(`_locales\//.test(src["lib/i18n.js"]));
// Kanca yalnızca sayfanın kendi isteğini aynen iletir (kendi isteğini üretmez)
t("hook.js kendi isteğini üretmez (yalnız apply ile iletir)", hits(["inject/hook.js"], /(origFetch|nativeFetch)\s*\(/).length === 0 && /origFetch\.apply\(window, args\)/.test(src["inject/hook.js"]));

// 3) Kaynaktaki her adres bilinen bir alan adında (http:// hiç yok)
const ALLOWED_HOSTS = new Set(["claude.ai", "github.com", "h-enes1.github.io", "platform.claude.com", "support.claude.com", "anthropic.com", "www.anthropic.com"]);
const urls = Object.entries(src).flatMap(([f, s]) => [...s.matchAll(/\bhttps?:\/\/[^\s"'`<>)\\]+/g)].map((m) => ({ f, u: m[0] })));
const badHost = urls.filter(({ u }) => { try { return !ALLOWED_HOSTS.has(new URL(u.replace(/\$\{.*$/, "").replace(/[;,.]+$/, "")).host); } catch (_) { return true; } });
t("bütün adresler bilinen alan adlarında", badHost.length === 0, badHost.slice(0, 5).map((x) => `${x.f}: ${x.u}`).join(" | "));
t("http:// (şifresiz) adres yok", urls.every(({ u }) => u.startsWith("https://")), urls.filter(({ u }) => !u.startsWith("https://")).map((x) => x.u).join(","));

// 4) HTML sayfaları: uzak kaynak, satır içi betik, olay özniteliği, form yok
for (const f of html) {
  const s = src[f];
  t(`${f}: uzak kaynak yok`, !/(src|href|action|poster|data)\s*=\s*["']?\s*(https?:)?\/\//i.test(s));
  t(`${f}: satır içi betik / olay özniteliği / çerçeve / form yok`, !/<script(?![^>]*\bsrc=)[^>]*>/i.test(s) && !/\son[a-z]+\s*=/i.test(s) && !/<(iframe|form|object|embed|base)\b/i.test(s) && !/\sstyle\s*=/i.test(s));
}

// 5) Manifest: izinler ve ağ sınırı
const mf = JSON.parse(src["manifest.json"]);
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
t("izinler: yalnızca storage, alarms, notifications", eq(mf.permissions, ["storage", "alarms", "notifications"]), mf.permissions.join(","));
t("site izni: yalnızca https://claude.ai/*", eq(mf.host_permissions, ["https://claude.ai/*"]), mf.host_permissions.join(","));
t("isteğe bağlı izin / dış bağlantı / arka plan sayfası yok", !mf.optional_permissions && !mf.optional_host_permissions && !mf.externally_connectable && !mf.sandbox && !mf.chrome_url_overrides);
t("içerik betikleri yalnızca claude.ai'de", mf.content_scripts.every((c) => eq(c.matches, ["https://claude.ai/*"]) && !c.all_frames && !c.match_about_blank));
t("sayfadan erişilebilir kaynaklar yalnızca claude.ai'ye açık", mf.web_accessible_resources.every((w) => eq(w.matches, ["https://claude.ai/*"])));
const csp = Object.fromEntries(String(mf.content_security_policy?.extension_pages || "").split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
t("CSP: eklenti sayfaları ve arka plan yalnızca claude.ai'ye bağlanabilir", eq(csp["connect-src"] || [], ["'self'", "https://claude.ai"]), (csp["connect-src"] || []).join(" "));
t("CSP: betik yalnızca paketten, uzak görsel/çerçeve/form yok", eq(csp["script-src"] || [], ["'self'"]) && eq(csp["default-src"] || [], ["'self'"]) && eq(csp["img-src"] || [], ["'self'", "data:", "blob:"]) && eq(csp["object-src"] || [], ["'none'"]) && eq(csp["form-action"] || [], ["'none'"]) && eq(csp["style-src"] || [], ["'self'"]));

// 6) Sayfa içi mesajlaşma: hedef her zaman sayfanın kendi kaynağı ("*" yok)
const pm = hits(js, /postMessage\s*\(/);
const pmBad = pm.filter((loc) => { const [f, n] = loc.split(":"); return !/location\.origin\)/.test(src[f].split(/\r?\n/)[n - 1]); });
t(`postMessage hedefi her yerde location.origin (${pm.length} çağrı)`, pm.length > 0 && pmBad.length === 0, pmBad.join(", "));
// Kanca istem metnini ve ek adlarını sayfaya yaymaz; onay gelene kadar okumaz
const hook = src["inject/hook.js"];
t("hook.js: istem metni ve ek adı postMessage'a konmuyor", !/prompt:\s*typeof j\.prompt/.test(hook) && !/file_name/.test(hook) && !/extracted_content/.test(hook));
t("hook.js: onay gelene kadar uykuda (enabled = false, sarmalayıcının ilk satırı)", /let enabled = false;/.test(hook) && /const wrapped = function \(url, input, init, args\) \{\s*if \(!enabled\) return origFetch\.apply\(window, args\);/.test(hook));

// 7) HTML basma noktaları: yalnızca bilinen dosyalarda, bilinen sayıda (yenisi eklenirse kaçış denetimini gözden geçir)
const sinks = hits(js, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
const sinkCount = sinks.reduce((m, loc) => { const f = loc.split(":")[0]; m[f] = (m[f] || 0) + 1; return m; }, {});
t("innerHTML yalnızca panel.js (3) ve content.js (1, sabit metin)", JSON.stringify(sinkCount) === JSON.stringify({ "content/content.js": 1, "lib/panel.js": 3 }), JSON.stringify(sinkCount));
// panel.js: şablon içindeki her ${…} ya esc(…) ile kaçışlanır ya da sayı/sabit üretir
const panel = src["lib/panel.js"];
const tplExprs = [...panel.slice(panel.indexOf("function updateBanner")).matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map((m) => m[1].trim());
const SAFE_EXPR = [/^esc\(/, /^bannerOpen( \? " open" : "")?$/, /^next\.tone$/, /^w\.sev$/, /^vm\.level$/ /* classList, HTML değil */, /^i$/, /^ICON\[w\.sev\] \|\| "i"$/, /^\(p\.share \* 100\)\.toFixed\(1\)$/, /^Math\.(min|max)\(/,
  /^(bar|bd)\(vm\.\w+\)$/, /^rows\(vm\.\w+\)$/, /\.map\(.*\)\.join\(""\)$/s, /^next\.sections\.map\(sec\)\.join\(""\)$/, /\? `[\s\S]*` : ""$/, /^x\.fix \? fix\(x\.fix\) : ""$/, /^next\.feedback\?\.done \?/];
const unsafe = tplExprs.filter((e) => !SAFE_EXPR.some((re) => re.test(e)));
t(`panel.js: şablonlardaki ${tplExprs.length} ifadenin hepsi kaçışlı ya da sabit`, tplExprs.length > 20 && unsafe.length === 0, unsafe.slice(0, 4).join(" || "));

// 8) Arka plana yalnızca eklentinin kendi bağlamları mesaj atabilir; dış sekme açılışları bilinen adreslere
t("background: gönderen kimliği denetleniyor", /if \(sender\.id !== chrome\.runtime\.id\) return false;/.test(src["background.js"]));
const tabs = hits(js, /chrome\.tabs\.create\s*\(/);
const tabsBad = tabs.filter((loc) => { const [f, n] = loc.split(":"); return !/getURL\(|\{ url:? ?(CONTRIB_URL)? ?\}|\{ url, index/.test(src[f].split(/\r?\n/)[n - 1]); });
t(`sekme açma yalnızca eklenti sayfaları ve katkı formu (${tabs.length} çağrı)`, tabsBad.length === 0, tabsBad.join(", "));

console.log(fail ? `\n${fail} BAŞARISIZ` : "\nTümü geçti");
process.exit(fail ? 1 : 0);
