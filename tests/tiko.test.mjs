// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Tiko'nun durum makinesi (lib/tiko-state.js) ve çizim katmanının (lib/tiko.js) kurallara uyduğu.
import { readFileSync } from "node:fs";
import { TIKO, initial, reduce, view, deadline } from "../extension/lib/tiko-state.js";
let fail = 0, n = 0;
const t = (name, cond, info = "") => { n++; console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };

// Yardımcılar: olayları sırayla uygula; rastlantı sabit
const never = () => 0.99, always = () => 0;
const run = (s, evs, rand = never) => evs.reduce((a, e) => reduce(a, e, rand), s);
const T0 = 1_000_000;
const on = (at = T0) => run(initial(at), [{ type: "enable", on: true, at }, { type: "composer", on: true, at }]);
const tick = (at) => ({ type: "tick", at });

// --- Görünürlük ---
t("başlangıç: kapalı ve görünmez", initial(T0).mode === "off" && !view(initial(T0)).visible);
t("açık ama mesaj kutusu yok → gizli", run(initial(T0), [{ type: "enable", on: true, at: T0 }]).mode === "hidden");
t("açık + mesaj kutusu → boşta, mesaj kutusunda", on().mode === "idle" && view(on()).place === "home" && view(on()).pose === "stand");
t("mesaj kutusu kaybolursa (claude.ai değişti) gizlenir", !view(run(on(), [{ type: "composer", on: false, at: T0 + 10 }])).visible);
t("kapatılınca kaybolur, her durumdan", ["type", "send", "click"].every((e) => run(on(), [{ type: e, at: T0 + 1 }, { type: "enable", on: false, at: T0 + 2 }]).mode === "off"));
t("gizliyken olaylar görünür yapmaz", ["type", "send", "click", "activity", "tick"].every((e) => !view(run(initial(T0), [{ type: "enable", on: true, at: T0 }, { type: e, at: T0 + 5 }])).visible));

// --- Yazma ---
let s = run(on(), [{ type: "type", at: T0 + 100 }]);
t("yazınca: imleci takip eder, süzülür", s.mode === "typing" && view(s).place === "caret" && view(s).pose === "hover");
t("yazarken son tarih = son tuş + bekleme", deadline(s) === T0 + 100 + TIKO.TYPE_IDLE_MS);
s = run(s, [{ type: "type", at: T0 + 900 }, tick(T0 + 100 + TIKO.TYPE_IDLE_MS)]);
t("yazmaya devam edince durmaz", s.mode === "typing");
s = run(s, [tick(T0 + 900 + TIKO.TYPE_IDLE_MS)]);
t("yazma durunca: boşta, olduğu yerde, etrafa bakınır", s.mode === "idle" && view(s).pose === "stand" && view(s).face === "neutral");

// --- Tahmin ağır / hafif model önerisi ---
const typed = (sig) => run(on(), [{ type: "type", at: T0 + 100 }, { type: "signals", ...sig, at: T0 + 400 }]);
s = typed({ heavy: true });
t("ağır tahmin: yazarken ifade değişmez", view(s).face === "neutral");
s = run(s, [tick(T0 + 100 + TIKO.TYPE_IDLE_MS)]);
t("ağır tahmin: yazma durunca zorlanan ifade", view(s).face === "strain" && view(s).pose === "stand");
s = run(s, [{ type: "signals", heavy: false, at: T0 + 3000 }]);
t("tahmin hafifleyince ifade normale döner", view(s).face === "neutral");
s = run(typed({ light: true }), [tick(T0 + 100 + TIKO.TYPE_IDLE_MS)]);
t("hafif model önerildi: yazma durunca onaylar (baş sallar)", view(s).pose === "nod" && view(s).face === "happy");
s = run(s, [tick(T0 + 100 + TIKO.TYPE_IDLE_MS + TIKO.APPROVE_MS)]);
t("onay bir kez yapılır, sonra boşta", view(s).pose === "stand" && s.approved);
s = run(s, [{ type: "signals", light: true, at: T0 + 9000 }, { type: "type", at: T0 + 9100 }, tick(T0 + 9100 + TIKO.TYPE_IDLE_MS)]);
t("aynı öneri sürerken tekrar onaylamaz", view(s).pose === "stand");
s = run(s, [{ type: "signals", light: false, at: T0 + 12000 }, { type: "signals", light: true, at: T0 + 12100 }]);
t("öneri gidip gelince yeniden onaylar", view(s).pose === "nod");
s = run(s, [{ type: "send", at: T0 + 20000 }, { type: "signals", light: false, at: T0 + 20300 }, tick(T0 + 20000 + TIKO.SEND_MS), { type: "type", at: T0 + 30000 }, { type: "signals", light: true, at: T0 + 30300 }, tick(T0 + 30000 + TIKO.TYPE_IDLE_MS)]);
t("gönderimden sonraki mesajda öneri yine çıkarsa yeniden onaylar", view(s).pose === "nod");

