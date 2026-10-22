// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Sayfa içi panel (adım 9). Shadow DOM içinde çizilir: claude.ai'nin stilleri panele,
// panelin stilleri claude.ai'ye sızmaz. Panel, mesaj kutusunun sağ üst köşesine yapışık
// küçük bir "hap" olarak durur; tıklanınca ayrıntı kartı açılır.

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
/* Renkler Claude'un kendi görünümüne yakın: krem/beyaz yüzey, sıcak gri çizgi, turuncu vurgu.
   Tema, claude.ai'nin açık/koyu durumundan okunur (data-theme), sistem temasından değil. */
.wrap, .banner {
  --fg:#141413; --muted:#6b6a64; --bg:#ffffff; --line:rgba(31,30,29,.14); --chip:#f0eee6; --chip-h:#e8e6dc;
  --ok:#2f7d57; --warn:#a8680f; --crit:#b9382a; --accent:#d97757; --accent-ink:#b5502f; --on-tone:#ffffff;
  --shadow:0 2px 12px rgba(20,20,19,.07); --shadow-lg:0 12px 36px rgba(20,20,19,.16);
  --serif: ui-serif, Georgia, "Times New Roman", serif;
  color: var(--fg);
}
:host([data-theme="dark"]) .wrap, :host([data-theme="dark"]) .banner {
  --fg:#faf9f5; --muted:#b0aea5; --bg:#30302e; --line:rgba(222,220,209,.16); --chip:#3d3d3a; --chip-h:#4a4946;
  --ok:#5fb98a; --warn:#e0a24a; --crit:#ef7d6d; --accent:#d97757; --accent-ink:#ee9b80; --on-tone:#1b1b19;
  --shadow:0 2px 12px rgba(0,0,0,.3); --shadow-lg:0 12px 36px rgba(0,0,0,.5);
}
.wrap { position: fixed; z-index: 2147483646; font: 12.5px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.pill { display:inline-flex; align-items:center; gap:7px; padding:5px 12px 5px 10px; border-radius:999px;
  background:var(--bg); border:1px solid var(--line); box-shadow:var(--shadow);
  cursor:pointer; user-select:none; white-space:nowrap; max-width:420px; transition:border-color .15s, background .15s; }
.pill:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
.pill:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.pill { touch-action:none; }
.wrap.dragging .pill { cursor:grabbing; box-shadow:var(--shadow-lg); border-color: color-mix(in srgb, var(--accent) 70%, var(--line)); }
.wrap.moved .pill::before { content:""; width:4px; height:12px; margin-right:-2px; border-left:2px dotted var(--muted); opacity:.55; }
.wrap.al .card { right:auto; left:0; }
/* claude.ai'nin kendi menüsü (model/effort seçici gibi) hapın üstüne açılınca hap geri çekilir */
.wrap.yield, .banner.yield { opacity:0 !important; pointer-events:none !important; transition:opacity .12s; }
.wrap.bl .card { bottom:auto; top:calc(100% + 8px); }
button.reset { all:unset; cursor:pointer; display:block; margin-top:8px; font-size:12px; color:var(--accent-ink); text-decoration:underline; text-underline-offset:2px; }
button.reset:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
.dot { width:8px; height:8px; border-radius:50%; background:var(--ok); flex:none; }
.lvl-warn .dot { background:var(--warn); } .lvl-crit .dot { background:var(--crit); }
.head { font-weight:600; }
.sub { color:var(--muted); overflow:hidden; text-overflow:ellipsis; }
.badge { min-width:16px; height:16px; padding:0 4px; border-radius:8px; background:var(--warn); color:var(--on-tone);
  font-size:10.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }
.lvl-crit .badge { background:var(--crit); }
.badge[hidden] { display:none; }
.card { position:absolute; right:0; bottom:calc(100% + 8px); width:344px; max-height:min(70vh,520px); overflow:auto;
  background:var(--bg); border:1px solid var(--line); border-radius:16px; box-shadow:var(--shadow-lg);
  padding:14px 16px; display:none; }
.open .card { display:block; animation: tfIn .14s ease-out; }
h3 { margin:0 0 4px; font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.01em; }
.big { font-family:var(--serif); font-size:24px; line-height:1.15; font-weight:500; letter-spacing:-.01em; }
.muted { color:var(--muted); }
.row { display:flex; justify-content:space-between; gap:12px; padding:3px 0; }
.row span:last-child { text-align:right; font-variant-numeric: tabular-nums; }
.sec { border-top:1px solid var(--line); margin-top:10px; padding-top:8px; }
.warn { display:flex; gap:8px; padding:7px 10px; border-radius:10px; background:var(--chip); margin-top:6px; }
.warn .ic { flex:none; font-weight:700; }
.warn.crit .ic { color:var(--crit); } .warn.warn .ic { color:var(--warn); } .warn.info .ic { color:var(--muted); }
.warn.tip .ic { color:var(--ok); }
.bar { height:8px; border-radius:4px; background:var(--chip); overflow:hidden; margin-top:8px; position:relative; }
.bar i { position:absolute; top:0; bottom:0; border-radius:4px; }
.bar .used { left:0; background:var(--muted); opacity:.4; }
.bar .est { background:var(--accent); }
.foot { margin-top:10px; font-size:11px; color:var(--muted); }
.warn .act { all:unset; cursor:pointer; margin-top:6px; display:inline-block; padding:4px 10px; border-radius:8px; background:var(--bg);
  border:1px solid var(--line); font-weight:600; font-size:12px; color:var(--fg); }
.warn .act:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
.warn .act:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
.bd { margin-top:10px; }
.bd .lbl { font-size:11px; font-weight:600; color:var(--muted); letter-spacing:.01em; }
.bdbar { display:flex; height:8px; border-radius:4px; overflow:hidden; margin-top:5px; background:var(--chip); gap:1px; }
.bdbar i { display:block; height:100%; }
.bd-output { background:var(--accent); } .bd-thinking { background: color-mix(in srgb, var(--accent) 55%, var(--bg)); }
.bd-input { background:var(--muted); } .bd-history { background:var(--warn); } .bd-tool { background:var(--ok); }
.bdleg { display:flex; flex-wrap:wrap; gap:4px 10px; margin-top:5px; font-size:11.5px; color:var(--muted); }
.bdleg span { display:inline-flex; align-items:center; gap:5px; }
.bdleg b { width:8px; height:8px; border-radius:2px; display:inline-block; }
button.more { all:unset; box-sizing:border-box; display:block; width:100%; text-align:center; margin-top:12px; padding:8px 10px;
  border-radius:10px; background:var(--chip); color:var(--fg); font-weight:600; cursor:pointer; transition:background .15s; }
button.more:hover { background:var(--chip-h); }
button.more:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
button.x { all:unset; cursor:pointer; color:var(--muted); float:right; font-size:16px; line-height:1; padding:2px 4px; border-radius:6px; }
button.x:hover { background:var(--chip); color:var(--fg); }
button.x:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }

