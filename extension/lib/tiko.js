// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Tiko: mesaj kutusunun yanında yaşayan minik maskot (28 px). Çizim, sitedeki piksel Tiko'nun aynısıdır
// (site/build/index.src.html); burada yalnızca yüz ifadeleri ve pozlar eklenir.
// Ne yaptığına lib/tiko-state.js karar verir; bu dosya çizer ve hareket ettirir.
//
// Kurallar (hepsi testlerde denetlenir):
// - Metin okunmaz. Bu dosya sayfadan yalnızca kutu koordinatı alır: imleç (seçim aralığının kutusu),
//   mesaj kutusu, hap/bildirim, cevabın üst kenarı. Öğelerin içeriğine bakan hiçbir çağrı yoktur.
// - Shadow DOM; her şey pointer-events:none, yalnızca Tiko'nun gövdesi tıklanabilir.
// - requestAnimationFrame yalnızca Tiko yer değiştirirken (ve bir olaydan sonra tek seferlik ölçüm için) çalışır.
//   Duruşlar CSS animasyonudur. Her karede önce okuma (ölçüm), sonra tek bir transform yazımı yapılır.
// - Sekme gizliyken hiçbir şey çalışmaz. prefers-reduced-motion açıkken kıpırdamayan küçük bir ikondur.
// - Sayfa yapısı beklenmedik biçimde değişirse sessizce gizlenir; hata fırlatmaz.

import { initial, reduce, view, deadline } from "./tiko-state.js";

