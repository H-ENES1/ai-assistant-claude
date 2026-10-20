// Sayfa içi panel (adım 9). Shadow DOM içinde çizilir: claude.ai'nin stilleri panele,
// panelin stilleri claude.ai'ye sızmaz. Panel, mesaj kutusunun sağ üst köşesine yapışık
// küçük bir "hap" olarak durur; tıklanınca ayrıntı kartı açılır.

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.wrap { position: fixed; z-index: 2147483646; font: 12.5px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--fg); --fg:#1f1e1b; --muted:#6b675f; --bg:#ffffff; --line:#e6e2da; --chip:#f4f1ea;
  --ok:#2e8b57; --warn:#b7791f; --crit:#c2412d; --accent:#c96442; }
@media (prefers-color-scheme: dark) {
  .wrap { --fg:#ecebe8; --muted:#a7a39b; --bg:#262624; --line:#3a3936; --chip:#30302d; }
}
.pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px 4px 8px; border-radius:999px;
  background:var(--bg); border:1px solid var(--line); box-shadow:0 1px 3px rgba(0,0,0,.08);
  cursor:pointer; user-select:none; white-space:nowrap; max-width:420px; }
.pill:hover { border-color: var(--muted); }
.pill:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.dot { width:8px; height:8px; border-radius:50%; background:var(--ok); flex:none; }
.lvl-warn .dot { background:var(--warn); } .lvl-crit .dot { background:var(--crit); }
.head { font-weight:600; }
.sub { color:var(--muted); overflow:hidden; text-overflow:ellipsis; }
.badge { min-width:16px; height:16px; padding:0 4px; border-radius:8px; background:var(--warn); color:#fff;
  font-size:10.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }
.lvl-crit .badge { background:var(--crit); }
.badge[hidden] { display:none; }
.card { position:absolute; right:0; bottom:calc(100% + 8px); width:340px; max-height:min(70vh,520px); overflow:auto;
  background:var(--bg); border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,.18);
  padding:12px 14px; display:none; }
.open .card { display:block; }
h3 { margin:0 0 2px; font-size:13px; }
.big { font-size:20px; font-weight:650; letter-spacing:-.01em; }
.muted { color:var(--muted); }
.row { display:flex; justify-content:space-between; gap:12px; padding:3px 0; }
.row span:last-child { text-align:right; font-variant-numeric: tabular-nums; }
.sec { border-top:1px solid var(--line); margin-top:10px; padding-top:8px; }
.warn { display:flex; gap:8px; padding:6px 8px; border-radius:8px; background:var(--chip); margin-top:6px; }
.warn .ic { flex:none; font-weight:700; }
.warn.crit .ic { color:var(--crit); } .warn.warn .ic { color:var(--warn); } .warn.info .ic { color:var(--muted); }
.warn.tip .ic { color:var(--ok); }
.bar { height:6px; border-radius:3px; background:var(--chip); overflow:hidden; margin-top:4px; position:relative; }
.bar i { position:absolute; top:0; bottom:0; border-radius:3px; }
.bar .used { left:0; background:var(--muted); opacity:.45; }
.bar .est { background:var(--accent); }
.foot { margin-top:8px; font-size:11px; color:var(--muted); }
button.more { all:unset; box-sizing:border-box; display:block; width:100%; text-align:center; margin-top:10px; padding:7px 10px;
  border-radius:8px; background:var(--chip); color:var(--fg); font-weight:600; cursor:pointer; }
