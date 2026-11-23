// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Tiko'nun durum makinesi. Saf fonksiyonlar: DOM yok, saat yok (zaman her olayla birlikte gelir),
// rastlantı dışarıdan verilir. Çizim ve hareket lib/tiko.js'te; burası yalnızca "şu an ne yapıyor" sorusunu yanıtlar.
//
// Girdi olarak yalnızca sinyaller gelir: yazıldı, gönderildi, cevap yazılıyor, tahmin ağır, hafif model önerildi,
// haftalık yüzde. Mesaj metni bu dosyaya hiç ulaşmaz.
//
//   off ──aç──▶ hidden ──mesaj kutusu bulundu──▶ idle ◀──────────────┐
//                                                 │ yazı              │ 1,4 sn yazı yok
//                                                 ▼                   │
//                                               typing ───────────────┘
//   herhangi biri ──gönder──▶ send (0,85 sn) ──▶ perch (cevap yazılıyorsa) ──cevap bitti──▶ cheer (1,8 sn) ──▶ idle
//   idle ──2 dk hareketsizlik──▶ sleep ──herhangi bir hareket──▶ wake (1,3 sn) ──▶ idle

export const TIKO = {
  TYPE_IDLE_MS: 1400,      // bu kadar süre yazı gelmezse "yazma durdu"
  SLEEP_MS: 120000,        // 2 dk hareketsizlik → uyku
  SEND_MS: 850,            // gönderim uçuşu
  CHEER_MS: 1800,          // cevap bitince sevinme
  WAKE_MS: 1300,           // uyanınca gerinme
  REACT_MS: 1100,          // tıklama tepkisi
  APPROVE_MS: 1700,        // hafif model önerisine onay
  WORRY_PCT: 80,           // haftalık limit bu yüzdeyi geçince endişeli
  HEAVY_PCT: 5,            // tek mesaj 5 saatlik limitin bu kadarını yiyecekse "ağır" (content.js kullanır)
  // Nadir sürprizler (en fazla dört tane; yenisini eklemeden önce birini çıkar):
  //  1) dans: boşta dururken ara sıra kendi etrafında döner
  //  2) baş dönmesi: kısa sürede 5 kez tıklanırsa
  //  3) "oh be": bir dakikadan uzun süren cevap bitince alkış yerine terini siler
  //  4) esneme: uykudan uyanınca gerinir
  DANCE_EVERY_MS: 45000, DANCE_P: 0.12, DANCE_MS: 1900,
  DIZZY_CLICKS: 5, DIZZY_WINDOW_MS: 2500, DIZZY_MS: 2400,
  LONG_STREAM_MS: 60000
};

const shown = (m) => m !== "off" && m !== "hidden";

export function initial(at = 0) {
  return {
    mode: "off", now: at,
    enabled: false, composer: false, reduced: false,
    parked: false, dragging: false,
    heavy: false, light: false, weeklyPct: 0,
    streamOn: false, streamSince: 0,
    until: 0,          // send / cheer / wake ne zaman biter
    cheer: null,       // "clap" | "stretch" | "phew"
    act: null,         // geçici tepki: { name: "react" | "approve" | "dizzy" | "dance", until }
    lastAct: at,       // son kullanıcı hareketi
    typedAt: null,     // son yazı
    approved: false,   // bu öneri için onay hareketi yapıldı mı
    clicks: [],
    danceAt: 0
  };
}

function toIdle(n, at) {
  n.mode = "idle"; n.until = 0; n.cheer = null;
  n.danceAt = at + TIKO.DANCE_EVERY_MS;
  if (n.light && !n.approved) { n.act = { name: "approve", until: at + TIKO.APPROVE_MS }; n.approved = true; }
}

// Geçici bir durum bitince dönülecek yer: hâlâ yazılıyorsa yazı, cevap akıyorsa cevabın üstü, yoksa boşta.
function rest(n, at) {
  if (n.typedAt !== null && at - n.typedAt < TIKO.TYPE_IDLE_MS) { n.mode = "typing"; n.until = 0; n.cheer = null; }
  else if (n.streamOn) { n.mode = "perch"; n.until = 0; n.cheer = null; }
  else toIdle(n, at);
}

function wake(n, at) {
  if (n.mode === "sleep") { n.mode = "wake"; n.until = at + TIKO.WAKE_MS; }
}