const PAL = { K: "#3b2415", O: "#f28c28", H: "#ffc98b", D: "#c9661a", W: "#ffffff", P: "#ff8f70", Y: "#ffd84a", G: "#6fcf8a", R: "#e0533a", B: "#7cc4f0" };
const rects = (rows, x0 = 0, y0 = 0) => {
  let o = "";
  rows.forEach((row, y) => { let x = 0; while (x < row.length) { const c = row[x]; if (c === "." || c === " ") { x++; continue; } let e = x; while (e < row.length && row[e] === c) e++; o += `<rect x="${x0 + x}" y="${y0 + y}" width="${e - x}" height="1" fill="${PAL[c]}"/>`; x = e; } });
  return o;
};
const dots = (c, ...pts) => pts.map(([x, y, w = 1, h = 1]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAL[c]}"/>`).join("");

// Sitedeki Tiko ile aynı ızgara (14 × 17)
const HEAD = [
  "..KKKKKKKKKK..",
  ".KOOOOOOOOOOK.",
  ".KOHHOOOOOOOK.",
  ".KOOOOOOOOOOK.",
  ".KOOOOOOOOOOK.",
  ".KPOKOOOOKOPK.",
  ".KOOOKKKKOOOK.",
  ".KOOOOOOOOOOK.",
  "..KKKKKKKKKK.."];          // satır 2..10
const BODY = [
  "...KOOOOOOK...",
  "...KOGGYROK...",
  "...KOOOOOOK...",
  "...KKKKKKKK..."];           // satır 11..14
const ARM_L = ["KO", "KO", "KO", "KK"], ARM_R = ["OK", "OK", "OK", "KK"];
const LEG_A = ["....KO..OK....", "...KKK..KKK..."];
const LEG_B = ["...KKK..OK....", ".......KKK...."];
// Otururken sallanan ayaklar (iki kare)
const SIT_L = ["...KO..OK.....", "..KKK..KKK...."];
const SIT_R = [".....KO..OK...", "....KKK..KKK.."];
const MAIL = ["KKKKKKKK", "KKWWWWKK", "KWKWWKWK", "KWWKKWWK", "KKKKKKKK"];
const EYES_OFF = dots("O", [2, 5, 4, 2], [8, 5, 4, 2]);

const SVG = `<svg viewBox="0 0 14 17" aria-hidden="true" focusable="false">
  <g class="lgA">${rects(LEG_A, 0, 15)}</g><g class="lgB">${rects(LEG_B, 0, 15)}</g><g class="lgL">${rects(SIT_L, 0, 15)}</g><g class="lgR">${rects(SIT_R, 0, 15)}</g>
  <g class="body">
    ${rects(BODY, 0, 11)}
    <g class="head">
      ${rects(HEAD, 0, 2)}
      <g class="lt">${rects(["YY"], 6, 0)}</g>${rects(["KK"], 6, 1)}
      <g class="pupil">${dots("K", [3, 5, 2, 2], [9, 5, 2, 2])}${dots("W", [3, 5], [9, 5])}</g>
      <g class="lid">${EYES_OFF}${dots("K", [3, 6, 2, 1], [9, 6, 2, 1])}</g>
      <g class="happy">${EYES_OFF}${dots("K", [3, 6], [4, 5], [5, 6], [8, 6], [9, 5], [10, 6])}</g>
      <g class="dz dzA">${EYES_OFF}${dots("K", [3, 5], [4, 6], [9, 5], [10, 6])}</g>
      <g class="dz dzB">${EYES_OFF}${dots("K", [4, 5], [3, 6], [10, 5], [9, 6])}</g>
      <g class="brW">${dots("K", [3, 4], [4, 3], [10, 4], [9, 3])}</g>
      <g class="brS">${dots("K", [3, 3], [4, 4], [10, 3], [9, 4])}</g>
      <g class="mFlat">${dots("O", [4, 7], [9, 7])}${dots("K", [4, 8, 6, 1])}</g>
      <g class="mFrown">${dots("O", [4, 7], [9, 7])}${dots("K", [4, 9], [9, 9])}</g>
      <g class="sweat">${dots("B", [13, 3, 1, 2])}</g>
    </g>
    <g class="armL">${rects(ARM_L, 1, 11)}</g><g class="armR">${rects(ARM_R, 11, 11)}</g>
    <g class="mail">${rects(MAIL, 3, -7)}</g>
  </g></svg>`;

const W = 28, H = 34;             // ızgara × 2 px
const SPRING_K = 170, SPRING_C = 24; // yay: hafifçe geç kalır, taşmadan oturur (sönüm oranı ≈ 0,92)
const TOP_SAFE = 52;              // claude.ai'nin üst çubuğunun altında kalmasın
const FAR = 600;                  // bundan uzağa yürümez, orada belirir
const EDGE = 12;                  // mesaj kutusunun yan kenarlarından pay
const MENU_SEL = '[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-radix-menu-content], [role="dialog"]';

const CSS = `
:host { all: initial; }
.mv { position: fixed; left: 0; top: 0; width: ${W}px; height: ${H}px; z-index: 2147483644; pointer-events: none; will-change: transform; transition: opacity .16s linear; }
.mv.gone { opacity: 0; visibility: hidden; transition: opacity .16s linear, visibility 0s .16s; }
.tk { position: absolute; inset: 0; transform-origin: 50% 100%; --lx: 0; --ly: 0; }
.sh { position: absolute; left: 4px; right: 4px; bottom: -2px; height: 4px; border-radius: 50%; background: rgba(0,0,0,.18); }
.sp { position: absolute; inset: 0; transform-origin: 50% 100%; }
svg { position: absolute; inset: 0; width: 100%; height: 100%; shape-rendering: crispEdges; overflow: visible; transform-origin: 50% 100%; pointer-events: none; }
/* Yalnızca gövde tıklanabilir */
.hit { position: absolute; left: 2px; right: 2px; top: 4px; bottom: 0; pointer-events: auto; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.dragging .hit { cursor: grabbing; }
.zz { display: none; position: absolute; right: -8px; top: -7px; font: 700 9px/1 ui-monospace, Consolas, monospace; color: #8a8478; }
.lgB, .lgL, .lgR, .happy, .dz, .brW, .brS, .mFlat, .mFrown, .sweat, .mail { display: none; }

/* Her zaman: hafif soluma, anten ışığı, göz kırpma (sitedeki Tiko ile aynı) */
.body { animation: bob 1.1s steps(1) infinite; }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(.5px); } }
.lt { animation: lt 1.6s steps(1) infinite; }
@keyframes lt { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
.pupil { transform: translate(calc(var(--lx) * 1px), calc(var(--ly) * 1px)); transition: transform .12s steps(2); }
.lid { opacity: 0; animation: blink 4.2s steps(1) infinite; }
@keyframes blink { 0%, 93%, 100% { opacity: 0; } 94%, 97% { opacity: 1; } }
@keyframes fa { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes fb { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
@keyframes hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }

/* Boşta: etrafa bakınır */
.p-stand .pupil { animation: look 9s steps(1) infinite; }
@keyframes look { 0%, 18%, 46%, 74%, 100% { transform: translate(0, 0); } 20%, 34% { transform: translate(-1px, 0); } 48%, 60% { transform: translate(1px, 0); } 76%, 84% { transform: translate(0, -1px); } }
/* Yazarken: süzülür */
.p-hover .sp { animation: hov 1.5s ease-in-out infinite; }
@keyframes hov { 0%, 100% { transform: translateY(-1px); } 50% { transform: translateY(-4px); } }
.p-hover .sh { animation: hovs 1.5s ease-in-out infinite; }
@keyframes hovs { 0%, 100% { transform: scaleX(1); opacity: 1; } 50% { transform: scaleX(.7); opacity: .55; } }
.p-hover .lt { animation-duration: .5s; }
/* Cevabın üstünde: oturur, ayak sallar, arada başını eğip okur */
.p-sit .lgA, .p-sit .sh { display: none; }
.p-sit .lgL { display: inline; animation: fa 1s steps(1) infinite; }
.p-sit .lgR { display: inline; animation: fb 1s steps(1) infinite; }
.p-sit .head { animation: dip 5.4s steps(1) infinite; }
@keyframes dip { 0%, 64%, 100% { transform: translateY(0); } 66%, 90% { transform: translateY(1px); } }
.f-read .pupil { animation: read 2.4s steps(1) infinite; }
@keyframes read { 0% { transform: translate(-1px, 1px); } 34% { transform: translate(0, 1px); } 67% { transform: translate(1px, 1px); } }
.up .pupil { animation: none; transform: translate(0, -1px); }
/* Gönder: mesajı (zarfı) kaldırıp yukarı uçar */
.p-fly .sp { animation: fly .85s cubic-bezier(.45, 0, .85, .45) forwards; }
@keyframes fly { 0% { transform: translateY(0) scale(1, 1); opacity: 1; } 16% { transform: translateY(1px) scale(1.16, .8); opacity: 1; } 38% { transform: translateY(-12px) scale(.9, 1.16); opacity: 1; } 100% { transform: translateY(-84px) scale(.9, 1.16); opacity: 0; } }
.p-fly .sh { opacity: 0; }
.p-fly .mail { display: inline; }
.p-fly .armL, .p-dance .armL { transform: translate(-1px, -4px); }
.p-fly .armR, .p-dance .armR, .p-nod .armR { transform: translate(1px, -4px); }
/* Cevap bitti: alkış / gerinme / "oh be" */
.p-clap .armL { animation: cl .24s steps(1) infinite; }
.p-clap .armR { animation: cr .24s steps(1) infinite; }
@keyframes cl { 0%, 100% { transform: translate(-1px, -4px); } 50% { transform: translate(1px, -4px); } }
@keyframes cr { 0%, 100% { transform: translate(1px, -4px); } 50% { transform: translate(-1px, -4px); } }
.p-clap .sp { animation: hop .45s ease-out infinite; }
.p-stretch .sp, .p-yawn .sp { animation: str 1.3s ease-in-out both; }
@keyframes str { 0%, 100% { transform: scale(1, 1); } 30%, 65% { transform: scale(.9, 1.16); } }
.p-stretch .armL, .p-yawn .armL { animation: sal 1.3s steps(1) both; }
.p-stretch .armR, .p-yawn .armR { animation: sar 1.3s steps(1) both; }
@keyframes sal { 0%, 100% { transform: none; } 20%, 75% { transform: translate(-1px, -4px); } }
@keyframes sar { 0%, 100% { transform: none; } 20%, 75% { transform: translate(1px, -4px); } }
.p-phew .armR { animation: wipe .6s steps(1) 3; }
@keyframes wipe { 0%, 100% { transform: translate(0, -5px); } 50% { transform: translate(-1px, -6px); } }
.p-phew .sweat { display: inline; animation: fling .6s steps(3) 3; }
@keyframes fling { 0% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(2px, -2px); opacity: 0; } }
/* Tepkiler */
.p-wave .armR { animation: wv .36s steps(1) 3; }
@keyframes wv { 0%, 100% { transform: translate(1px, -4px); } 50% { transform: translate(1px, -2px); } }
.p-wave .sp { animation: hop .36s ease-out 1; }
.p-nod .head { animation: nod .5s steps(1) 3; }
@keyframes nod { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1px); } }
.p-dizzy .sp { animation: sway .7s ease-in-out infinite; }
@keyframes sway { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
.p-dance svg { animation: flip .6s steps(1) 3; }
@keyframes flip { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(-1); } }
.p-dance .sp { animation: hop .3s ease-out 6; }
.p-dance .lt { animation-duration: .2s; }
/* Uyku */
.m-sleep .zz { display: block; }
.p-sleep .zz { animation: zz 2.4s steps(4) infinite; }
@keyframes zz { 0% { transform: translate(0, 0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(5px, -10px); opacity: 0; } }
.p-sleep .body { animation: bob 3s steps(1) infinite; }
.p-sleep .lt { animation: none; opacity: .25; }

/* Yüzler */
.f-closed .lid, .f-strain .lid, .f-relief .lid { animation: none; opacity: 1; }
.f-happy .happy { display: inline; }
.f-dizzy .dz { display: inline; }
.f-dizzy .dzA { animation: fa .3s steps(1) infinite; }
.f-dizzy .dzB { animation: fb .3s steps(1) infinite; }
.f-strain .brS, .f-strain .mFlat, .f-strain .sweat { display: inline; }
.f-strain .sp { animation: shk .16s steps(2) infinite; }
@keyframes shk { 0%, 100% { transform: translateX(-.5px); } 50% { transform: translateX(.5px); } }
.f-strain .sweat { animation: drip 1.2s steps(4) infinite; }
.f-worry .brW, .f-worry .mFrown, .f-worry .sweat { display: inline; }
.f-worry .sweat { animation: drip 2s steps(4) infinite; }
@keyframes drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(4px); opacity: 0; } }

/* Baloncuk: tıklanamaz, sayfanın önüne geçmez */
.bub { position: absolute; bottom: calc(100% + 9px); left: 50%; transform: translateX(-50%); width: max-content; max-width: 230px; background: ${PAL.K}; color: #fff6ea;
  font: 500 11.5px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 6px 9px; border-radius: 8px; opacity: 0; transition: opacity .15s; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.2), 0 0 0 1px rgba(255,255,255,.14); }
.bub::after { content: ""; position: absolute; left: 50%; bottom: -4px; width: 8px; height: 8px; margin-left: -4px; background: ${PAL.K}; transform: rotate(45deg); }
.say .bub { opacity: 1; }
.bl .bub { left: -6px; transform: none; } .bl .bub::after { left: 20px; }
.br .bub { left: auto; right: -6px; transform: none; } .br .bub::after { left: auto; right: 12px; }

/* Sekme gizli: animasyonlar durur */
.pz, .pz * { animation-play-state: paused !important; }
/* Hareket azaltma: kıpırdamayan küçük ikon */
.rm { transform: scale(.75); }
.rm, .rm *, .rmv, .rmv .bub { animation: none !important; transition: none !important; }
@media print { .mv { display: none; } }
`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hits = (a, b, m = 0) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;

// İmlecin ekrandaki yeri. Yalnızca koordinat: seçim aralığının kutusu okunur, içeriği değil.
function caretPoint(input) {
  const sel = document.getSelection?.();
  if (!sel || !sel.rangeCount) return null;
  const rg = sel.getRangeAt(0), node = rg.endContainer;
  if (!node || !input.contains(node)) return null;
  const r = rg.getBoundingClientRect();
  if (r && (r.width || r.height || r.top || r.left)) return { left: r.right, top: r.top };
  // Boş satırda aralığın kutusu sıfır gelir: imlecin durduğu öğenin kutusu kullanılır
  const el = node.nodeType === 1 ? node : node.parentElement;
  const er = el?.getBoundingClientRect();
  return er && (er.width || er.height) ? { left: er.left, top: er.top } : null;
}

// opt: getInput, getComposer, getComposerTop (öğe / sayı döndürür), getObstacles (hap ve bildirim kutuları),
//      getAvoid (son kullanıcı mesajının kutusu), park ({rx, ry} | null), hintSeen, onPark, onHintShown, texts {hint, title}
export function createTiko(opt = {}) {
  const { getInput, getComposer, getComposerTop, getObstacles, getAvoid, onPark, onHintShown } = opt;
  const host = document.createElement("div");
  host.setAttribute("data-token-forecast-tiko", "");
  host.setAttribute("aria-hidden", "true"); // süs: gösterdiği her şey hapta ve popup'ta metin olarak var
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style><div class="mv gone"><div class="tk"><div class="sh"></div><div class="sp">${SVG}</div><span class="zz">z</span><div class="hit"></div></div><div class="bub"></div></div>`;
  const mv = root.querySelector(".mv"), tk = root.querySelector(".tk"), hit = root.querySelector(".hit"), bub = root.querySelector(".bub");
  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  let st = initial(Date.now()), vw = view(st), vkey = "";
  let texts = { ...(opt.texts || {}) }, status = "";
  let parkPos = opt.park && Number.isFinite(opt.park.rx) && Number.isFinite(opt.park.ry) ? { rx: opt.park.rx, ry: opt.park.ry } : null;
  let hintSeen = opt.hintSeen !== false;
  let dead = false, gone = true, placed = false, upFlag = false, lookKey = "0,0";
  let pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, tgt = null, homeTgt = null, lastX = null;
  let raf = 0, lastT = 0, running = false, needMeasure = false, needMenus = true, menuHit = false, snapNext = false, popNext = false;
  let timer = 0, menuT = 0, sayT = 0, sayKind = "", replyEl = null, drag = null, suppressClick = false, lastNote = 0;
  const stats = { frames: 0, ms: 0 };

  // Beklenmedik her hata: sessizce kaldır (claude.ai'yi asla bozma)
  const guard = (fn) => (...a) => { if (dead) return; try { fn(...a); } catch (_) { destroy(); } };

  function setGone(g) {
    if (g === gone) return;
    gone = g; mv.classList.toggle("gone", g); host.dataset.hidden = g ? "1" : "0";
  }
  function setLook(lx, ly) {
    const k = `${lx},${ly}`;
    if (k === lookKey) return;
    lookKey = k; tk.style.setProperty("--lx", lx); tk.style.setProperty("--ly", ly);
  }
  function write() { mv.style.transform = `translate3d(${Math.round(pos.x * 10) / 10}px,${Math.round(pos.y * 10) / 10}px,0)`; }

  function arm() {
    clearTimeout(timer); timer = 0;
    if (dead || document.hidden) return;
    const d = deadline(st);
    if (d !== null) timer = setTimeout(guard(() => push({ type: "tick" })), Math.max(20, d - Date.now()) + 4);
  }

  function apply() {
    const v = view(st);
    const key = `${v.visible}|${v.mode}|${v.pose}|${v.face}|${v.place}|${st.reduced}`;
    if (key !== vkey) {
      if (vw.pose === "fly" && v.pose !== "fly") { snapNext = true; popNext = true; } // uçup gitti: yeni yerinde belirir
      vkey = key; vw = v;
      tk.className = `tk m-${v.mode} p-${v.pose} f-${v.face}${st.reduced ? " rm" : ""}${upFlag ? " up" : ""}`;
      mv.classList.toggle("rmv", st.reduced);
      host.dataset.state = v.mode; host.dataset.pose = v.pose; host.dataset.face = v.face; host.dataset.place = v.place;
      if (!v.visible) { setGone(true); placed = false; mv.classList.remove("say"); }
      needMeasure = true;
    }
    arm();
    if (v.visible && needMeasure) kick();
  }
  function push(...evs) {
    const at = Date.now();
    for (const ev of evs) st = reduce(st, { ...ev, at });
    apply();
  }

  function say(text, ms, kind = "status") {
    if (!text) return;
    sayKind = kind;
    bub.textContent = text;
    mv.classList.toggle("bl", pos.x < 110);
    mv.classList.toggle("br", pos.x > window.innerWidth - 140);
    mv.classList.add("say");
    clearTimeout(sayT); sayT = setTimeout(() => mv.classList.remove("say"), ms);
  }

  // ---- Ölçüm (yalnızca okuma) → hedef ----
  function measure() {
    if (!vw.visible || vw.place === "drag") return;
    const input = getInput?.();
    const ir = input && input.isConnected ? input.getBoundingClientRect() : null;
    if (!ir || !ir.width || !ir.height) { push({ type: "composer", on: false }); return; } // mesaj kutusu yok: gizlen
    if (vw.place === "stay" && placed) return;
    const comp = getComposer?.() || input;
    const cr = comp === input ? ir : comp.getBoundingClientRect();
    let aTop = cr.top;
    const t = getComposerTop?.();
    if (Number.isFinite(t) && t < aTop) aTop = t;
    const obs = [...(getObstacles?.() || [])];
    if (aTop < cr.top - 4) obs.push({ left: cr.left, right: cr.right, top: aTop, bottom: cr.top }); // claude.ai'nin kutu üstündeki uyarısı
    const vwid = window.innerWidth, vh = window.innerHeight;
    let place = vw.place, x = 0, top = 0, up = false;

    if (place === "park" && parkPos) {
      x = parkPos.rx * (vwid - W); top = parkPos.ry * (vh - H);
    } else {
      if (place === "perch") {
        // Cevabın üst kenarı: önce sol uç, olmazsa sağ uç. Kullanıcı mesajını ya da hapı örtecekse oturmaz.
        const rr = replyEl && replyEl.isConnected ? replyEl.getBoundingClientRect() : null;
        let ok = false;
        if (rr && rr.width > 0 && rr.top - H >= TOP_SAFE && rr.top <= aTop - 6) {
          const ar = getAvoid?.() || null;
          for (const cx of [rr.left + 4, rr.right - W - 4]) {
            const box = { left: cx, right: cx + W, top: rr.top - H, bottom: rr.top }; // ayakları kenarda: cevabın yazısına taşmaz
            if ((ar && hits(box, ar, 2)) || obs.some((o) => hits(box, o, 2))) continue;
            x = cx; top = box.top; ok = true; break;
          }
        }
        if (!ok) { place = "home"; up = true; } // üst kenar ekranda değil: mesaj kutusunun üstünde oturur, yukarı bakar
      }
      if (place !== "perch") {
        const c = place === "caret" ? caretPoint(input) : null;
        if (c) lastX = c.left;
        const cx = st.reduced ? cr.left + 22 + W / 2 : lastX ?? cr.left + 22 + W / 2; // hareket azaltma: hep aynı yer
        x = clamp(cx - W / 2, cr.left + EDGE, Math.max(cr.left + EDGE, cr.right - W - EDGE)); // yuvarlak köşelerden taşmasın
        // İmlecin biraz üstü; yazının üstüne inmez. Kutunun içinde yazıdan önce başka bir şey varsa (ekler) kutunun üstüne çıkar.
        let b = ir.top - cr.top > 30 ? aTop - 3 : Math.min(ir.top - 1, c ? c.top - 5 : Infinity);
        for (let pass = 0; pass < 3; pass++) for (const o of obs) if (hits({ left: x, right: x + W, top: b - H, bottom: b }, o, 2)) b = o.top - 3; // hapın/bildirimin üstüne çık
        top = b - H;
        homeTgt = { x, y: top };
      }
    }
    x = clamp(x, 4, Math.max(4, vwid - W - 4));
    if (place === "park") top = clamp(top, 4, Math.max(4, vh - H - 4));
    const box = { left: x, right: x + W, top, bottom: top + H };
    // claude.ai'nin kendi menüsü (model seçici, açılır liste) Tiko'nun üstüne açıldıysa geri çekil
    if (needMenus) {
      needMenus = false; menuHit = false;
      for (const m of document.querySelectorAll(MENU_SEL)) {
        if (hits(m.getBoundingClientRect(), box)) { menuHit = true; break; }
      }
    }
    // ---- buradan sonrası yazma ----
    if (up !== upFlag) { upFlag = up; tk.classList.toggle("up", up); }
    setGone(top < 4 || menuHit);
    tgt = { x, y: top };
    const dist = Math.hypot(tgt.x - pos.x, tgt.y - pos.y);
    if (!placed || snapNext || st.reduced || dist > FAR) {
      const pop = placed && (popNext || dist > FAR) && !st.reduced;
      pos = { ...tgt }; vel = { x: 0, y: 0 }; placed = true; write();
      if (pop) tk.animate([{ transform: "scale(.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 170, easing: "ease-out" });
    }
    snapNext = false; popNext = false;
    if (place === "caret") setLook(tgt.x - pos.x > 5 ? 1 : tgt.x - pos.x < -5 ? -1 : 0, 1); // yazılan yere bakar
    else setLook(0, 0);
    if (!hintSeen && !gone && texts.hint) { hintSeen = true; say(texts.hint, 9000, "hint"); onHintShown?.(); }
  }

  // ---- Yay ----
  function step(t) {
    if (!tgt || !placed || !vw.visible) return false;
    const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
    if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 && Math.abs(vel.x) < 6 && Math.abs(vel.y) < 6) {
      if (dx || dy) { pos = { ...tgt }; write(); }
      vel = { x: 0, y: 0 };
      return false;
    }
    const dt = Math.min(0.034, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    vel.x += (SPRING_K * dx - SPRING_C * vel.x) * dt; vel.y += (SPRING_K * dy - SPRING_C * vel.y) * dt;
    pos.x += vel.x * dt; pos.y += vel.y * dt;
    write();
    return true;
  }
  function frame(t) {
    raf = 0;
    if (dead || document.hidden) return;
    const t0 = performance.now();
    if (needMeasure) { needMeasure = false; measure(); }
    const moving = step(t);
    stats.frames++; stats.ms += performance.now() - t0;
    if (moving) {
      if (!running) { running = true; host.dataset.raf = "1"; }
      raf = requestAnimationFrame(loop);
    } else {
      lastT = 0;
      if (vw.place === "caret") setLook(0, 1);
      // Tanı ve test için: hareket bitince bir kez yazılır (kare başına değil)
      running = false; host.dataset.raf = "0"; host.dataset.frames = String(stats.frames); host.dataset.us = String(Math.round((1000 * stats.ms) / Math.max(1, stats.frames)));
    }
  }
  const loop = guard(frame);
  function kick() { if (!raf && !dead && !document.hidden) raf = requestAnimationFrame(loop); }
  const remeasure = () => { if (vw.visible) { needMeasure = true; kick(); } };

  // ---- Sayfa olayları (hepsi pasif; yalnızca işaret koyar, işi kare yapar) ----
  const onInput = guard((e) => {
    const input = getInput?.();
    if (!input || !input.contains(e.target)) return;
    if (sayKind === "status") mv.classList.remove("say"); // yazı değişti: söylediği tahmin eskidi
    push({ type: "type" });
    needMeasure = true; kick(); menusSoon();
  });
  const onSelection = guard(() => { if (st.mode === "typing") remeasure(); });
  const onScroll = guard(() => { if (!vw.visible) return; if (vw.place === "perch" || vw.place === "park") snapNext = true; remeasure(); });
  const onResize = guard(() => { snapNext = true; remeasure(); });
  function menusSoon() {
    if (menuT || !vw.visible) return;
    menuT = setTimeout(guard(() => { menuT = 0; needMenus = true; remeasure(); }), 140);
  }
  // Kullanıcı hareketi: uykuyu erteler / uyandırır. Durum en çok 5 saniyede bir güncellenir.
  const note = guard(() => {
    const at = Date.now();
    if (st.mode !== "sleep" && at - lastNote < 5000) return;
    lastNote = at;
    if (vw.visible) push({ type: "activity" });
  });
  const onDown = guard(() => { note(); menusSoon(); });
  const onVis = guard(() => {
    if (document.hidden) {
      // Sekme gizli: kare, zamanlayıcı ve animasyon yok
      cancelAnimationFrame(raf); raf = 0; running = false; lastT = 0; host.dataset.raf = "0";
      clearTimeout(timer); timer = 0; clearTimeout(menuT); menuT = 0; clearTimeout(sayT);
      mv.classList.remove("say"); mv.classList.add("pz");
    } else {
      mv.classList.remove("pz");
      needMenus = true; needMeasure = true;
      push({ type: "tick" });
    }
  });
  const onMq = guard(() => { snapNext = true; push({ type: "reduced", on: !!mq.matches }); });

  // ---- Tiko'nun gövdesi: tıkla (tepki), sürükle (park et), çift tıkla (eve dön) ----
  hit.addEventListener("mousedown", (e) => e.preventDefault()); // mesaj kutusundaki odak ve imleç yerinde kalsın
  hit.addEventListener("pointerdown", guard((e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moving: false };
    // İşaretçi hemen yakalanır: hızlı çekişte fare gövdenin dışına çıksa da sürükleme başlar ve bırakma kaçmaz
    try { hit.setPointerCapture(e.pointerId); } catch (_) {}
  }));
  hit.addEventListener("pointermove", guard((e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (e.pointerType === "mouse" && !(e.buttons & 1)) { endDrag(e); return; } // bırakma olayı kaçtıysa
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) < 4) return;
    if (!drag.moving) {
      drag.moving = true;
      mv.classList.add("dragging"); mv.classList.remove("say");
      push({ type: "drag", phase: "start" });
    }
    pos = { x: clamp(drag.px + dx, 4, window.innerWidth - W - 4), y: clamp(drag.py + dy, 4, window.innerHeight - H - 4) };
    tgt = { ...pos }; vel = { x: 0, y: 0 };
    write();
  }));
  const endDrag = guard((e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moving;
    drag = null;
    try { hit.releasePointerCapture(e.pointerId); } catch (_) {}
    mv.classList.remove("dragging");
    if (!moved) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 300);
    // Mesaj kutusundaki yerine yakın bırakılırsa park sayılmaz, evine döner
    const near = !!homeTgt && Math.hypot(pos.x - homeTgt.x, pos.y - homeTgt.y) < 36;
    parkPos = near ? null : { rx: pos.x / Math.max(1, window.innerWidth - W), ry: pos.y / Math.max(1, window.innerHeight - H) };
    onPark?.(parkPos);
    push({ type: "drag", phase: "end", park: !near });
  });
  hit.addEventListener("pointerup", endDrag);
  hit.addEventListener("pointercancel", endDrag);
  hit.addEventListener("lostpointercapture", endDrag);
  hit.addEventListener("click", guard((e) => {
    e.stopPropagation();
    if (suppressClick) { suppressClick = false; return; }
    push({ type: "click" });
    if (status) say(status, 3600); else mv.classList.remove("say");
  }));
  hit.addEventListener("dblclick", guard((e) => {
    e.stopPropagation();
    if (!st.parked) return;
    parkPos = null; onPark?.(null);
    push({ type: "park", on: false });
  }));

  const off = [];
  const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); off.push(() => target.removeEventListener(type, fn, o)); };
  on(document, "input", onInput, { capture: true, passive: true });
  on(document, "selectionchange", onSelection, { passive: true });
  on(window, "scroll", onScroll, { capture: true, passive: true });
  on(window, "resize", onResize, { passive: true });
  on(document, "keydown", onDown, { capture: true, passive: true });
  on(document, "pointerdown", onDown, { capture: true, passive: true });
  on(document, "pointermove", note, { capture: true, passive: true });
  on(document, "visibilitychange", onVis);
  if (mq) { mq.addEventListener("change", onMq); off.push(() => mq.removeEventListener("change", onMq)); }

  function destroy() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(menuT); clearTimeout(sayT);
    for (const f of off) { try { f(); } catch (_) {} }
    try { host.remove(); } catch (_) {}
  }

  function setTexts(tx) { texts = { ...texts, ...(tx || {}) }; if (texts.title && hit.title !== texts.title) hit.title = texts.title; }

  (document.documentElement || document.body).append(host);
  setTexts(texts);
  if (document.hidden) mv.classList.add("pz");
  guard(() => push({ type: "reduced", on: !!mq?.matches }, { type: "park", on: !!parkPos }, { type: "enable", on: true }))();

  return {
    host,
    // sig: { composer, heavy, light, weeklyPct, status } — content.js'in zaten hesapladığı sinyaller
    sync: guard((sig = {}) => {
      status = sig.status || "";
      needMeasure = true; // hap ya da bildirim yer değiştirmiş olabilir
      push({ type: "composer", on: !!sig.composer }, { type: "signals", heavy: sig.heavy, light: sig.light, weeklyPct: sig.weeklyPct });
    }),
    send: guard(() => { lastX = null; push({ type: "send" }); }),
    // Cevap yazılıyor mu ve hangi öğe (yalnızca kutusu okunur)
    stream: guard((streaming, el) => {
      replyEl = el || replyEl;
      if (!!streaming !== st.streamOn) push({ type: "stream", on: !!streaming });
      else if (streaming && vw.place === "perch") { snapNext = true; remeasure(); } // cevap uzadıkça kenar kayar
    }),
    setTexts: guard(setTexts),
    setPark: guard((p) => {
      parkPos = p && Number.isFinite(p.rx) && Number.isFinite(p.ry) ? { rx: p.rx, ry: p.ry } : null;
      snapNext = true; needMeasure = true;
      push({ type: "park", on: !!parkPos });
    }),
    setHintSeen: (v) => { hintSeen = !!v; },
    destroy,
    get dead() { return dead; }
  };
}