// --- Gönder → cevap → bitiş ---
s = run(on(), [{ type: "type", at: T0 + 100 }, { type: "send", at: T0 + 500 }]);
t("gönder: uçar, olduğu yerden", s.mode === "send" && view(s).pose === "fly" && view(s).place === "stay");
s = run(s, [{ type: "stream", on: true, at: T0 + 700 }]);
t("uçuş bitmeden cevap başlarsa uçuş yarıda kesilmez", s.mode === "send");
s = run(s, [tick(T0 + 500 + TIKO.SEND_MS)]);
t("cevap yazılırken: cevabın üstünde oturur, okur", s.mode === "perch" && view(s).place === "perch" && view(s).pose === "sit" && view(s).face === "read");
t("otururken süreli geçiş yok (zamanlayıcı kurulmaz)", deadline(s) === null);
let done = run(s, [{ type: "stream", on: false, at: T0 + 9000 }], always);
t("cevap bitince alkışlar (olduğu yerde)", done.mode === "cheer" && view(done).pose === "clap" && view(done).place === "stay");
t("ya da gerinir", view(run(s, [{ type: "stream", on: false, at: T0 + 9000 }], never)).pose === "stretch");
done = run(done, [tick(T0 + 9000 + TIKO.CHEER_MS)]);
t("sonra mesaj kutusuna döner", done.mode === "idle" && view(done).place === "home");
s = run(on(), [{ type: "send", at: T0 + 500 }, tick(T0 + 500 + TIKO.SEND_MS)]);
t("cevap henüz başlamadıysa mesaj kutusunda bekler", s.mode === "idle");
s = run(s, [{ type: "stream", on: true, at: T0 + 3000 }]);
t("cevap sonradan başlayınca üstüne çıkar", s.mode === "perch");
s = run(s, [{ type: "type", at: T0 + 4000 }]);
t("cevap yazılırken kullanıcı yazarsa imlece döner", s.mode === "typing" && view(s).place === "caret");
s = run(s, [tick(T0 + 4000 + TIKO.TYPE_IDLE_MS)]);
t("yazma durunca, cevap sürüyorsa yine cevabın üstüne", s.mode === "perch");
s = run(on(), [{ type: "type", at: T0 + 100 }, { type: "stream", on: true, at: T0 + 200 }, { type: "stream", on: false, at: T0 + 300 }]);
t("yazarken biten cevap yazmayı bölmez", s.mode === "typing");