// Olaylar: enable{on} · composer{on} · reduced{on} · type · activity · signals{heavy,light,weeklyPct} · send ·
// stream{on} · click · drag{phase:"start"|"end",park} · park{on} · tick
export function reduce(s, ev, rand = Math.random) {
  const at = Number.isFinite(ev?.at) ? ev.at : s.now;
  const n = { ...s, now: at };
  switch (ev?.type) {
    case "enable": n.enabled = !!ev.on; break;
    case "composer": n.composer = !!ev.on; break;
    case "reduced": n.reduced = !!ev.on; break;
    case "signals": {
      n.heavy = !!ev.heavy;
      n.weeklyPct = Number.isFinite(ev.weeklyPct) ? ev.weeklyPct : 0;
      n.light = !!ev.light;
      if (!n.light) n.approved = false;
      else if (!n.approved && n.mode === "idle" && !n.act) { n.act = { name: "approve", until: at + TIKO.APPROVE_MS }; n.approved = true; }
      break;
    }
    case "type":
      if (!shown(n.mode)) break;
      n.typedAt = at; n.lastAct = at;
      if (n.mode !== "send") {
        n.mode = "typing"; n.until = 0; n.cheer = null;
        if (n.act && n.act.name !== "dizzy") n.act = null;
      }
      break;
    case "activity":
      n.lastAct = at;
      wake(n, at);
      break;
    case "send":
      if (!shown(n.mode)) break;
      n.mode = "send"; n.until = at + TIKO.SEND_MS; n.lastAct = at;
      n.act = null; n.cheer = null; n.typedAt = null;
      break;
    case "stream": {
      const on = !!ev.on;
      if (on && !n.streamOn) {
        n.streamOn = true; n.streamSince = at;
        if (["idle", "sleep", "wake", "cheer"].includes(n.mode)) { n.mode = "perch"; n.until = 0; n.cheer = null; n.act = null; }
      } else if (!on && n.streamOn) {
        n.streamOn = false; n.lastAct = at;
        if (n.mode === "perch") {
          n.mode = "cheer"; n.until = at + TIKO.CHEER_MS; n.act = null;
          n.cheer = at - n.streamSince >= TIKO.LONG_STREAM_MS ? "phew" : rand() < 0.5 ? "clap" : "stretch";
        }
      }
      break;
    }
    case "click":
      if (!shown(n.mode)) break;
      n.lastAct = at;
      wake(n, at);
      n.clicks = [...n.clicks.filter((t) => at - t < TIKO.DIZZY_WINDOW_MS), at];
      if (n.clicks.length >= TIKO.DIZZY_CLICKS) { n.act = { name: "dizzy", until: at + TIKO.DIZZY_MS }; n.clicks = []; }
      else if (n.act?.name !== "dizzy") n.act = { name: "react", until: at + TIKO.REACT_MS };
      break;
    case "drag":
      if (!shown(n.mode)) break;
      n.lastAct = at;
      if (ev.phase === "start") { n.dragging = true; wake(n, at); }
      else { n.dragging = false; n.parked = !!ev.park; }
      break;
    case "park": n.parked = !!ev.on; break;
    default: break; // "tick" ve bilinmeyen olaylar: yalnızca süreli geçişlere bakılır
  }

  // Görünürlük: kapalıysa ya da mesaj kutusu yoksa hiçbir şey yapma
  if (!n.enabled) { n.mode = "off"; n.act = null; n.dragging = false; return n; }
  if (!n.composer) { n.mode = "hidden"; n.act = null; n.dragging = false; return n; }
  if (!shown(n.mode)) { n.lastAct = at; n.typedAt = null; rest(n, at); }

  // Süreli geçişler
  if (n.act && at >= n.act.until) n.act = null;
  if ((n.mode === "send" || n.mode === "cheer" || n.mode === "wake") && at >= n.until) rest(n, at);
  if (n.mode === "typing" && (n.typedAt === null || at - n.typedAt >= TIKO.TYPE_IDLE_MS)) rest(n, at);
  if (n.mode === "idle") {
    if (!n.dragging && at - n.lastAct >= TIKO.SLEEP_MS) { n.mode = "sleep"; n.act = null; }
    else if (!n.act && !n.reduced && at >= n.danceAt) {
      n.danceAt = at + TIKO.DANCE_EVERY_MS;
      if (rand() < TIKO.DANCE_P) n.act = { name: "dance", until: at + TIKO.DANCE_MS };
    }
  }
  return n;
}

// Bir sonraki süreli geçişin zamanı (yoksa null). Çizim katmanı tek bir setTimeout'u buna kurar; yoklama yok.
export function deadline(s) {
  if (!shown(s.mode)) return null;
  const c = [];
  if (s.act) c.push(s.act.until);
  if (s.mode === "send" || s.mode === "cheer" || s.mode === "wake") c.push(s.until);
  if (s.mode === "typing" && s.typedAt !== null) c.push(s.typedAt + TIKO.TYPE_IDLE_MS);
  if (s.mode === "idle") {
    if (!s.dragging) c.push(s.lastAct + TIKO.SLEEP_MS);
    if (!s.act && !s.reduced) c.push(s.danceAt);
  }
  return c.length ? Math.min(...c) : null;
}

// Durumdan görünüm: nerede durur (place), ne yapar (pose), yüzü nasıl (face).
//   place: caret (imlecin üstü) · home (mesaj kutusunun üstü) · perch (cevabın üst kenarı) · stay (olduğu yer) ·
//          park (kullanıcının bıraktığı yer) · drag
export function view(s) {
  if (!shown(s.mode)) return { visible: false, mode: s.mode, place: "none", pose: "none", face: "neutral", worried: false };
  const worried = s.weeklyPct >= TIKO.WORRY_PCT;
  const place = s.dragging ? "drag" : s.parked ? "park" : s.reduced ? "home"
    : s.mode === "typing" ? "caret" : s.mode === "perch" ? "perch" : (s.mode === "send" || s.mode === "cheer") ? "stay" : "home";
  let pose = { idle: "stand", typing: "hover", send: "fly", perch: "sit", cheer: s.cheer || "clap", sleep: "sleep", wake: "yawn" }[s.mode] || "stand";
  const act = s.act?.name;
  if (act && s.mode !== "send" && s.mode !== "sleep") pose = { react: "wave", approve: "nod", dizzy: "dizzy", dance: "dance" }[act] || pose;
  let face;
  if (pose === "sleep" || pose === "yawn") face = "closed";
  else if (pose === "dizzy") face = "dizzy";
  else if (pose === "phew") face = "relief";
  else if (["wave", "nod", "dance", "clap", "stretch", "fly"].includes(pose)) face = "happy";
  else if (s.mode === "idle" && s.heavy) face = "strain";     // yazma durunca, tahmin yüksekse
  else if (worried) face = "worry";                           // haftalık limit %80 üstü
  else if (pose === "sit") face = "read";
  else face = "neutral";
  if (s.reduced) pose = "still";                              // hareket azaltma açık: kıpırdamayan küçük ikon
  return { visible: true, mode: s.mode, place, pose, face, worried };
}