/* Model önerisi bildirimi (mesaj kutusunun sol üstü) */
.banner { position: fixed; z-index: 2147483645; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --tone: var(--ok);
  background: var(--bg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: var(--shadow); padding: 7px 8px 7px 10px; display: none; max-width: 560px; }
@supports (background: color-mix(in srgb, red 10%, white)) {
  .banner { background: linear-gradient(color-mix(in srgb, var(--tone) 6%, transparent), color-mix(in srgb, var(--tone) 6%, transparent)), var(--bg);
    border-color: color-mix(in srgb, var(--tone) 30%, var(--line)); }
}
.banner.show { display: block; animation: tfIn .16s ease-out; }
.banner.t-save { --tone: var(--ok); } .banner.t-next { --tone: var(--accent); } .banner.t-up { --tone: var(--warn); } .banner.t-ok { --tone: var(--ok); }
.banner .line { display: flex; align-items: center; gap: 9px; }
.banner .ttl { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.banner.open .ttl { white-space: normal; }
.banner .ic { flex: none; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: var(--on-tone); background: var(--tone); }
.banner button { all: unset; cursor: pointer; color: var(--muted); font-size: 12px; padding: 3px 8px; border-radius: 8px; white-space: nowrap; transition: background .15s; }
.banner button:hover { background: var(--chip); color: var(--fg); }
.banner button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.banner .body { display: none; margin-top: 8px; padding: 0 2px 2px; max-height: min(55vh, 420px); overflow: auto; }
.banner.open .body { display: block; }
.banner .det { color: var(--fg); margin: 0 0 8px; }
.banner .sec2 { margin-top: 8px; }
.banner .lbl { font-size: 11px; font-weight: 650; color: var(--muted); letter-spacing: .02em; }
.banner .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
.banner .chip { background: var(--chip); border-radius: 8px; padding: 2px 8px; font-size: 12px; }
.banner .cav { margin-top: 10px; font-size: 11px; color: var(--muted); }
.banner .fb { display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.banner .fb .q { color: var(--muted); font-size: 12px; }
.banner .fb button { background: var(--chip); color: var(--fg); }
.banner .fb button:hover { background: var(--chip-h); }
.banner a { color: var(--accent-ink); }
.banner .fix { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.banner .fix select { font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 2px 6px; }
@keyframes tfIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .banner.show, .open .card { animation: none; } .pill, button.more, .banner button { transition: none; } }
`;

export function createPanel({ getAnchor, getAnchorTop, onMore, onBannerFeedback, onBannerHide, onBannerRelabel, initialOffset = null, onMoved = null }) {
  const host = document.createElement("div");
  host.setAttribute("data-token-forecast", "");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style>
    <div class="wrap" part="wrap">
      <div class="card" role="dialog" aria-modal="false"></div>
      <div class="pill" role="button" tabindex="0" aria-expanded="false">
        <span class="dot" aria-hidden="true"></span><span class="head"></span><span class="sub"></span><span class="badge" hidden></span>
      </div>
    </div>
    <div class="banner" role="status" aria-live="polite"></div>`;
  document.documentElement.append(host);
  const wrap = root.querySelector(".wrap");
  const pill = root.querySelector(".pill");
  const card = root.querySelector(".card");
  const banner = root.querySelector(".banner");
  let bvm = null, bannerOpen = false, bannerKey = "";
  let open = false, lastAnchorKey = "", vmCache = null;
  // Kullanıcının taşıdığı konum: varsayılan yere göre fark (px). null = varsayılan yer.
  let offset = initialOffset && Number.isFinite(initialOffset.dx) && Number.isFinite(initialOffset.dy) ? { dx: initialOffset.dx, dy: initialOffset.dy } : null;
  let defPos = { left: 0, top: 0 }, drag = null, suppressClick = false;
  if (offset) wrap.classList.add("moved");

  const toggle = (v = !open) => {
    open = v;
    wrap.classList.toggle("open", open);
    pill.setAttribute("aria-expanded", String(open));
  };
  pill.addEventListener("click", (e) => { e.stopPropagation(); if (suppressClick) { suppressClick = false; return; } toggle(); });
  pill.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    if (e.key === "Escape") toggle(false);
    // Alt + ok tuşları: hapı klavyeyle taşı
    const step = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
    if (step && e.altKey) { e.preventDefault(); setOffset({ dx: (offset?.dx || 0) + step[0], dy: (offset?.dy || 0) + step[1] }, true); }
  });

  // Sürükle-bırak: 5 px'ten fazla hareket sürükleme sayılır (altındaki tıklama kartı açar)
  const clampPos = (left, top) => {
    const w = wrap.offsetWidth || 160, h = pill.offsetHeight || 26;
    return { left: Math.max(4, Math.min(window.innerWidth - w - 4, left)), top: Math.max(4, Math.min(window.innerHeight - h - 4, top)) };
  };
  function setOffset(o, save) {
    offset = o && (Math.abs(o.dx) > 2 || Math.abs(o.dy) > 2) ? { dx: Math.round(o.dx), dy: Math.round(o.dy) } : null;
    wrap.classList.toggle("moved", !!offset);
    lastAnchorKey = ""; schedulePlace();
    if (save) onMoved?.(offset);
    if (vmCache) renderCard(vmCache);
  }
  pill.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // Konumun doğruluk kaynağı stil değerleridir (kutu ölçüsü içerik değişince oynayabilir)
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: parseFloat(wrap.style.left) || 0, top: parseFloat(wrap.style.top) || 0, moving: false };
  });
  pill.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) < 5) return;
    if (!drag.moving) { drag.moving = true; try { pill.setPointerCapture(e.pointerId); } catch (_) {} wrap.classList.add("dragging"); toggle(false); }
    const p = clampPos(drag.left + dx, drag.top + dy);
    wrap.style.left = `${p.left}px`; wrap.style.top = `${p.top}px`;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moving;
    drag = null;
    wrap.classList.remove("dragging");
    try { pill.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!moved) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 300);
    const at = { left: parseFloat(wrap.style.left) || 0, top: parseFloat(wrap.style.top) || 0 };
    const d = defaultPos() || defPos; // bırakıldığı andaki varsayılan yer (sayfa bu arada kaymış olabilir)
    setOffset({ dx: at.left - d.left, dy: at.top - d.top }, true);
  };
  pill.addEventListener("pointerup", endDrag);
  pill.addEventListener("pointercancel", endDrag);
  let actions = [];
  card.addEventListener("click", (e) => {
    const act = e.target.closest("button.act");
    if (act) {
      const a = actions[Number(act.dataset.act)];
      if (a?.copy) navigator.clipboard?.writeText(a.copy).then(() => { act.textContent = a.done || "✓"; }, () => {});
      e.stopPropagation(); return;
    }
    if (e.target.closest("button.x")) toggle(false);
    if (e.target.closest("button.reset")) { setOffset(null, true); e.stopPropagation(); return; }
    if (e.target.closest("button.more")) { onMore?.(); toggle(false); }
    e.stopPropagation();
  });
  document.addEventListener("click", () => open && toggle(false));

  // Konum: mesaj kutusunun sağ üst köşesi
  const anchorBox = () => {
    const a = getAnchor();
    if (!a) return null;
    const r = a.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    let aTop = r.top;
    try { const t = getAnchorTop?.(); if (Number.isFinite(t) && t < r.top) aTop = t; } catch (_) {}
    return { r, aTop };
  };
  const defaultPos = (box = anchorBox()) => {
    if (!box) return null;
    const w = wrap.offsetWidth || 160, h = pill.offsetHeight || 26;
    return { left: Math.max(8, Math.min(window.innerWidth - w - 8, box.r.right - w - 12)), top: Math.max(8, box.aTop - h - 6) };
  };
  let raf = 0;
  const place = () => {
    raf = 0;
    const box = vmCache ? anchorBox() : null;
    if (!box) { wrap.style.display = "none"; banner.style.display = "none"; return; }
    const { r, aTop } = box;
    banner.style.display = "";
    const key = `${r.left}|${r.right}|${aTop}|${bannerOpen}|${bannerKey}|${offset ? offset.dx + "," + offset.dy : ""}|${window.innerWidth}x${window.innerHeight}`;
    wrap.style.display = "";
    if (key === lastAnchorKey) return;
    lastAnchorKey = key;
    const w = wrap.offsetWidth || 160, h = pill.offsetHeight || 26;
    const { left, top } = defaultPos(box);
    defPos = { left, top };
    if (!drag?.moving) {
      // Taşınmışsa varsayılan yere göre aynı farkta durur (sayfa boyutu değişse de görünür kalır)
      const p = offset ? clampPos(left + offset.dx, top + offset.dy) : { left, top };
      wrap.style.left = `${p.left}px`;
      wrap.style.top = `${p.top}px`;
      // Kart ekrandan taşmasın: solda yer yoksa sola hizala, üstte yer yoksa aşağı aç
      wrap.classList.toggle("al", p.left + w - 344 < 8);
      wrap.classList.toggle("bl", p.top < Math.min(520, window.innerHeight * 0.7) + 16);
    }
    // Bildirim: hapla aynı satırda solda; yer yoksa hapın üstünde
    if (banner.classList.contains("show")) {
      const room = left - (r.left + 12) - 10;
      const sameRow = room >= 300;
      const bw = Math.min(560, sameRow ? room : r.width - 24);
      banner.style.width = `${Math.max(240, bw)}px`;
      banner.style.left = `${Math.max(8, r.left + 12)}px`;
      const bh = banner.offsetHeight || 32;
      const bottom = sameRow ? top + h : top - 6;
      banner.style.top = `${Math.max(8, bottom - bh)}px`;
    }
  };
  const schedulePlace = () => { if (!raf) raf = requestAnimationFrame(place); };
  window.addEventListener("resize", schedulePlace, { passive: true });
  window.addEventListener("scroll", schedulePlace, { passive: true, capture: true });
  // Tema: claude.ai'nin kendi açık/koyu durumu (sistem temasından farklı olabilir)
  const lum = (css) => {
    const m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(css || "");
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.1)) return null;
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
  };
  const detectDark = () => {
    try {
      const de = document.documentElement;
      const hint = `${de.dataset.mode || ""} ${de.dataset.theme || ""} ${de.className || ""}`.toLowerCase();
      if (/\bdark\b/.test(hint)) return true;
      if (/\blight\b/.test(hint)) return false;
      for (const el of [document.body, de]) {
        const l = lum(getComputedStyle(el).backgroundColor);
        if (l !== null) return l < 0.45;
      }
    } catch (_) {}
    return !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  };
  const applyTheme = () => {
    const t = detectDark() ? "dark" : "light";
    if (host.dataset.theme !== t) { host.dataset.theme = t; lastAnchorKey = ""; }
  };
  applyTheme();
  // claude.ai menüsü açıkken (model/effort seçici, açılır listeler) hapla çakışıyorsa hap görünmez olur
  const MENU_SEL = '[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-radix-menu-content], [role="dialog"]';
  const hits = (q, r) => q.width > 0 && q.height > 0 && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top;
  const checkYield = () => {
    let y = false;
    try {
      const rw = wrap.getBoundingClientRect(), rb = banner.classList.contains("show") ? banner.getBoundingClientRect() : null;
      for (const el of document.querySelectorAll(MENU_SEL)) {
        if (el.closest?.("[data-token-forecast]")) continue;
        const q = el.getBoundingClientRect();
        if (hits(q, rw) || (rb && hits(q, rb))) { y = true; break; }
      }
    } catch (_) {}
    wrap.classList.toggle("yield", y);
    banner.classList.toggle("yield", y);
    if (y && open) toggle(false);
  };
  const soon = () => { setTimeout(checkYield, 40); setTimeout(checkYield, 220); };
  document.addEventListener("pointerdown", soon, true);
  document.addEventListener("keydown", soon, true);
  const mo = new MutationObserver(soon);
  try { mo.observe(document.body, { childList: true }); } catch (_) {}
  const timer = setInterval(() => { applyTheme(); schedulePlace(); checkYield(); }, 500);

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICON = { crit: "!", warn: "!", info: "i", tip: "✓" };

  banner.addEventListener("click", (e) => {
    e.stopPropagation();
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.act === "why") { bannerOpen = !bannerOpen; banner.classList.toggle("open", bannerOpen); b.setAttribute("aria-expanded", String(bannerOpen)); }
    else if (b.dataset.act === "hide") { onBannerHide?.(bvm); banner.classList.remove("show", "open"); bannerOpen = false; }
    else if (b.dataset.act === "good" || b.dataset.act === "bad") {
      onBannerFeedback?.(bvm, b.dataset.act === "good");
      const fb = banner.querySelector(".fb"); if (fb) fb.textContent = bvm?.fbThanks || "✓";
    }
    lastAnchorKey = ""; schedulePlace();
  });
  banner.addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-act=relabel]");
    if (!sel || !sel.value) return;
    onBannerRelabel?.(bvm, sel.value);
    const box = sel.closest(".fix"); if (box) box.textContent = bvm?.fix?.thanks || "✓";
  });

  // bvm: { key, tone: "save"|"next"|"up"|"ok", icon, title, detail, sections:[{label, text?, chips?}], caveat, source, feedback:{q,good,bad}|null, whyLabel, hideLabel, fbThanks }
  function updateBanner(next) {
    if (!next) { bvm = null; banner.classList.remove("show", "open"); bannerOpen = false; bannerKey = ""; lastAnchorKey = ""; schedulePlace(); return; }
    const changedTask = !bvm || bvm.key !== next.key;
    bvm = next;
    if (changedTask) { bannerOpen = false; banner.classList.remove("open"); }
    const fix = (f) => f?.done ? `<div class="fix">${esc(f.thanks || "✓")}</div>` : f ? `<div class="fix"><span>${esc(f.label)}</span><select data-act="relabel" aria-label="${esc(f.label)}"><option value=""></option>${f.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>` : "";
    const sec = (x) => `<div class="sec2"><div class="lbl">${esc(x.label)}</div>${x.text ? `<div>${esc(x.text)}</div>` : ""}${x.chips ? `<div class="chips">${x.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>` : ""}${x.fix ? fix(x.fix) : ""}</div>`;
    banner.className = `banner show t-${next.tone}${bannerOpen ? " open" : ""}`;
    banner.innerHTML = `
      <div class="line"><span class="ic" aria-hidden="true">${esc(next.icon)}</span><span class="ttl">${esc(next.title)}</span>
        <button type="button" data-act="why" aria-expanded="${bannerOpen}">${esc(next.whyLabel)}</button>
        <button type="button" data-act="hide" aria-label="${esc(next.hideLabel)}" title="${esc(next.hideLabel)}">×</button></div>
      <div class="body">
        ${next.detail ? `<p class="det">${esc(next.detail)}</p>` : ""}
        ${next.sections.map(sec).join("")}
        ${next.feedback?.done ? `<div class="fb">${esc(next.fbThanks || "✓")}</div>` : next.feedback ? `<div class="fb"><span class="q">${esc(next.feedback.q)}</span><button type="button" data-act="good">${esc(next.feedback.good)}</button><button type="button" data-act="bad">${esc(next.feedback.bad)}</button></div>` : ""}
        <div class="cav">${esc(next.caveat)} <a href="https://platform.claude.com/docs/en/about-claude/models/choosing-a-model" target="_blank" rel="noopener noreferrer">${esc(next.source)}</a></div>
      </div>`;
    bannerKey = next.key + "|" + next.title;
    lastAnchorKey = "";
    schedulePlace();
  }

  function update(vm) {
    vmCache = vm;
    if (!vm) { wrap.style.display = "none"; banner.style.display = "none"; return; }
    banner.style.display = "";
    wrap.classList.remove("lvl-ok", "lvl-warn", "lvl-crit");
    wrap.classList.add(`lvl-${vm.level}`);
    root.querySelector(".head").textContent = vm.head;
    root.querySelector(".sub").textContent = vm.sub;
    const badge = root.querySelector(".badge");
    const n = vm.warnings.filter((w) => w.sev === "crit" || w.sev === "warn").length;
    badge.hidden = n === 0;
    badge.textContent = String(n);
    pill.title = [vm.title, vm.dragTitle].filter(Boolean).join(" · ");
    renderCard(vm);
    lastAnchorKey = "";
    schedulePlace();
  }

  function renderCard(vm) {
    const rows = (list) => list.map(([k, v]) => `<div class="row"><span class="muted">${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
    const bd = (x) => x && x.parts?.length ? `<div class="bd"><div class="lbl">${esc(x.label)}</div>
      <div class="bdbar" aria-hidden="true">${x.parts.map((p) => `<i class="bd-${esc(p.key)}" style="width:${(p.share * 100).toFixed(1)}%"></i>`).join("")}</div>
      <div class="bdleg">${x.parts.map((p) => `<span><b class="bd-${esc(p.key)}"></b>${esc(p.label)} ${esc(p.pctText)}</span>`).join("")}</div></div>` : "";
    actions = vm.warnings.map((w) => w.action || null);
    const bar = (b) => b ? `<div class="bar" aria-hidden="true"><i class="used" style="width:${Math.min(100, b.used)}%"></i><i class="est" style="left:${Math.min(100, b.used)}%;width:${Math.max(0.8, Math.min(100 - b.used, b.est))}%"></i></div>` : "";
    card.innerHTML = `
      <button class="x" aria-label="${esc(vm.closeLabel)}">×</button>
      <h3>${esc(vm.cardTitle)}</h3>
      <div class="big">${esc(vm.big)}</div>
      <div class="muted">${esc(vm.bigSub)}</div>
      ${bar(vm.bar)}
      ${bd(vm.breakdown)}
      ${vm.warnings.map((w, i) => `<div class="warn ${w.sev}"><span class="ic">${ICON[w.sev] || "i"}</span><span>${esc(w.text)}${w.action ? `<br><button class="act" type="button" data-act="${i}">${esc(w.action.label)}</button>` : ""}</span></div>`).join("")}
      <div class="sec">${rows(vm.rows)}</div>
      ${vm.detail?.length ? `<div class="sec">${rows(vm.detail)}</div>` : ""}
      <button class="more" type="button">${esc(vm.moreLabel)}</button>
      <div class="foot">${esc(vm.foot)}</div>
      ${offset && vm.resetLabel ? `<button class="reset" type="button">${esc(vm.resetLabel)}</button>` : ""}`;
  }

  return {
    update,
    updateBanner,
    destroy() { clearInterval(timer); mo.disconnect(); document.removeEventListener("pointerdown", soon, true); document.removeEventListener("keydown", soon, true); host.remove(); },
    isOpen: () => open,
    getOffset: () => offset,
    setOffset: (o) => setOffset(o, false),
    host
  };
}