// --- Uyku ---
s = on();
t("boşta son tarih: dans yoklaması ya da uyku", deadline(s) === Math.min(T0 + TIKO.DANCE_EVERY_MS, T0 + TIKO.SLEEP_MS));
s = run(s, [tick(T0 + TIKO.SLEEP_MS - 1)]);
t("2 dakikadan önce uyumaz", s.mode === "idle");
s = run(s, [tick(T0 + TIKO.SLEEP_MS)]);
t("2 dk hareketsizlik: uyur (zzz), gözler kapalı", s.mode === "sleep" && view(s).pose === "sleep" && view(s).face === "closed");
t("uyurken zamanlayıcı kurulmaz", deadline(s) === null);
let w = run(s, [{ type: "activity", at: T0 + 200000 }]);
t("bir hareketle uyanır, esner (sürpriz 4)", w.mode === "wake" && view(w).pose === "yawn");
w = run(w, [tick(T0 + 200000 + TIKO.WAKE_MS)]);
t("esneme bitince boşta", w.mode === "idle");
t("yazmak da uyandırır", run(s, [{ type: "type", at: T0 + 200000 }]).mode === "typing");
t("cevap başlaması uyandırır", run(s, [{ type: "stream", on: true, at: T0 + 200000 }]).mode === "perch");
s = run(on(), [{ type: "activity", at: T0 + 100000 }, tick(T0 + TIKO.SLEEP_MS + 50)]);
t("hareket uykuyu erteler", s.mode === "idle");
s = run(on(), [{ type: "stream", on: true, at: T0 + 10 }, tick(T0 + 3 * TIKO.SLEEP_MS)]);
t("cevap yazılırken uyumaz", s.mode === "perch");

// --- Haftalık limit ---
s = run(on(), [{ type: "signals", weeklyPct: 79.9, at: T0 + 1 }]);
t("haftalık %79,9: normal", view(s).face === "neutral" && !view(s).worried);
s = run(s, [{ type: "signals", weeklyPct: 80, at: T0 + 2 }]);
t("haftalık %80: endişeli", view(s).face === "worry" && view(s).worried);
t("endişe yazarken ve cevabın üstünde de sürer", view(run(s, [{ type: "type", at: T0 + 3 }])).face === "worry" && view(run(s, [{ type: "stream", on: true, at: T0 + 3 }])).face === "worry");
s = run(s, [{ type: "signals", weeklyPct: 85, heavy: true, at: T0 + 4 }]);
t("ağır tahmin endişenin önüne geçer (boştayken)", view(s).face === "strain");
t("uyurken endişe görünmez", view(run(on(), [{ type: "signals", weeklyPct: 95, at: T0 + 1 }, tick(T0 + TIKO.SLEEP_MS + 1)])).face === "closed");
t("geçersiz yüzde hata vermez", view(run(on(), [{ type: "signals", weeklyPct: NaN, at: T0 + 1 }])).face === "neutral");

// --- Tıklama, sürükleme, park ---
s = run(on(), [{ type: "click", at: T0 + 10 }]);
t("tıklanınca el sallar", view(s).pose === "wave" && view(s).face === "happy");
t("tepki bitince normale döner", view(run(s, [tick(T0 + 10 + TIKO.REACT_MS)])).pose === "stand");
s = run(on(), [1, 2, 3, 4, 5].map((i) => ({ type: "click", at: T0 + i * 200 })));
t("5 hızlı tıklama: başı döner (sürpriz 2)", view(s).pose === "dizzy" && view(s).face === "dizzy");
t("yavaş 5 tıklama baş döndürmez", view(run(on(), [1, 2, 3, 4, 5].map((i) => ({ type: "click", at: T0 + i * 1500 })))).pose === "wave");
s = run(on(), [{ type: "drag", phase: "start", at: T0 + 10 }]);
t("sürüklenirken yer işaretçiden gelir", view(s).place === "drag");
s = run(s, [{ type: "drag", phase: "end", park: true, at: T0 + 500 }]);
t("bırakılınca park eder", s.parked && view(s).place === "park");
t("parktayken yazı, gönder ve cevap yeri değiştirmez", [[{ type: "type", at: T0 + 600 }], [{ type: "send", at: T0 + 600 }], [{ type: "stream", on: true, at: T0 + 600 }]].every((e) => view(run(s, e)).place === "park"));
t("parktayken ifade yine değişir", view(run(s, [{ type: "stream", on: true, at: T0 + 600 }])).pose === "sit");
t("park kaldırılınca eve döner", view(run(s, [{ type: "park", on: false, at: T0 + 700 }])).place === "home");
t("eve yakın bırakılırsa park sayılmaz", !run(on(), [{ type: "drag", phase: "start", at: T0 + 10 }, { type: "drag", phase: "end", park: false, at: T0 + 500 }]).parked);
t("sürüklerken uyumaz", run(on(), [{ type: "drag", phase: "start", at: T0 + 10 }, tick(T0 + 2 * TIKO.SLEEP_MS)]).mode === "idle");

