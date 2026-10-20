// İçerik betiği: claude.ai sayfasında çalışır ve her şeyi birbirine bağlar.
//
//  sayfa ──(prompt, ekler, model, effort)──┐
//  sohbet API'si ──(geçmiş, son etkinlik)──┼─→ tahmin motoru ─→ panel
//  depo ──(kullanım, plan, kalibrasyon)────┘
//  sayfa kancası (inject/hook.js) ──(gönderim, cevap, message_limit)─→ kalibrasyon gözlemi
//
// Hiçbir metin cihazdan çıkmaz: tüm hesaplar burada, yerelde yapılır.

(() => {
  if (window.__tokenForecastLoaded) return;
  window.__tokenForecastLoaded = true;

  const L = {};
  const loading = (async () => {
    const mod = (p) => import(chrome.runtime.getURL(p));
    [L.usage, L.tokens, L.page, L.att, L.ctx, L.cls, L.fc, L.cal, L.conv, L.i18n, L.panel] = await Promise.all([
      mod("lib/usage.js"), mod("lib/tokens.js"), mod("lib/page.js"), mod("lib/attachments.js"), mod("lib/context.js"),
      mod("lib/classify.js"), mod("lib/forecast.js"), mod("lib/calibrate.js"), mod("lib/conversation.js"),
      mod("lib/i18n.js"), mod("lib/panel.js")
    ]);
  })().catch((e) => console.debug("[Token Forecast] yüklenemedi", e));

  // ---------- Durum ----------
  const S = {
    settings: { language: "auto", thresholds: [50, 75, 90], notifications: true, panel: true, memory: "auto" },
    i18n: null, usage: null, tier: null, orgId: null, calib: null,
    conv: { id: null, summary: null, fetchedAt: 0, error: null },
    activity: {}, // sohbet → son gönderim zamanı (bu cihazda görülen)
    pending: [], limbo: null, nextId: 1,
    snapshots: new Map(), // hook id → gönderim anındaki tahmin
    last: null
  };
  const store = chrome.storage.local;

  async function loadState() {
    const r = await store.get(["settings", "usage", "tier", "orgId", "calib", "convActivity"]);
    S.settings = { ...S.settings, ...(r.settings || {}) };
    S.usage = r.usage || null; S.tier = r.tier || null; S.orgId = r.orgId || null;
    S.calib = L.cal.makeCalib(r.calib);
    S.activity = r.convActivity || {};
    S.i18n = await L.i18n.makeI18n(S.settings.language);
  }

  chrome.storage.onChanged.addListener(async (ch, area) => {
    if (area !== "local") return;
    await loading;
    if (ch.usage) S.usage = ch.usage.newValue || null;
    if (ch.tier) S.tier = ch.tier.newValue || null;
    if (ch.orgId) S.orgId = ch.orgId.newValue || null;
    if (ch.calib) S.calib = L.cal.makeCalib(ch.calib.newValue);
    if (ch.settings) {
      S.settings = { ...S.settings, ...(ch.settings.newValue || {}) };
      S.i18n = await L.i18n.makeI18n(S.settings.language);
    }
    schedule(50);
  });

  const send = (msg) => new Promise((res) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r); }); } catch (_) { res(null); }
  });

  // ---------- Kullanım (adım 3) ----------
  async function ensureOrg() {
    if (S.orgId && S.tier) return S.orgId;
    const o = await L.usage.fetchOrg();
    S.orgId = o.orgId; S.tier = o.tier;
    await store.set({ orgId: o.orgId, tier: o.tier });
    return S.orgId;
  }
  async function readUsageNow() {
    const orgId = await ensureOrg();
    const raw = await L.usage.fetchRawUsage(orgId);
    send({ type: "usage:report", raw, orgId, tier: S.tier });
    return L.usage.normalizeUsage(raw);
  }
  async function periodicUsage() {
    try { await loading; await readUsageNow(); } catch (e) { console.debug("[Token Forecast] kullanım:", e?.message || e); }
  }
  setInterval(() => document.visibilityState === "visible" && periodicUsage(), 5 * 60 * 1000);

  // ---------- Sohbet verisi ----------
  let convTimer = null;
  function refreshConversation(delay = 0) {
    clearTimeout(convTimer);
    convTimer = setTimeout(async () => {
      const id = L.conv.conversationIdFromPath();
      if (!id) { S.conv = { id: null, summary: null, fetchedAt: 0, error: null }; schedule(0); return; }
      try {
        const orgId = await ensureOrg();
        const json = await L.conv.fetchConversation(orgId, id);
        if (L.conv.conversationIdFromPath() !== id) return; // bu arada sayfa değişti
        S.conv = { id, summary: L.conv.summarizeConversation(json, opts()), fetchedAt: Date.now(), error: null };
      } catch (e) {
        S.conv = { id, summary: null, fetchedAt: Date.now(), error: String(e?.message || e) };
      }
      schedule(0);
    }, delay);
  }
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      S.pending = []; S.limbo = null;
      refreshConversation(400);
    }
  }, 700);

  const opts = () => ({ fallbackTr: S.i18n?.lang === "tr" ? 0.5 : 0 });

  // ---------- Ekler (adım 4) ----------
  const PASTE_ATTACH_CHARS = 2000;
  async function addFiles(files) {
    if (!files?.length) return;
    await loading;
    for (const file of files) {
      const item = { id: S.nextId++, name: file.name || "", status: "analyzing", low: 0, mid: 0, high: 0, addedAt: Date.now() };
      S.pending.push(item);
      schedule(50);
      L.att.analyzeFile(file, opts()).then((r) => {
        Object.assign(item, r, { status: "done", mid: r.mid ?? Math.round(Math.sqrt(Math.max(1, r.low) * Math.max(1, r.high))) });
        schedule(50);
      });
    }
  }
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.type === "file") addFiles([...el.files]);
  }, true);
  document.addEventListener("drop", (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) addFiles(files);
  }, true);
  document.addEventListener("paste", async (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { addFiles(files); return; }
    const text = e.clipboardData?.getData("text/plain") || "";
    if (text.length >= PASTE_ATTACH_CHARS) {
      await loading;
      const r = L.att.analyzePastedText(text, opts());
      S.pending.push({ id: S.nextId++, ...r, mid: Math.round((r.low + r.high) / 2), status: "done", pastedHead: text.slice(0, 60), addedAt: Date.now() });
    }
    schedule(300);
  }, true);

  function reconcileAttachments(chipCount, promptText) {
    S.pending = S.pending.filter((p) => !(p.kind === "pasted" && p.pastedHead && promptText.includes(p.pastedHead.slice(0, 40))));
    const settled = S.pending.filter((p) => Date.now() - p.addedAt > 1500);
    if (chipCount >= S.pending.length || settled.length === 0) return;
    if (chipCount === 0) { S.pending = []; return; }
    const composerText = L.page.getComposer()?.innerText || "";
    const byName = S.pending.filter((p) => p.name && composerText.includes(p.name.slice(0, 12)));
    S.pending = byName.length === chipCount ? byName : S.pending.slice(-chipCount);
  }

  // ---------- Hesap ----------
  let domHistCache = { key: "", est: null, count: 0 };
  function domHistory() {
    const h = L.page.readHistory();
    const all = [...h.user, ...h.assistant];
    const key = all.length + ":" + all.reduce((s, x) => s + x.length, 0);
    if (key !== domHistCache.key) domHistCache = { key, est: L.tokens.estimateConversation(all, opts()), count: all.length };
    return domHistCache;
  }

  function historyInput() {
    const id = L.conv.conversationIdFromPath();
    const local = id ? S.activity[id] || null : null;
    if (id && S.conv.id === id && S.conv.summary) {
      const s = S.conv.summary;
      return { source: "api", messages: s.messages, tokens: s.tokens, lastActivityAt: Math.max(s.lastActivityAt || 0, local || 0) || null, files: s.files, model: s.model };
    }
    const d = domHistory();
    return { source: "dom", messages: d.count, tokens: d.est || { low: 0, mid: 0, high: 0 }, lastActivityAt: local, files: 0 };
  }

  let memo = null;
  function compute() {
    if (!S.i18n || !S.calib) return null;
    if (!L.page.isConversationPage()) return null;
    const prompt = L.page.readPrompt();
    reconcileAttachments(L.page.readAttachments().count, prompt.text);
    const attKey = S.pending.map((p) => `${p.id}:${p.status}`).join(",");
    // Metin ve ekler değişmediyse token sayımı ve sınıflandırma tekrarlanmaz
    if (!memo || memo.text !== prompt.text || memo.attKey !== attKey || memo.lang !== S.i18n.lang) {
      memo = {
        text: prompt.text, attKey, lang: S.i18n.lang,
        pt: L.tokens.estimateTokens(prompt.text, opts()),
        cls: L.cls.classify(prompt.text, { attachments: S.pending })
      };
    }
    const pt = memo.pt, cls = memo.cls;
    const att = L.tokens.sumRanges(...S.pending);
    const analyzing = S.pending.some((x) => x.status === "analyzing");
    const hist = historyInput();
    const model = L.page.detectModel() || hist.model || "Sonnet 5.5";
    const effort = L.page.detectEffort();
    const tier = S.tier || "claude_pro";
    const memoryOn = S.settings.memory === "auto" ? true : !!S.settings.memory;
    const input = { promptTokens: pt, attachmentTokens: att, history: hist, model, effort, tier, cls, calib: S.calib, memoryOn };
    const fc = L.fc.forecastMessage(input);
    const fit = L.fc.fitCheck(fc, S.usage);
    const rec = L.fc.recommendModel(fc, L.cls.recommendTier(cls), input);
    const effRec = L.fc.recommendEffort(cls, fc.effort);
    const ctxLevel = L.ctx.contextLevel({ low: fc.context.usedLow, high: fc.context.used }, fc.context.window);
    const r = { at: Date.now(), prompt, pt, att, analyzing, hist, cls, input, fc, fit, rec, effRec, ctxLevel, empty: !prompt.text && !S.pending.length };
    S.last = r;
    window.__tokenForecastLast = r;
    rememberContext(model, effort, tier);
    return r;
  }

  let ctxSavedAt = 0, ctxSaved = "";
  function rememberContext(model, effort, tier) {
    const k = `${model}|${effort}|${tier}`;
    if (k === ctxSaved && Date.now() - ctxSavedAt < 60000) return;
    ctxSaved = k; ctxSavedAt = Date.now();
    store.set({ lastContext: { model, effort, tier, at: Date.now(), memoryOn: S.settings.memory !== false } });
  }

  // ---------- Panel görünümü ----------
  let panel = null;
  function viewModel(r) {
    const { t, num, pct } = S.i18n;
    const fc = r.fc;
    const sess = fc.pct.session, week = fc.pct.weekly;
    const range = (p) => (p.high < 0.1 ? t("lessThan", [pct(0.1)]) : `${pct(p.low)}–${pct(p.high)}`);
    const warnings = [];

    // 1) Sığar mı?
    for (const w of r.fit.windows) {
      if (w.status === "ok") continue;
      const name = w.window === "session" ? t("sessionLimit") : t("weeklyLimit");
      const when = w.resetsAt ? t("resetsIn", [L.i18n.duration(t, w.resetsAt - Date.now()), L.i18n.clock(w.resetsAt, S.i18n.locale)]) : "";
      warnings.push({ sev: w.status === "no" ? "crit" : "warn", text: t(w.status === "no" ? "warnNoFit" : "warnMaybeFit", [name, pct(w.remaining)]) + (when ? " " + when + "." : "") });
    }
    // 2) Bağlam penceresi
    if (r.ctxLevel.level !== "ok") {
      const big = S.pending.some((p) => p.high > 100_000);
      warnings.push({ sev: r.ctxLevel.level === "over" ? "crit" : "warn", text: t(r.ctxLevel.level === "over" ? "ctxOver" : "ctxNear") + (big && S.tier !== "claude_free" ? " " + t("ctxWorkspace") : "") });
    }
    for (const it of S.pending) {
      if (it.detail?.tooLarge) warnings.push({ sev: "crit", text: t("pdfTooLarge") });
      else if (it.detail?.textOnly) warnings.push({ sev: "info", text: t("pdfTextOnly") });
    }
    // 3) Önbellek
    const histMid = r.hist.tokens.mid || 0;
    if (fc.cache === "cold" && histMid > 5000) {
      warnings.push({ sev: "warn", text: t("warnCacheCold", [String(Math.round(fc.minutesSince)), num(histMid)]) });
    } else if (fc.cache === "unknown" && histMid > 20000) {
      warnings.push({ sev: "info", text: t("warnCacheUnknown", [num(histMid)]) });
    }
    if (histMid > 150_000) warnings.push({ sev: "info", text: t("tipNewChat", [num(histMid)]) });
    // 4) Yoğun saat
    if (fc.peak) {
      // Yoğun saatler hafta içi 12:00–18:00 UTC; kullanıcının yerel saatine çevrilir
      const d0 = new Date(); d0.setUTCHours(12, 0, 0, 0);
      const d1 = new Date(); d1.setUTCHours(18, 0, 0, 0);
      const hm = (d) => d.toLocaleTimeString(S.i18n.locale, { hour: "2-digit", minute: "2-digit" });
      warnings.push({ sev: "info", text: t("warnPeak", [hm(d0), hm(d1)]) });
    }
    // 5) Model ve effort önerisi
    if (r.rec?.kind === "downgrade" && sess.mid > 0.05) {
      warnings.push({ sev: "tip", text: t("recDowngrade", [r.rec.label, String(Math.round(r.rec.saving * 100))]) + " " + t(r.rec.reasonKey) });
    } else if (r.rec?.kind === "upgrade") {
      warnings.push({ sev: "info", text: t("recUpgrade", [r.rec.label]) });
    }
    if (r.effRec?.kind === "lower") warnings.push({ sev: "tip", text: t("effLower") });
    if (r.effRec?.kind === "raise") warnings.push({ sev: "info", text: t("effRaise") });

    const level = warnings.some((w) => w.sev === "crit") ? "crit" : warnings.some((w) => w.sev === "warn") ? "warn" : "ok";
    const used = S.usage?.fiveHour?.pct ?? null;
    const typeName = t(`type_${r.cls.type}`);
    const conf = t(fc.confidence === "high" ? "confidenceHigh" : fc.confidence === "medium" ? "confidenceMedium" : "confidenceLow");
    const tokRange = (x) => (Math.round(x.low) === Math.round(x.high) ? num(x.high) : `${num(x.low)}–${num(x.high)}`);
    const inTokens = { low: r.pt.low + r.att.low, high: r.pt.high + r.att.high };

    const rows = [
      [t("rowWeekly"), range(week)],
      [t("rowType"), `${typeName} · ${conf}`],
      [t("rowModel"), `${fc.model ? S.i18n.t("modelName", [cap(fc.model)]) : "?"}${fc.effort !== "auto" ? " · " + t(`effort_${fc.effort}`) : ""}`],
      [t("rowInput"), tokRange(inTokens) + " " + t("dbgTokens")],
      [t("rowOutput"), `${num(fc.output.low)}–${num(fc.output.high)} ${t("dbgTokens")}`]
    ];
    const detail = [];
    if (r.att.high > 0 || r.analyzing) detail.push([t("dbgAttachments"), r.analyzing ? t("dbgAnalyzing") : `${S.pending.length} · ${tokRange(r.att)}`]);
    if (r.hist.messages) {
      detail.push([t("dbgHistory"), `${t("dbgMessages", [String(r.hist.messages)])} · ${tokRange(r.hist.tokens)}`]);
      detail.push([t("rowCache"), t(`cache_${fc.cache}`)]);
    }
    detail.push([t("rowContext"), `${pct(100 * r.ctxLevel.highPct)} / ${num(fc.context.window / 1000)}K`]);
    const cs = S.calib.summary();
    const foot = cs.measurements >= 3
      ? t("footCalibrated", [String(cs.measurements), cs.inRangePct === null ? "–" : String(cs.inRangePct)])
      : t("footLearning");

    return {
      level,
      head: r.empty ? t("pillIdle") : `≈ ${pct(sess.mid)}`,
      sub: r.empty ? (used !== null ? t("pillUsed", [pct(used)]) : "") : `(${range(sess)}) ${t("pillSub")}`,
      title: t("extName"),
      cardTitle: t("cardTitle"),
      big: r.empty ? (used !== null ? pct(used) : "–") : `≈ ${pct(sess.mid)}`,
      bigSub: r.empty ? t("cardIdleSub") : t("cardSub", [range(sess)]),
      bar: used !== null ? { used, est: r.empty ? 0 : sess.mid } : null,
      warnings, rows: r.empty ? rows.slice(0, 1).concat(rows.slice(2, 3)) : rows, detail, foot,
      closeLabel: t("close"),
      moreLabel: t("moreDetails")
    };
  }
  const cap = (s) => String(s).replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  function render(r) {
    if (!S.settings.panel || !r) { panel?.update(null); return; }
    if (!panel) panel = L.panel.createPanel({ getAnchor: () => L.page.getComposer(), onMore: () => send({ type: "open:details" }) });
    panel.update(viewModel(r));
  }

  // ---------- Kalibrasyon gözlemi (adım 10) ----------
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.__tokenForecast !== 1) return;
    if (d.kind === "send") onSend(d);
    else if (d.kind === "done") onDone(d);
  });

  async function preUsage() {
    // Ücretli planlarda /usage anlık okunur. Ücretsiz planda (/usage boş) son akış değeri kullanılır.
    try {
      const u = await readUsageNow();
      if (u) return { usage: u, at: Date.now() };
    } catch (_) {}
    const { usage, usageMeta } = await store.get(["usage", "usageMeta"]);
    if (usage && usageMeta?.source === "stream" && Date.now() - usageMeta.fetchedAt < 30 * 60000) return { usage, at: usageMeta.fetchedAt };
    return null;
  }

  async function onSend(d) {
    await loading;
    const r = compute() || S.last;
    const conv = d.conv;
    S.activity[conv] = d.at;
    store.set({ convActivity: trimActivity(S.activity) });
    if (!r) return;
    const zero = { outputAdjust: () => ({ mean: 0, sd: 0 }) };
    const base = L.fc.outputPrior(r.cls, { promptTokens: r.pt, attachmentTokens: r.att }, zero);
    const snap = {
      at: d.at, conv, retry: d.retry, cls: r.cls, tier: S.tier || "claude_pro",
      model: r.fc.model, weight: r.fc.weight, effort: r.fc.effort, peak: r.fc.peak,
      newInput: r.pt.mid + r.att.mid, history: r.hist.tokens.mid || 0, cold: r.fc.cache === "cold",
      cacheKnown: r.fc.cache !== "unknown", toolMedian: base.tool ? base.tool.median : 0,
      predicted: r.fc.pct, outMuNoAdj: base.mu, pre: null
    };
    S.snapshots.set(d.id, snap);
    S.pending = [];
    // Önceki değeri hemen iste; cevap bundan önce biterse onDone bu sözü bekler
    snap.prePromise = preUsage().then((p) => (snap.pre = p));
    // Çok eski anlık görüntüleri temizle
    for (const [k, v] of S.snapshots) if (Date.now() - v.at > 20 * 60000) S.snapshots.delete(k);
    schedule(100);
  }

  async function onDone(d) {
    await loading;
    const snap = S.snapshots.get(d.id);
    S.snapshots.delete(d.id);
    let post = null;
    if (d.messageLimit) {
      post = L.usage.normalizeSse(d.messageLimit);
      send({ type: "usage:sse", messageLimit: d.messageLimit });
    }
    if (!post) {
      await new Promise((res) => setTimeout(res, 1500));
      try { post = await readUsageNow(); } catch (_) {}
    }
    refreshConversation(1500);
    if (snap?.prePromise) await snap.prePromise.catch(() => null);
    if (!snap || !post || d.error || d.aborted) return;
    if (!snap.cacheKnown && snap.history > 5000) return; // önbellek durumu bilinmiyorsa maliyet belirsiz → öğrenme

    const outTokens = L.tokens.estimateTokens(d.text || "", opts()).mid;
    const cost = L.fc.realizedCost({ weight: snap.weight, newInput: snap.newInput, history: snap.history, cold: snap.cold, outTokens, effort: snap.effort, toolMedian: snap.toolMedian });
    const list = [];
    for (const [win, key] of [["session", "fiveHour"], ["weekly", "sevenDay"]]) {
      const a = snap.pre?.usage?.[key], b = post[key];
      if (!a || !b) continue;
      if (a.resetsAt && b.resetsAt && Math.abs(a.resetsAt - b.resetsAt) > 2 * 60000) continue; // pencere yenilendi
      if (Date.now() - snap.pre.at > 15 * 60000) continue;
      list.push({
        at: Date.now(), tier: snap.tier, window: win, delta: Math.round((b.pct - a.pct) * 100) / 100, cost,
        peakMul: win === "session" && snap.peak ? L.fc.PEAK.multiplier : 1,
        predicted: snap.predicted[win], type: snap.cls.type, outTokens, outMuNoAdj: snap.outMuNoAdj, model: snap.model
      });
    }
    if (!list.length && outTokens > 0) {
      // Kullanım farkı ölçülemedi ama cevap uzunluğu yine de öğrenilebilir
      list.push({ at: Date.now(), tier: snap.tier, window: null, type: snap.cls.type, outTokens, outMuNoAdj: snap.outMuNoAdj, model: snap.model });
    }
    if (list.length) send({ type: "calib:observe", list });
  }

  function trimActivity(a) {
    const keys = Object.keys(a);
    if (keys.length <= 300) return a;
    keys.sort((x, y) => a[x] - a[y]).slice(0, keys.length - 300).forEach((k) => delete a[k]);
    return a;
  }

  // ---------- Tetikleyiciler ----------
  let timer = null;
  function schedule(ms = 300) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await loading; if (!S.i18n) await loadState(); render(compute()); } catch (e) { console.debug("[Token Forecast]", e); }
    }, ms);
  }
  document.addEventListener("input", () => schedule(250), true);
  document.addEventListener("keyup", (e) => { if (e.key === "Backspace" || e.key === "Delete") schedule(250); }, true);
  new MutationObserver((muts) => {
    if (panel && muts.every((m) => panel.host.contains(m.target))) return;
    schedule(900);
  }).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { if (S.pending.length) schedule(0); }, 3000);

  (async () => {
    await loading;
    await loadState();
    periodicUsage();
    refreshConversation(300);
    schedule(400);
  })();
})();