button.more:hover { filter:brightness(0.97); }
button.more:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
button.x { all:unset; cursor:pointer; color:var(--muted); float:right; font-size:15px; line-height:1; padding:0 2px; }
`;

export function createPanel({ getAnchor, onMore }) {
  const host = document.createElement("div");
  host.setAttribute("data-token-forecast", "");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style>
    <div class="wrap" part="wrap">
      <div class="card" role="dialog" aria-modal="false"></div>
      <div class="pill" role="button" tabindex="0" aria-expanded="false">
        <span class="dot" aria-hidden="true"></span><span class="head"></span><span class="sub"></span><span class="badge" hidden></span>
      </div>
    </div>`;
  document.documentElement.append(host);
  const wrap = root.querySelector(".wrap");
  const pill = root.querySelector(".pill");
  const card = root.querySelector(".card");
  let open = false, lastAnchorKey = "", vmCache = null;

  const toggle = (v = !open) => {
    open = v;
    wrap.classList.toggle("open", open);
    pill.setAttribute("aria-expanded", String(open));
  };
  pill.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  pill.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } if (e.key === "Escape") toggle(false); });
  card.addEventListener("click", (e) => {
    if (e.target.closest("button.x")) toggle(false);
    if (e.target.closest("button.more")) { onMore?.(); toggle(false); }
    e.stopPropagation();
  });
  document.addEventListener("click", () => open && toggle(false));

  // Konum: mesaj kutusunun sağ üst köşesi
  let raf = 0;
  const place = () => {
    raf = 0;
    const a = getAnchor();
    if (!a || !vmCache) { wrap.style.display = "none"; return; }
    const r = a.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) { wrap.style.display = "none"; return; }
    const key = `${r.right}|${r.top}`;
    wrap.style.display = "";
    if (key === lastAnchorKey) return;
    lastAnchorKey = key;
    const w = wrap.offsetWidth || 160, h = pill.offsetHeight || 26;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w - 12));
    const top = Math.max(8, r.top - h - 6);
    wrap.style.left = `${left}px`;
    wrap.style.top = `${top}px`;
  };
  const schedulePlace = () => { if (!raf) raf = requestAnimationFrame(place); };
  window.addEventListener("resize", schedulePlace, { passive: true });
  window.addEventListener("scroll", schedulePlace, { passive: true, capture: true });
  const timer = setInterval(schedulePlace, 500);

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICON = { crit: "!", warn: "!", info: "i", tip: "✓" };

  function update(vm) {
    vmCache = vm;
    if (!vm) { wrap.style.display = "none"; return; }
    wrap.classList.remove("lvl-ok", "lvl-warn", "lvl-crit");
    wrap.classList.add(`lvl-${vm.level}`);
    root.querySelector(".head").textContent = vm.head;
    root.querySelector(".sub").textContent = vm.sub;
    const badge = root.querySelector(".badge");
    const n = vm.warnings.filter((w) => w.sev === "crit" || w.sev === "warn").length;
    badge.hidden = n === 0;
    badge.textContent = String(n);
    pill.title = vm.title || "";

    const rows = (list) => list.map(([k, v]) => `<div class="row"><span class="muted">${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
    const bar = (b) => b ? `<div class="bar" aria-hidden="true"><i class="used" style="width:${Math.min(100, b.used)}%"></i><i class="est" style="left:${Math.min(100, b.used)}%;width:${Math.max(0.8, Math.min(100 - b.used, b.est))}%"></i></div>` : "";
    card.innerHTML = `
      <button class="x" aria-label="${esc(vm.closeLabel)}">×</button>
      <h3>${esc(vm.cardTitle)}</h3>
      <div class="big">${esc(vm.big)}</div>
      <div class="muted">${esc(vm.bigSub)}</div>
      ${bar(vm.bar)}
      ${vm.warnings.map((w) => `<div class="warn ${w.sev}"><span class="ic">${ICON[w.sev] || "i"}</span><span>${esc(w.text)}</span></div>`).join("")}
      <div class="sec">${rows(vm.rows)}</div>
      ${vm.detail?.length ? `<div class="sec">${rows(vm.detail)}</div>` : ""}
      <button class="more" type="button">${esc(vm.moreLabel)}</button>
      <div class="foot">${esc(vm.foot)}</div>`;
    lastAnchorKey = "";
    schedulePlace();
  }

  return {
    update,
    destroy() { clearInterval(timer); host.remove(); },
    isOpen: () => open,
    host
  };
}