// --- Nadir sürprizler ---
s = run(on(), [tick(T0 + TIKO.DANCE_EVERY_MS)], always);
t("boşta dans (sürpriz 1): zar tutarsa", view(s).pose === "dance");
s = run(on(), [tick(T0 + TIKO.DANCE_EVERY_MS)], never);
t("zar tutmazsa dans yok, sonraki yoklama ileride", view(s).pose === "stand" && deadline(s) > T0 + TIKO.DANCE_EVERY_MS);
s = run(on(), [{ type: "stream", on: true, at: T0 + 10 }, { type: "stream", on: false, at: T0 + 10 + TIKO.LONG_STREAM_MS }]);
t("uzun cevap bitince 'oh be' (sürpriz 3)", view(s).pose === "phew" && view(s).face === "relief");
let dances = 0;
{ let x = on(), seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 1; i <= 2000; i++) { x = reduce(x, { type: "activity", at: T0 + i * TIKO.DANCE_EVERY_MS - 1 }, rnd); x = reduce(x, tick(T0 + i * TIKO.DANCE_EVERY_MS), rnd); if (x.act?.name === "dance") dances++; x = reduce(x, tick(T0 + i * TIKO.DANCE_EVERY_MS + TIKO.DANCE_MS), rnd); } }
t("dans nadir: 2000 yoklamada beklenen oran civarı", dances > 2000 * TIKO.DANCE_P * 0.6 && dances < 2000 * TIKO.DANCE_P * 1.4, `${dances}/2000`);

// --- Hareket azaltma ---
s = run(on(), [{ type: "reduced", on: true, at: T0 + 1 }]);
t("reduced-motion: kıpırdamayan ikon, mesaj kutusunda", view(s).pose === "still" && view(s).place === "home");
t("reduced-motion: yazarken, gönderirken ve cevapta yerinden oynamaz", [[{ type: "type", at: T0 + 5 }], [{ type: "send", at: T0 + 5 }], [{ type: "stream", on: true, at: T0 + 5 }], [{ type: "click", at: T0 + 5 }]].every((e) => { const v = view(run(s, e)); return v.pose === "still" && v.place === "home"; }));
t("reduced-motion: dans yoklaması kurulmaz", deadline(s) === T0 + TIKO.SLEEP_MS && run(s, [tick(T0 + TIKO.DANCE_EVERY_MS)], always).act === null);
t("reduced-motion: ifade yine bilgi verir (endişe, uyku)", view(run(s, [{ type: "signals", weeklyPct: 90, at: T0 + 2 }])).face === "worry" && view(run(s, [tick(T0 + TIKO.SLEEP_MS + 1)])).face === "closed");

// --- Sağlamlık ---
t("bilinmeyen / bozuk olay hata atmaz", (() => { try { let x = on(); for (const e of [null, undefined, {}, { type: "???" }, { type: "tick" }, { type: "signals" }, { type: "drag" }, 5, "x"]) x = reduce(x, e); return x.mode === "idle"; } catch (_) { return false; } })());
t("reduce durumu değiştirmez (saf)", (() => { const a = on(); const snap = JSON.stringify(a); reduce(a, { type: "click", at: T0 + 1 }); reduce(a, { type: "send", at: T0 + 2 }); return JSON.stringify(a) === snap; })());
{ // Son tarihe gelince durum hep ilerler: zamanlayıcı sonsuz döngüye giremez
  let x = on(), ok = true, seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const evs = ["type", "send", "click", "activity"];
  for (let i = 0; i < 4000 && ok; i++) {
    const d = deadline(x);
    if (d === null || rnd() < 0.3) { const e = rnd() < 0.2 ? { type: "stream", on: rnd() < 0.5 } : rnd() < 0.2 ? { type: "signals", heavy: rnd() < 0.5, light: rnd() < 0.5, weeklyPct: 100 * rnd() } : { type: evs[Math.floor(rnd() * evs.length)] }; x = reduce(x, { ...e, at: x.now + Math.floor(rnd() * 3000) }, rnd); continue; }
    const y = reduce(x, tick(Math.max(d, x.now)), rnd);
    const d2 = deadline(y);
    if (d2 !== null && d2 <= y.now) ok = false;
    x = y;
  }
  t("son tarih hep gelecekte kalır (4000 rastgele adım)", ok);
}

// --- Çizim katmanı kuralları (kaynak denetimi) ---
const src = readFileSync(new URL("../extension/lib/tiko.js", import.meta.url), "utf8");
const state = readFileSync(new URL("../extension/lib/tiko-state.js", import.meta.url), "utf8");
const code = src.replace(/\/\/.*$/gm, "");
const reads = code.match(/\binnerText\b|\bnodeValue\b|\.value\b|\.data\b|\btoString\s*\(|\bwholeText\b|\bouterHTML\b|\btextContent\b(?!\s*=)|\binnerHTML\b(?!\s*=)/g) || [];
t("tiko.js metin OKUMAZ (innerText, textContent, value, toString… yok)", reads.length === 0, reads.join(","));
t("tiko-state.js DOM'a dokunmaz", !/\b(document|window|chrome|requestAnimationFrame|setTimeout)\b/.test(state.replace(/\/\/.*$/gm, "")));
t("tiko.js ağ ve depo kullanmaz, yeni izin gerektirmez", !/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|chrome\.|localStorage|sessionStorage|navigator\.)/.test(code));
t("Shadow DOM, kapsayıcı pointer-events:none, yalnız gövde tıklanabilir", /attachShadow/.test(code) && /^\.mv \{.*pointer-events: none/m.test(code) && /^\.hit \{.*pointer-events: auto/m.test(code) && /^\.bub \{[\s\S]{0,400}?pointer-events: none/m.test(code) && (code.match(/pointer-events: auto/g) || []).length === 1);
t("setInterval yok; kare yalnızca istenince", !/setInterval/.test(code) && /if \(moving\)/.test(code));
t("sekme gizliyken kare ve zamanlayıcı kurulmaz", /document\.hidden/.test(code) && /animation-play-state: paused/.test(code));
t("hareket azaltma: animasyon ve geçiş kapalı", /\.rm, \.rm \*[^{]*\{ animation: none !important; transition: none !important; \}/.test(code));
t("sitedeki Tiko ile aynı çizim (kafa, gövde, renkler)", (() => {
  const site = readFileSync(new URL("../site/build/index.src.html", import.meta.url), "utf8");
  const grab = (text, name) => (text.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`)) || [])[1]?.replace(/\s+/g, "") || null;
  const pal = (text) => (text.match(/K: "#3b2415", O: "#f28c28", H: "#ffc98b", D: "#c9661a", W: "#ffffff", P: "#ff8f70", Y: "#ffd84a", G: "#6fcf8a", R: "#e0533a"/) || [])[0];
  return ["HEAD", "BODY", "LEG_A", "LEG_B"].every((k) => grab(site, k) && grab(site, k) === grab(src, k)) && !!pal(site) && !!pal(src);
})());
const en = JSON.parse(readFileSync(new URL("../extension/_locales/en/messages.json", import.meta.url), "utf8"));
const tr = JSON.parse(readFileSync(new URL("../extension/_locales/tr/messages.json", import.meta.url), "utf8"));
t("Tiko metinleri TR/EN", ["setTiko", "tikoHint", "tikoTitle"].every((k) => tr[k]?.message && en[k]?.message));
t("sürpriz sayısı en fazla 4", (state.match(/^\s*\/\/\s+\d\)/gm) || []).length <= 4);

console.log(fail ? `${fail} Tiko testi başarısız` : `tüm Tiko testleri geçti (${n})`);
process.exitCode = fail ? 1 : 0;
