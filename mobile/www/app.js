// ============================================================
// Forging XP — mobile
// ============================================================
"use strict";

const NATIVE = typeof window.Android !== "undefined";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Math.round(n).toLocaleString("en-US");

// ============================================================
// XP curve: floor((1500 + 400n + 40n²) × 3.4), n = L − 1
// Derived from in-game measurements: the max XP of every blacksmithing level from 1 to 25 was
// recorded and this formula was fitted to them (it reproduces every measured value exactly).
// Levels above 25 — and theoretical mode past 35 — are extrapolated from the same formula.
// ============================================================
const GAME_CAP = 35;          // real in-game max level
const THEO_CAP = 500;         // theoretical mode: formula continues past 35
let MAX_LEVEL = GAME_CAP;
let THEO = false;             // never persisted: every launch starts with the real cap
const rawXp = L => { const n = L - 1; return Math.floor((1500 + 400 * n + 40 * n * n) * 34 / 10); };
function xpToNext(L) {
  if (L < 1 || L >= MAX_LEVEL) return 0;
  return rawXp(L);
}
const CUM = [0, 0];
for (let L = 1; L < THEO_CAP; L++) CUM[L + 1] = CUM[L] + rawXp(L);
const totalAt = (L, xp) => CUM[Math.min(Math.max(L, 1), MAX_LEVEL)] + xp;
function levelFromTotal(t) {
  let L = 1;
  while (L < MAX_LEVEL && t >= CUM[L + 1]) L++;
  return { lv: L, rem: t - CUM[L] };
}

// ============================================================
// Materials
// ============================================================
const MATS = [
  { id: "iron",       name: "Iron",       lv: 1,  def: 320,  c: "#b9bec7", c2: "#7d838d", shape: "ingot" },
  { id: "steel",      name: "Steel",      lv: 6,  def: 1120, c: "#8fb4d9", c2: "#4f6f91", shape: "ingot" },
  { id: "kobold",     name: "Kobold",     lv: 15, def: 2560, c: "#e8bf5a", c2: "#a67a1e", shape: "ingot" },
  { id: "crystalite", name: "Crystalite", lv: 25, def: 4160, c: "#7ff0f0", c2: "#2aa5b8", shape: "crystal" },
  { id: "obsidian",   name: "Obsidian",   lv: 35, def: 0,    c: "#9b6df0", c2: "#3b2569", shape: "shard" },
];
const MAT = Object.fromEntries(MATS.map(m => [m.id, m]));
const per4 = id => +S.per4[id] || 0;
const craftsFor = (xp, id) => per4(id) > 0 ? Math.ceil(Math.max(0, xp) / per4(id)) : null;
const itemsFor = (xp, id) => { const c = craftsFor(xp, id); return c == null ? null : c * 4; };
const xpFromItems = (n, id) => Math.floor(n / 4) * per4(id);
const unlockOf = id => Math.max(1, Math.min(GAME_CAP, +S.unlock[id] || 1));
const usableAt = (id, L) => per4(id) > 0 && unlockOf(id) <= L;
const LOCK_SVG = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
function lockBadge(id, L, target = MAX_LEVEL) {
  const u = unlockOf(id);
  if (u <= 1) return "";
  if (u >= MAX_LEVEL) return `<span class="lock never">${LOCK_SVG}Lv ${u} · max only</span>`;
  if (u <= L) return `<span class="lock ok">Lv ${u}+</span>`;
  if (u >= target) return `<span class="lock never">${LOCK_SVG}Locked until Lv ${u}</span>`;
  return `<span class="lock soon">${LOCK_SVG}Unlocks Lv ${u}</span>`;
}
function planRoute(cur, to, pick) {
  const steps = [];
  let guard = 0;
  while (cur < to && guard++ < 200) {
    const L = levelFromTotal(cur).lv;
    const id = pick(L);
    if (!id) return { steps, cur, stuck: true };
    let bp = to;
    for (let k = L + 1; k <= MAX_LEVEL; k++) { if (CUM[k] >= to) break; if (pick(k) !== id) { bp = CUM[k]; break; } }
    const crafts = Math.ceil((bp - cur) / per4(id));
    const fromL = L;
    cur += crafts * per4(id);
    const toL = levelFromTotal(Math.min(cur, CUM[MAX_LEVEL])).lv;
    const last = steps[steps.length - 1];
    if (last && last.id === id) { last.crafts += crafts; last.toL = toL; }
    else steps.push({ id, crafts, fromL, toL });
  }
  return { steps, cur, stuck: false };
}
const bestAt = (L, except) => MATS.filter(m => m.id !== except && usableAt(m.id, L)).sort((a, b) => per4(b.id) - per4(a.id))[0]?.id || null;

function matIcon(id, cls = "") {
  const m = MAT[id];
  const g = `g-${id}-${Math.random().toString(36).slice(2, 7)}`;
  let body;
  if (m.shape === "ingot") body = `
      <path d="M5 15 L9 9 H23 L27 15 Z" fill="url(#${g}t)"/>
      <path d="M5 15 H27 L25.5 21.5 H6.5 Z" fill="url(#${g}s)"/>
      <path d="M9 9 H23 L24 10.5 H8 Z" fill="#fff" opacity=".35"/>`;
  else if (m.shape === "crystal") body = `
      <path d="M16 3 L23 11 L16 29 L9 11 Z" fill="url(#${g}s)"/>
      <path d="M16 3 L23 11 L16 13 L9 11 Z" fill="url(#${g}t)"/>
      <path d="M16 13 L16 29 L9 11 Z" fill="#fff" opacity=".18"/>
      <path d="M24 14 L28 18 L25 26 L22 18 Z" fill="url(#${g}s)" opacity=".8"/>
      <path d="M8 15 L10 19 L8 24 L5 19 Z" fill="url(#${g}t)" opacity=".7"/>`;
  else body = `
      <path d="M7 24 L12 6 L19 4 L26 13 L22 27 L11 28 Z" fill="url(#${g}s)"/>
      <path d="M12 6 L19 4 L17 15 L7 24 Z" fill="url(#${g}t)"/>
      <path d="M17 15 L26 13 L22 27 Z" fill="#000" opacity=".25"/>
      <path d="M12 6 L19 4 L18 7 Z" fill="#fff" opacity=".6"/>`;
  return `<span class="mi ${cls}"><svg viewBox="0 0 32 32"><defs>
      <linearGradient id="${g}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="${m.c}"/><stop offset="1" stop-color="${m.c}"/></linearGradient>
      <linearGradient id="${g}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.c}"/><stop offset="1" stop-color="${m.c2}"/></linearGradient>
    </defs>${body}</svg></span>`;
}
const ICON = {
  minus: `<svg class="btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>`,
  plus:  `<svg class="btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#111" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
};

// ============================================================
// State
// ============================================================
const DEFAULTS = {
  volume: 60, muted: false, volUI: 100, volForge: 100, haptics: true,
  theme: "dark", accent: "#fb923c", brightness: 100, zoom: 100, glow: true, anim: true,
  tab: "needed",
  per4: Object.fromEntries(MATS.map(m => [m.id, m.def])),
  unlock: Object.fromEntries(MATS.map(m => [m.id, m.lv])),
  need: { mat: "steel", lv: 1, xp: 0, target: 10 },
  proj: { lv: 1, xp: 0, counts: Object.fromEntries(MATS.map(m => [m.id, 0])) },
};
let S = structuredClone(DEFAULTS);
const ACCENTS = ["#fb923c", "#f43f5e", "#fbbf24", "#4ade80", "#22d3ee", "#60a5fa", "#a78bfa", "#e7e5e4"];
const TABS = ["needed", "proj", "table", "settings"];
const TAB_NAMES = { needed: "Materials Needed", proj: "Level Projection", table: "XP Table", settings: "Settings" };

function deepMerge(base, over) {
  if (!over || typeof over !== "object") return base;
  for (const k of Object.keys(base)) {
    if (!(k in over)) continue;
    const b = base[k], o = over[k];
    if (b && typeof b === "object" && !Array.isArray(b)) base[k] = deepMerge(b, o);
    else if (typeof o === typeof b) base[k] = o;
  }
  return base;
}
function loadState() {
  let raw = null;
  try { raw = NATIVE ? window.Android.load() : localStorage.getItem("fx_settings"); } catch {}
  try { raw = raw ? JSON.parse(raw) : null; } catch { raw = null; }
  S = deepMerge(structuredClone(DEFAULTS), raw || {});
  for (const m of MATS) if (!(+S.per4[m.id] > 0) && m.def > 0) S.per4[m.id] = m.def;
}
let saveT = null;
const saveState = () => { clearTimeout(saveT); saveT = setTimeout(flushSave, 300); };
function flushSave() {
  clearTimeout(saveT);
  const data = JSON.stringify(S);
  try { NATIVE ? window.Android.save(data) : localStorage.setItem("fx_settings", data); } catch {}
}

// ============================================================
// Haptics & audio
// ============================================================
function buzz(ms = 8) {
  if (!S.haptics) return;
  try { NATIVE ? window.Android.vibrate(ms) : navigator.vibrate?.(ms); } catch {}
}
let AC = null;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; }
function vol(cat = "ui") {
  if (S.muted) return 0;
  return ((S.volume / 100) ** 1.6) * ((cat === "forge" ? S.volForge : S.volUI) / 100);
}
function tone({ f = 440, f2 = null, t = 0.08, type = "sine", g = 0.5, delay = 0, cat = "ui" }) {
  if (vol(cat) <= 0) return;
  const c = ac(), now = c.currentTime + delay;
  const o = c.createOscillator(), gn = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t);
  gn.gain.setValueAtTime(0, now);
  gn.gain.linearRampToValueAtTime(g * vol(cat), now + 0.008);
  gn.gain.exponentialRampToValueAtTime(0.0001, now + t);
  o.connect(gn).connect(c.destination);
  o.start(now); o.stop(now + t + 0.05);
}
function noiseBurst({ t = 0.12, g = 0.3, fc = 3000, q = 1, delay = 0, cat = "ui" }) {
  if (vol(cat) <= 0) return;
  const c = ac(), now = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * t);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fc; bp.Q.value = q;
  const gn = c.createGain(); gn.gain.value = g * vol(cat);
  src.connect(bp).connect(gn).connect(c.destination);
  src.start(now);
}
function anvilHit(delay = 0, pitch = 1, g = 1) {
  noiseBurst({ t: .06, g: .5 * g, fc: 5200, q: .8, cat: "forge", delay });
  tone({ f: 1855 * pitch, t: .45, type: "triangle", g: .26 * g, cat: "forge", delay });
  tone({ f: 2489 * pitch, t: .32, type: "triangle", g: .16 * g, cat: "forge", delay: delay + .004 });
  tone({ f: 3322 * pitch, t: .22, type: "sine", g: .09 * g, cat: "forge", delay: delay + .004 });
  tone({ f: 1247 * pitch, t: .6, type: "sine", g: .08 * g, cat: "forge", delay });
  tone({ f: 140, f2: 70, t: .12, type: "sine", g: .35 * g, cat: "forge", delay });
}
const SFX = {
  click:  () => tone({ f: 660, f2: 520, t: .06, type: "triangle", g: .25 }),
  tick:   () => tone({ f: 900, f2: 760, t: .035, type: "triangle", g: .14 }),
  tab:    () => tone({ f: 740, f2: 880, t: .05, g: .16 }),
  open:   () => tone({ f: 440, f2: 660, t: .12, g: .2 }),
  close:  () => tone({ f: 660, f2: 440, t: .1, g: .2 }),
  error:  () => tone({ f: 180, f2: 140, t: .14, type: "square", g: .12 }),
  select: () => { tone({ f: 520, f2: 780, t: .09, type: "triangle", g: .28 }); tone({ f: 1040, t: .05, g: .12, delay: .05 }); },
  pop:    () => tone({ f: 300, f2: 500, t: .05, type: "triangle", g: .2 }),
  forge:  () => anvilHit(0, 1, 1),
  forge3: () => { anvilHit(0, 1, .7); anvilHit(.16, 1.02, .8); anvilHit(.34, .98, 1); },
  levelup:() => { anvilHit(0, 1, .7); [784, 988, 1175, 1568].forEach((f, i) => tone({ f, t: .28, g: .2, delay: .12 + i * .08, cat: "forge" })); },
};

// ============================================================
// Appearance
// ============================================================
function hexLum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
function applyAppearance() {
  const b = document.body;
  b.classList.toggle("theme-dark", S.theme === "dark");
  b.classList.toggle("theme-light", S.theme === "light");
  b.classList.toggle("glow-off", !S.glow);
  b.classList.toggle("no-anim", !S.anim);
  const r = document.documentElement.style;
  r.setProperty("--accent", S.accent);
  r.setProperty("--on-accent", hexLum(S.accent) > .42 ? "#1a1208" : "#ffffff");
  r.setProperty("--brightness", (S.brightness / 100).toFixed(2));
  r.setProperty("--zoom", (S.zoom / 100).toFixed(2));
  if (NATIVE) try {
    const cs = getComputedStyle(b);
    window.Android.setBars(cs.getPropertyValue("--bg-solid").trim(), cs.getPropertyValue("--bg-2").trim(), S.theme === "light");
  } catch {}
}

const animState = new WeakMap();
function animNum(el, to, fmtFn = fmt) {
  if (!el) return;
  const from = animState.get(el) ?? to;
  animState.set(el, to);
  if (!S.anim || from === to) { el.textContent = fmtFn(to); return; }
  const t0 = performance.now(), dur = 420;
  const step = now => {
    if (animState.get(el) !== to) return;
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
    el.textContent = fmtFn(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ============================================================
// Touch helpers
// ============================================================
const parseNum = v => { const n = parseInt(String(v).replace(/[^\d]/g, ""), 10); return isNaN(n) ? 0 : n; };
const getPath = p => p.split(".").reduce((o, k) => o[k], S);
function setPath(p, v) { const ks = p.split("."); const last = ks.pop(); ks.reduce((o, k) => o[k], S)[last] = v; }

/** Tap-or-hold button: a tap fires once on release; holding (without moving) repeats with acceleration.
    Moving the finger (i.e. scrolling) cancels — nothing changes. */
function holdRepeat(btn, fire) {
  let timer = null, sx = 0, sy = 0, active = false, repeated = false, id = null;
  const stop = () => { clearTimeout(timer); timer = null; active = false; btn.classList.remove("held"); };
  btn.addEventListener("pointerdown", e => {
    if (btn.disabled) return;
    active = true; repeated = false; id = e.pointerId; sx = e.clientX; sy = e.clientY;
    let delay = 140;
    const loop = () => { if (!active) return; repeated = true; btn.classList.add("held"); if (fire() === false) return stop(); delay = Math.max(35, delay * .86); timer = setTimeout(loop, delay); };
    timer = setTimeout(() => { buzz(12); loop(); }, 380);
  });
  btn.addEventListener("pointermove", e => {
    if (active && e.pointerId === id && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop();
  });
  btn.addEventListener("pointerup", e => {
    if (!active) return;
    const wasRepeat = repeated; stop();
    if (!wasRepeat && Math.hypot(e.clientX - sx, e.clientY - sy) <= 10) fire();
  });
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("contextmenu", e => e.preventDefault());
}

/** Long-press detector (for table rows). */
function pressable(el, { onTap, onHold }) {
  let timer = null, sx = 0, sy = 0, held = false, live = false;
  const clear = () => { clearTimeout(timer); el.classList.remove("pressing"); live = false; };
  el.addEventListener("pointerdown", e => {
    live = true; held = false; sx = e.clientX; sy = e.clientY;
    el.classList.add("pressing");
    timer = setTimeout(() => { held = true; buzz(20); onHold?.(); clear(); }, 480);
  });
  el.addEventListener("pointermove", e => { if (live && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clear(); });
  el.addEventListener("pointerup", e => { if (live && !held && Math.hypot(e.clientX - sx, e.clientY - sy) <= 10) onTap?.(); clear(); });
  el.addEventListener("pointercancel", clear);
  el.addEventListener("contextmenu", e => e.preventDefault());
}

// ---------- steppers ----------
const STEPPERS = {};
function buildStepper(el, { min, max, onChange, step = 1 }) {
  const path = el.dataset.bind;
  el.innerHTML = `<button class="lvl-btn" data-d="-1" aria-label="Decrease">${ICON.minus}</button>
    <input type="text" inputmode="numeric" autocomplete="off" spellcheck="false" enterkeyhint="done">
    <button class="lvl-btn" data-d="1" aria-label="Increase">${ICON.plus}</button>`;
  const inp = el.querySelector("input");
  const st = { el, inp, path, min, max };
  STEPPERS[path] = st;
  const lim = () => [typeof st.min === "function" ? st.min() : st.min, typeof st.max === "function" ? st.max() : st.max];
  const commit = (v, quiet) => {
    const [lo, hi] = lim();
    const nv = Math.max(lo, Math.min(hi, v));
    if (nv !== getPath(path)) {
      setPath(path, nv);
      if (!quiet) { SFX.tick(); buzz(6); }
      inp.classList.remove("tick"); void inp.offsetWidth; inp.classList.add("tick");
      onChange?.();
      syncStepper(st);
      return true;
    }
    if (v !== nv && !quiet) { SFX.error(); buzz(25); }
    syncStepper(st);
    return false;
  };
  el.querySelectorAll(".lvl-btn").forEach(b => holdRepeat(b, () => {
    const v = getPath(path), d = +b.dataset.d;
    const nv = step > 1 ? (d > 0 ? Math.floor(v / step) * step + step : Math.ceil(v / step) * step - step) : v + d;
    return commit(nv);
  }));
  inp.addEventListener("focus", () => setTimeout(() => inp.select(), 0));
  inp.addEventListener("change", () => commit(parseNum(inp.value)));
  inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); });
  syncStepper(st);
  return st;
}
function syncStepper(st) {
  const v = getPath(st.path);
  const lo = typeof st.min === "function" ? st.min() : st.min;
  const hi = typeof st.max === "function" ? st.max() : st.max;
  if (document.activeElement !== st.inp) st.inp.value = v;
  st.el.querySelector('[data-d="-1"]').disabled = v <= lo;
  st.el.querySelector('[data-d="1"]').disabled = v >= hi;
}

function bindXp(inp, getLv, path, onChange) {
  const clampXp = v => Math.max(0, Math.min(Math.max(0, xpToNext(getLv()) - 1), v));
  inp.addEventListener("input", () => {
    const raw = parseNum(inp.value), v = clampXp(raw);
    inp.classList.toggle("bad", raw !== v && inp.value.trim() !== "");
    setPath(path, v); onChange?.();
  });
  inp.addEventListener("blur", () => { inp.classList.remove("bad"); inp.value = fmt(getPath(path)); });
  inp.addEventListener("focus", () => { inp.value = getPath(path) || ""; setTimeout(() => inp.select(), 0); });
  inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); });
  return () => {
    setPath(path, clampXp(getPath(path)));
    const lvNeed = xpToNext(getLv());
    inp.disabled = lvNeed === 0;
    if (document.activeElement !== inp) inp.value = lvNeed === 0 ? "MAX" : fmt(getPath(path));
  };
}

// ---------- safe slider ----------
// Only a deliberate sideways drag changes the value, and it moves relative to where
// the drag began (no jumping to the tap point). Taps and vertical scrolls are ignored.
let sliderHintShown = false;
function buildSlider(el, onInput, onCommit) {
  const key = el.dataset.key, min = +el.dataset.min, max = +el.dataset.max, step = +(el.dataset.step || 1);
  el.innerHTML = `<div class="s-track"><div class="s-fill"></div><div class="s-thumb"></div></div><span class="s-val"></span>`;
  const track = el.querySelector(".s-track"), fill = el.querySelector(".s-fill"), thumb = el.querySelector(".s-thumb"), val = el.querySelector(".s-val");
  const paint = () => {
    const f = (S[key] - min) / (max - min);
    fill.style.width = `${f * 100}%`; thumb.style.left = `${f * 100}%`; val.textContent = `${S[key]}%`;
  };
  let mode = null, sx = 0, sy = 0, v0 = 0, w = 1, pid = null, lastBuzz = 0;
  el.addEventListener("pointerdown", e => {
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; v0 = S[key]; w = track.getBoundingClientRect().width || 1;
    mode = e.pointerType === "mouse" ? "drag" : "pending";
    if (mode === "drag") { el.setPointerCapture(pid); el.classList.add("dragging"); }
  });
  el.addEventListener("pointermove", e => {
    if (e.pointerId !== pid || !mode) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode === "pending") {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { mode = null; return; }        // it's a scroll
      if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.4) {                          // deliberate drag
        mode = "drag"; sx = e.clientX; v0 = S[key];
        try { el.setPointerCapture(pid); } catch {}
        el.classList.add("dragging"); buzz(8);
      }
      return;
    }
    let v = v0 + ((e.clientX - sx) / w) * (max - min);
    v = Math.max(min, Math.min(max, Math.round(v / step) * step));
    if (v !== S[key]) {
      S[key] = v; paint(); onInput?.();
      if (Math.abs(v - lastBuzz) >= 5 || v === min || v === max) { buzz(4); lastBuzz = v; }
    }
  });
  const end = e => {
    if (e.pointerId !== pid) return;
    const wasDrag = mode === "drag", moved = Math.hypot(e.clientX - sx, e.clientY - sy);
    mode = null; el.classList.remove("dragging");
    if (wasDrag) { saveState(); onCommit?.(); }
    else if (e.type === "pointerup" && moved < 9) {
      el.classList.remove("nudge"); void el.offsetWidth; el.classList.add("nudge");
      if (!sliderHintShown) { sliderHintShown = true; toast("Drag the slider sideways to change it"); }
    }
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  paint();
  return paint;
}

// ============================================================
// Materials Needed
// ============================================================
let syncNeedXp;
function renderNeedMats() {
  const box = $("#need-mats");
  if (box.contains(document.activeElement)) return;
  box.innerHTML = MATS.map(m => {
    const p = per4(m.id), known = p > 0;
    return `<div class="mat ${known ? "" : "unknown"} ${S.need.mat === m.id ? "selected" : ""}" data-id="${m.id}" style="--mc:${m.c}">
      <div class="m-top">${matIcon(m.id)}<span class="m-name">${m.name}</span></div>
      <span class="check">${ICON.check}</span>
      ${known ? `<span class="m-each"><b>${fmt(p / 4)}</b> XP each · ${fmt(p)}/4</span>`
              : `<input class="set-inline" data-set="${m.id}" placeholder="XP per 4" inputmode="numeric" enterkeyhint="done">`}
      <div class="m-foot">${lockBadge(m.id, S.need.lv, S.need.target)}</div>
    </div>`;
  }).join("");
  box.querySelectorAll(".mat").forEach(el => el.addEventListener("click", e => {
    if (e.target.closest("input")) return;
    const id = el.dataset.id;
    if (per4(id) <= 0) { SFX.error(); buzz(25); el.querySelector("input")?.focus(); return; }
    if (S.need.mat === id) return;
    S.need.mat = id; SFX.select(); buzz(10); saveState(); renderNeed();
  }));
  box.querySelectorAll(".set-inline").forEach(inp => {
    inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); });
    inp.addEventListener("change", () => {
      const v = parseNum(inp.value);
      if (v > 0) { S.per4[inp.dataset.set] = v; saveState(); SFX.select(); toast(`${MAT[inp.dataset.set].name}: ${fmt(v)} XP per 4`); inp.blur(); setTimeout(refreshAll, 0); }
    });
  });
}

function renderNeed() {
  const N = S.need;
  N.lv = Math.max(1, Math.min(MAX_LEVEL - 1, N.lv));
  N.target = Math.max(N.lv + 1, Math.min(MAX_LEVEL, N.target));
  if (per4(N.mat) <= 0) N.mat = MATS.find(m => per4(m.id) > 0)?.id || "steel";
  syncNeedXp?.();
  Object.values(STEPPERS).forEach(syncStepper);

  const need = xpToNext(N.lv);
  $("#need-xp-of").textContent = `/ ${fmt(need)}`;
  $("#need-xp-bar").style.width = `${need ? (N.xp / need) * 100 : 100}%`;

  const startT = totalAt(N.lv, N.xp), endT = totalAt(N.target, 0), xp = endT - startT;
  const m = MAT[N.mat], u = unlockOf(N.mat);
  const route = planRoute(startT, endT, L => (L >= u ? N.mat : bestAt(L, N.mat)));
  const selStep = route.steps.find(st => st.id === N.mat);
  const items = u >= N.target ? 0 : (selStep ? selStep.crafts * 4 : 0);
  const partial = u > N.lv;

  const banner = $("#need-banner");
  if (u >= N.target) {
    banner.className = "banner never";
    banner.innerHTML = `${LOCK_SVG}<span><b>${m.name}</b> unlocks at <b>Lv ${u}</b>${u >= MAX_LEVEL ? " (max level) — it can't be used for levelling" : ` — past your target of Lv ${N.target}`}.</span>`;
  } else if (partial) {
    banner.className = "banner soon";
    banner.innerHTML = `${LOCK_SVG}<span><b>${m.name}</b> unlocks at <b>Lv ${u}</b> — covers Lv ${u} → ${N.target}. Lv ${N.lv} → ${u} needs other materials first.</span>`;
  } else banner.className = "banner hidden";

  const iconBox = $("#need-res-icon");
  if (iconBox.dataset.id !== N.mat) { iconBox.innerHTML = matIcon(N.mat, "lg"); iconBox.dataset.id = N.mat; }
  $("#need-res-label").textContent = partial && u < N.target ? `${m.name} · Lv ${u} → ${N.target}` : `${m.name} needed`;
  $("#need-unit").textContent = m.name.toLowerCase();
  animNum($("#need-count"), items);
  $("#need-sub").innerHTML = `Level <b>${N.lv}</b>${N.xp ? ` (+${fmt(N.xp)} XP)` : ""} → <b>${N.target}</b> · ${fmt(per4(N.mat) / 4)} XP per ${m.name.toLowerCase()}`;
  animNum($("#need-st-xp"), xp);
  $("#need-st-lv").textContent = `+${N.target - N.lv} level${N.target - N.lv === 1 ? "" : "s"}`;
  animNum($("#need-st-crafts"), items / 4);
  $("#need-st-over").textContent = route.stuck ? "—" : `${fmt(Math.max(0, route.cur - endT))} XP`;

  const scaleTop = THEO ? Math.max(GAME_CAP, N.target) : MAX_LEVEL;
  const tot = CUM[scaleTop], a = startT / tot * 100, b = endT / tot * 100;
  $("#need-journey .j-done").style.width = `${a}%`;
  const go = $("#need-journey .j-go"); go.style.left = `${a}%`; go.style.width = `${Math.max(.8, b - a)}%`;
  $("#need-journey .j-labels").innerHTML = `<span>Lv 1</span><span>${a.toFixed(1)}% → ${b.toFixed(1)}% of ${THEO ? `Lv ${scaleTop}` : "max"}</span><span>Lv ${scaleTop}</span>`;

  const fast = planRoute(startT, endT, L => bestAt(L));
  const totalCrafts = fast.steps.reduce((t, st) => t + st.crafts, 0);
  $("#need-route .sub-h").innerHTML = `Fastest route <span class="h-note">${fmt(totalCrafts)} crafts · ${fmt(totalCrafts * 4)} items</span>`;
  $("#need-route .route-list").innerHTML = fast.steps.map(st => `<div class="alt route-step ${st.id === N.mat ? "sel" : ""}">${matIcon(st.id, "sm")}
      <span class="r-txt"><span>${MAT[st.id].name}</span><span class="r-lv">Lv ${st.fromL} → ${st.toL}</span></span>
      <span class="a-n">${fmt(st.crafts * 4)}</span><span class="a-u">${fmt(st.crafts)} crafts</span></div>`).join("")
    + (fast.stuck ? `<div class="res-sub warn">No unlocked material with a known XP value at Lv ${levelFromTotal(fast.cur).lv}.</div>` : "");

  $("#need-alt").innerHTML = MATS.filter(x => x.id !== N.mat).map(x => {
    const ux = unlockOf(x.id);
    if (per4(x.id) <= 0) return `<div class="alt dim" data-id="${x.id}">${matIcon(x.id, "sm")}<span>${x.name}</span><span class="a-n">?</span><span class="a-u">unknown</span></div>`;
    if (ux >= N.target) return `<div class="alt dim" data-id="${x.id}">${matIcon(x.id, "sm")}<span>${x.name}</span>${lockBadge(x.id, N.lv, N.target)}<span class="a-n">—</span><span class="a-u">locked</span></div>`;
    const n = itemsFor(endT - Math.max(startT, CUM[ux]), x.id);
    return `<div class="alt" data-id="${x.id}">${matIcon(x.id, "sm")}<span>${x.name}</span>${ux > N.lv ? lockBadge(x.id, N.lv, N.target) : ""}
      <span class="a-n">${fmt(n)}</span><span class="a-u">${ux > N.lv ? `Lv ${ux}→${N.target}` : `${fmt(n / 4)} crafts`}</span></div>`;
  }).join("");
  $$("#need-alt .alt").forEach(el => el.addEventListener("click", () => {
    if (per4(el.dataset.id) <= 0) { SFX.error(); return; }
    S.need.mat = el.dataset.id; SFX.select(); buzz(10); saveState(); renderNeed();
  }));

  $("#peek-needed").innerHTML = `${matIcon(N.mat, "sm")}<b>${fmt(items)}</b> ${m.name.toLowerCase()}<span class="p-dim">· ${fmt(items / 4)} crafts</span><span class="p-arrow">↓</span>`;

  renderNeedMats();
  if (!$("#need-bd").classList.contains("hidden")) renderBreakdown();
  if (activeTab === "table") renderTable();
}

function renderBreakdown() {
  const N = S.need;
  let cum = 0, cumSel = 0, rows = "";
  for (let L = N.lv; L < N.target; L++) {
    let x = xpToNext(L); if (L === N.lv) x -= N.xp;
    cum += x;
    const ok = usableAt(N.mat, L);
    if (ok) cumSel += x;
    rows += `<tr><td><span class="lvl-pill">${L}<span class="arrow">→</span>${L + 1}</span></td>
      <td class="r">${fmt(x)}</td><td class="r">${fmt(cum)}</td>
      <td class="r"><b>${ok ? fmt(itemsFor(cumSel, N.mat) ?? 0) : `<span class="lock soon">${LOCK_SVG}${unlockOf(N.mat)}</span>`}</b></td></tr>`;
  }
  $("#need-bd").innerHTML = `<div class="tbl-wrap"><table>
    <thead><tr><th>Lv</th><th class="r">XP</th><th class="r">Total</th><th class="r">${MAT[N.mat].name}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// ============================================================
// Level Projection
// ============================================================
let syncProjXp, projLv = 1;
function renderProjMats() {
  $("#proj-mats").innerHTML = MATS.map(m => {
    const p = per4(m.id);
    return `<div class="inv ${p > 0 ? "" : "unknown"}" data-id="${m.id}" style="--mc:${m.c}">
      <div class="i-top">${matIcon(m.id)}
        <div class="m-txt"><div class="m-name">${m.name}<span class="lb" data-lb="${m.id}"></span></div><div class="m-sub">${p > 0 ? `${fmt(p / 4)} XP each` : "XP unknown — set in Settings"}</div></div>
        <div class="contrib" data-c="${m.id}"></div>
      </div>
      <div class="i-ctl">
        <div class="num" data-bind="proj.counts.${m.id}"></div>
        <div class="q"><button class="qchip" data-q="16">+16</button><button class="qchip" data-q="64">+64</button></div>
      </div>
    </div>`;
  }).join("");
  $$("#proj-mats .num").forEach(el => buildStepper(el, { min: 0, max: 9999999, step: 4, onChange: () => { saveState(); renderProj(); } }));
  $$("#proj-mats .inv").forEach(row => row.querySelectorAll(".qchip").forEach(b => b.addEventListener("click", () => {
    const id = row.dataset.id;
    S.proj.counts[id] = Math.min(9999999, (S.proj.counts[id] || 0) + +b.dataset.q);
    SFX.pop(); buzz(6); saveState(); renderProj();
  })));
}

function renderProj() {
  const P = S.proj;
  P.lv = Math.max(1, Math.min(MAX_LEVEL, P.lv));
  syncProjXp?.();
  Object.values(STEPPERS).forEach(syncStepper);
  const need0 = xpToNext(P.lv);
  $("#proj-xp-of").textContent = need0 ? `/ ${fmt(need0)}` : "";
  $("#proj-xp-bar").style.width = `${need0 ? (P.xp / need0) * 100 : 100}%`;

  const start = totalAt(P.lv, P.xp);
  const used = Object.fromEntries(MATS.map(m => [m.id, false]));
  let cur = start, changed = true;
  while (changed) {
    changed = false;
    const L = levelFromTotal(cur).lv;
    for (const m of MATS) {
      if (used[m.id] || !usableAt(m.id, L) || !(P.counts[m.id] > 0)) continue;
      used[m.id] = true; changed = true; cur += xpFromItems(P.counts[m.id], m.id);
    }
  }
  let gained = 0;
  const parts = [];
  for (const m of MATS) {
    const n = P.counts[m.id] || 0, x = used[m.id] ? xpFromItems(n, m.id) : 0;
    gained += x;
    if (x > 0) parts.push({ m, x });
    const c = $(`.contrib[data-c="${m.id}"]`);
    const lockedOut = n > 0 && per4(m.id) > 0 && !used[m.id];
    if (c) c.innerHTML = per4(m.id) <= 0 ? "?" : !n ? "—"
      : lockedOut ? `<span class="spare">${LOCK_SVG} unused<br>needs Lv ${unlockOf(m.id)}</span>`
      : `<b>+${fmt(x)}</b> XP${n % 4 ? `<br><span class="spare">${n % 4} spare</span>` : ""}`;
    const row = c?.closest(".inv");
    row?.classList.toggle("has", n > 0 && !lockedOut);
    row?.classList.toggle("locked-out", lockedOut);
    const lb = $(`[data-lb="${m.id}"]`);
    if (lb) lb.innerHTML = lockBadge(m.id, P.lv);
  }
  const end = start + gained;
  const { lv, rem } = levelFromTotal(end);
  const atMax = lv >= MAX_LEVEL, need = xpToNext(lv);
  projLv = lv;

  animNum($("#proj-lv"), lv);
  const frac = atMax ? 1 : rem / need;
  $("#proj-ring").style.strokeDashoffset = (326.7 * (1 - frac)).toFixed(1);
  const d = lv - P.lv, g = $("#proj-gain");
  g.className = "gain" + (atMax ? " max" : d ? "" : " none");
  g.textContent = atMax ? "MAX LEVEL" : d ? `+${d} level${d === 1 ? "" : "s"}` : "No level-up yet";
  $("#proj-into").innerHTML = atMax
    ? `${rem > 0 ? `<span class="warn">${fmt(rem)} XP over max (wasted)</span><br>` : ""}Needed only <b>${fmt(CUM[MAX_LEVEL] - start)}</b> XP to cap.`
    : `<b>${fmt(rem)}</b> / ${fmt(need)} XP into Lv ${lv}<br>${(frac * 100).toFixed(1)}% to Lv ${lv + 1}`;
  animNum($("#proj-st-gain"), gained);
  animNum($("#proj-st-total"), end);

  $("#proj-mix").innerHTML = parts.length
    ? `<div class="mix-bar">${parts.map(p => `<i style="flex-grow:${p.x};background:${p.m.c}"></i>`).join("")}</div>
       <div class="mix-legend">${parts.map(p => `<span><i style="background:${p.m.c}"></i>${p.m.name} ${(p.x / gained * 100).toFixed(0)}%</span>`).join("")}</div>`
    : `<div class="res-sub">Add materials above to see where they'll take you.</div>`;

  if (atMax) { $("#proj-next-h").textContent = "Maxed out"; $("#proj-next").innerHTML = ""; }
  else {
    const toNext = need - rem;
    $("#proj-next-h").textContent = `To Lv ${lv + 1} — ${fmt(toNext)} XP more`;
    $("#proj-next").innerHTML = MATS.map(m => {
      const n = itemsFor(toNext, m.id);
      if (n != null && !usableAt(m.id, lv)) return `<div class="alt dim">${matIcon(m.id, "sm")}<span>${m.name}</span>${lockBadge(m.id, lv)}<span class="a-n">—</span><span class="a-u">locked</span></div>`;
      return `<div class="alt ${n == null ? "dim" : ""}">${matIcon(m.id, "sm")}<span>${m.name}</span><span class="a-n">${n == null ? "?" : fmt(n)}</span><span class="a-u">${n == null ? "unknown" : "more"}</span></div>`;
    }).join("");
  }
  $("#peek-proj").innerHTML = `<span class="p-dim">Level</span><b>${lv}</b><span class="p-dim">· ${atMax ? "max" : d ? `+${d} level${d === 1 ? "" : "s"}` : `${(frac * 100).toFixed(0)}% to ${lv + 1}`}</span><span class="p-arrow">↓</span>`;
}

// ============================================================
// XP Table
// ============================================================
function renderTable() {
  const N = S.need, m = MAT[N.mat];
  let rows = "";
  const rowsTo = THEO ? Math.min(THEO_CAP, Math.max(50, N.target + 10)) : MAX_LEVEL;
  for (let L = 1; L < rowsTo; L++) {
    const x = xpToNext(L);
    const inR = L >= N.lv && L < N.target;
    const tag = L === N.lv ? `<span class="tag">start</span>` : L === N.target - 1 ? `<span class="tag">target</span>` : "";
    rows += `<tr data-l="${L}" class="${inR ? "in-range" : ""}">
      <td><span class="lvl-pill">${L}<span class="arrow">→</span>${L + 1}</span>${tag}</td>
      <td class="r">${fmt(x)}</td><td class="r">${fmt(CUM[L + 1])}</td>
      <td class="r dimc">${itemsFor(x, N.mat) == null ? "?" : usableAt(N.mat, L) ? fmt(itemsFor(x, N.mat)) : `<span class="lock soon">${LOCK_SVG}${unlockOf(N.mat)}</span>`}</td></tr>`;
    const unl = MATS.filter(mm => unlockOf(mm.id) === L + 1 && L + 1 > 1 && L + 1 < MAX_LEVEL);
    if (unl.length) rows += `<tr class="tagrow"><td colspan="4">${unl.map(mm => `<span class="unl" style="--mc:${mm.c}">${matIcon(mm.id, "sm")}${mm.name} unlocks at Lv ${L + 1}</span>`).join("")}</td></tr>`;
  }
  const t = $("#xp-table");
  t.innerHTML = `<thead><tr><th>Level</th><th class="r">XP</th><th class="r">Total</th><th class="r">${m.name}</th></tr></thead><tbody>${rows}</tbody>`;
  t.querySelectorAll("tbody tr[data-l]").forEach(tr => {
    const L = +tr.dataset.l;
    pressable(tr, {
      onTap: () => {
        S.need.target = L + 1; if (S.need.lv > L) { S.need.lv = L; S.need.xp = 0; }
        toast(`Target set to Lv ${L + 1}`); SFX.select(); buzz(10); saveState(); renderNeed(); renderTable();
        $(`#xp-table tr[data-l="${L}"]`)?.classList.add("flash");
      },
      onHold: () => {
        S.need.lv = L; S.need.xp = 0; if (S.need.target <= L) S.need.target = L + 1;
        toast(`Start set to Lv ${L}`); SFX.select(); saveState(); renderNeed(); renderTable();
        $(`#xp-table tr[data-l="${L}"]`)?.classList.add("flash");
      },
    });
  });
}

// ============================================================
// Pager (swipe between tabs) + bottom nav
// ============================================================
let activeTab = "needed", tabIdx = 0;
function setTrack(px, anim) {
  const track = $("#track"), W = $("#pager").clientWidth;
  track.classList.toggle("anim", !!anim && S.anim);
  track.style.transform = `translate3d(${-tabIdx * W + px}px,0,0)`;
  const pill = $("#nav-pill"), nw = $("#nav").clientWidth / 4;
  pill.style.transition = anim && S.anim ? "transform .34s var(--ease)" : "none";
  pill.style.transform = `translateX(${(tabIdx - px / W) * nw}px)`;
}
function goTab(t, { silent = false, anim = true } = {}) {
  const i = Math.max(0, Math.min(TABS.length - 1, typeof t === "number" ? t : TABS.indexOf(t)));
  const changed = i !== tabIdx;
  tabIdx = i; activeTab = TABS[i]; S.tab = activeTab;
  setTrack(0, anim);
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === activeTab));
  $("#tb-sub").textContent = TAB_NAMES[activeTab];
  if (activeTab === "table") renderTable();
  if (activeTab === "settings") renderSettingsPanel();
  if (changed && !silent) { SFX.tab(); buzz(6); saveState(); }
  document.activeElement?.blur?.();
}
function setupSwipe() {
  const pager = $("#pager");
  let sx = 0, sy = 0, st = 0, mode = null, dx = 0, W = 1;
  pager.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) { mode = null; return; }
    const t = e.target;
    if (String(window.getSelection?.() || "").trim() || t.closest(".slider, .no-swipe") || (t.tagName === "INPUT" && t === document.activeElement)) { mode = null; return; }
    const p = e.touches[0];
    sx = p.clientX; sy = p.clientY; st = performance.now(); mode = "pending"; dx = 0; W = pager.clientWidth;
  }, { passive: true });
  pager.addEventListener("touchmove", e => {
    if (!mode) return;
    const p = e.touches[0];
    const mx = p.clientX - sx, my = p.clientY - sy;
    if (mode === "pending") {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { mode = null; return; }
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) { mode = "swipe"; sx = p.clientX; document.activeElement?.blur?.(); }
      else return;
    }
    dx = p.clientX - sx;
    if ((tabIdx === 0 && dx > 0) || (tabIdx === TABS.length - 1 && dx < 0)) dx *= .28;   // edge resistance
    setTrack(dx, false);
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  const end = () => {
    if (mode !== "swipe") { mode = null; return; }
    mode = null;
    const v = dx / Math.max(1, performance.now() - st);
    let next = tabIdx;
    if (dx < -W * 0.22 || v < -0.45) next++;
    else if (dx > W * 0.22 || v > 0.45) next--;
    next = Math.max(0, Math.min(TABS.length - 1, next));
    if (next === tabIdx) setTrack(0, true); else goTab(next);
  };
  pager.addEventListener("touchend", end);
  pager.addEventListener("touchcancel", end);
  window.addEventListener("resize", () => setTrack(0, false));
}

// floating result summary, shown while the result card is scrolled out of view
function setupPeek(scrollId, resultId, peekId) {
  const scroller = $(scrollId), result = $(resultId), peek = $(peekId);
  const io = new IntersectionObserver(([en]) => {
    const below = en.boundingClientRect.top > (en.rootBounds?.bottom ?? innerHeight) - 40;
    peek.classList.toggle("show", !en.isIntersecting && below);
  }, { root: scroller, threshold: 0, rootMargin: "0px 0px -60px 0px" });
  io.observe(result);
  peek.addEventListener("click", () => {
    buzz(8); SFX.click();
    scroller.scrollTo({ top: result.offsetTop - 12, behavior: S.anim ? "smooth" : "auto" });
  });
}

// ============================================================
// Toast, sparks
// ============================================================
let toastT = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.classList.remove("hidden", "hiding");
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.classList.add("hiding"); setTimeout(() => el.classList.add("hidden"), 300); }, 1800);
}
function sparksAt(el, count = 24) {
  if (!S.anim || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const host = $("#sparks");
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.4, d = 40 + Math.random() * 90;
    s.style.left = cx + "px"; s.style.top = cy + "px";
    s.style.setProperty("--x", `${Math.cos(a) * d}px`);
    s.style.setProperty("--y", `${Math.sin(a) * d + 40 + Math.random() * 40}px`);
    s.style.setProperty("--d", `${.45 + Math.random() * .5}s`);
    const sz = 2 + Math.random() * 3; s.style.width = s.style.height = sz + "px";
    host.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
}
function strike(card, iconEl, sound) {
  sound(); buzz(30); setTimeout(() => buzz(18), 160); setTimeout(() => buzz(24), 340);
  card.classList.remove("struck"); void card.offsetWidth; card.classList.add("struck");
  sparksAt(iconEl);
}

// ============================================================
// Settings
// ============================================================
const sliderPaint = {};
function renderSettingsPanel() {
  Object.values(sliderPaint).forEach(p => p());
  $("#set-mute").checked = S.muted;
  $("#set-haptics").checked = S.haptics;
  $("#theme-dark").classList.toggle("active", S.theme === "dark");
  $("#theme-light").classList.toggle("active", S.theme === "light");
  $("#set-glow").checked = S.glow;
  $("#set-anim").checked = S.anim;
  $("#swatches").innerHTML = ACCENTS.map(c => `<button class="sw ${c.toLowerCase() === S.accent.toLowerCase() ? "active" : ""}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("");
  $$("#swatches .sw").forEach(b => b.addEventListener("click", () => { S.accent = b.dataset.c; applyAppearance(); renderSettingsPanel(); SFX.click(); buzz(8); saveState(); }));
  if (!$("#set-mats").contains(document.activeElement)) {
    $("#set-mats").innerHTML = MATS.map(m => `<div class="set-mat">${matIcon(m.id, "sm")}<span>${m.name}</span>
      <label class="sm-lv">Lv<input class="set-inline" data-u="${m.id}" value="${unlockOf(m.id)}" inputmode="numeric" enterkeyhint="done"></label>
      <input class="set-inline" data-m="${m.id}" value="${per4(m.id) || ""}" placeholder="unknown" inputmode="numeric" enterkeyhint="done"></div>`).join("");
    $$("#set-mats .set-inline").forEach(inp => {
      inp.addEventListener("focus", () => setTimeout(() => inp.select(), 0));
      inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); });
      inp.addEventListener("change", () => {
        if (inp.dataset.u) S.unlock[inp.dataset.u] = Math.max(1, Math.min(GAME_CAP, parseNum(inp.value) || 1));
        else S.per4[inp.dataset.m] = parseNum(inp.value);
        saveState(); SFX.click(); refreshAll();
      });
      inp.addEventListener("blur", () => setTimeout(() => { if (!$("#set-mats").contains(document.activeElement)) renderSettingsPanel(); }, 0));
    });
  }
}
function refreshAll() { renderNeed(); renderProjMats(); renderProj(); if (activeTab === "table") renderTable(); }

// Accidental-tap guard: a "click" only counts if the finger stayed put and nothing scrolled
// during the touch (or was still coasting from a fling when it landed).
function setupTapGuard() {
  let dx = 0, dy = 0, down = false, scrolled = false, lastScroll = 0, downAt = 0;
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    down = true; scrolled = false; dx = e.clientX; dy = e.clientY; downAt = performance.now();
    if (downAt - lastScroll < 140) scrolled = true;          // touched to stop a fling
  }, true);
  document.addEventListener("pointermove", e => {
    if (down && Math.hypot(e.clientX - dx, e.clientY - dy) > 10) scrolled = true;
  }, true);
  document.addEventListener("scroll", () => { lastScroll = performance.now(); if (down) scrolled = true; }, true);
  document.addEventListener("pointerup", () => { down = false; }, true);
  document.addEventListener("click", e => {
    if (e.pointerType === "mouse" || e.detail === 0) return;   // keyboard / programmatic clicks
    if (scrolled) { e.preventDefault(); e.stopPropagation(); scrolled = false; }
  }, true);
}

// ============================================================
// Theoretical mode (lifts the Lv 35 cap; off on every launch)
// ============================================================
function setTheo(on, quiet) {
  THEO = !!on;
  MAX_LEVEL = THEO ? THEO_CAP : GAME_CAP;
  document.body.classList.toggle("theo", THEO);
  const btn = $("#btn-theo");
  btn.classList.toggle("on", THEO);
  btn.setAttribute("aria-pressed", THEO);
  btn.querySelector(".tt-label").textContent = THEO ? "Theoretical · no cap" : "Theoretical";
  const mx = $('.qchip[data-add="max"]'); if (mx) mx.textContent = THEO ? "+25" : "Max";
  if (!THEO) {   // snap everything back inside the real cap
    S.need.lv = Math.min(S.need.lv, GAME_CAP - 1);
    S.need.target = Math.min(S.need.target, GAME_CAP);
    if (S.need.lv >= GAME_CAP - 1) S.need.xp = Math.min(S.need.xp, Math.max(0, xpToNext(S.need.lv) - 1));
    S.proj.lv = Math.min(S.proj.lv, GAME_CAP);
    if (S.proj.lv >= GAME_CAP) S.proj.xp = 0;
  }
  refreshAll();
  if (activeTab === "table") renderTable();
  if (!quiet) {
    toast(THEO ? `Theoretical mode — level cap lifted (up to Lv ${THEO_CAP})` : "Back to the real Lv 35 cap");
    THEO ? SFX.select() : SFX.close();
    buzz(14);
  }
}


// ============================================================
// Copyable numbers: drag/long-press to select, or click/tap a number to copy it
// ============================================================
const COPY_SEL = ".res-big span, .stat b, .alt .a-n, .ring-in b";
function copyText(t) {
  try { if (window.Android && window.Android.copy) { window.Android.copy(t); return true; } } catch {}
  try { navigator.clipboard?.writeText(t).catch(() => {}); } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  } catch {}
  return true;
}
function setupCopy() {
  document.addEventListener("click", e => {
    const el = e.target.closest(COPY_SEL);
    if (!el) return;
    const sel = String(window.getSelection?.() || "");
    if (sel.trim()) return;                       // user is selecting text — leave it alone
    const shown = el.textContent.trim();
    const raw = shown.replace(/[^\d.]/g, "").replace(/^\./, "");
    if (!/\d/.test(raw)) return;
    e.stopPropagation(); e.preventDefault();      // don't also trigger the row's own click
    copyText(raw);
    el.classList.remove("copied"); void el.offsetWidth; el.classList.add("copied");
    toast(`Copied ${shown}`);
    try { SFX.pop(); } catch {}
    try { typeof buzz === "function" && buzz(10); } catch {}
  }, true);
  // titles for discoverability
  const tag = () => document.querySelectorAll(COPY_SEL).forEach(el => { if (!el.title) el.title = "Click to copy · drag to select"; });
  new MutationObserver(tag).observe(document.body, { childList: true, subtree: true });
  tag();
}

// Android back button
window.__onBack = () => {
  if (document.activeElement && document.activeElement.tagName === "INPUT") { document.activeElement.blur(); return true; }
  if (tabIdx !== 0) { goTab(0); return true; }
  flushSave();
  return false;
};
window.__onPause = () => flushSave();

// ============================================================
// Wire up
// ============================================================
window.addEventListener("DOMContentLoaded", () => {
  loadState();
  applyAppearance();

  // Needed
  buildStepper($('[data-bind="need.lv"]'), { min: 1, max: () => MAX_LEVEL - 1, onChange: () => { if (S.need.target <= S.need.lv) S.need.target = S.need.lv + 1; saveState(); renderNeed(); } });
  buildStepper($('[data-bind="need.target"]'), { min: () => S.need.lv + 1, max: () => MAX_LEVEL, onChange: () => { saveState(); renderNeed(); } });
  syncNeedXp = bindXp($("#need-xp"), () => S.need.lv, "need.xp", () => { saveState(); renderNeed(); });
  $$(".quick .qchip").forEach(b => b.addEventListener("click", () => {
    const a = b.dataset.add;
    S.need.target = a === "max" ? (THEO ? Math.min(MAX_LEVEL, S.need.target + 25) : MAX_LEVEL) : Math.min(MAX_LEVEL, S.need.lv + +a);
    SFX.pop(); buzz(6); saveState(); renderNeed();
  }));
  $("#need-calc").addEventListener("click", () => strike($("#need-result"), $("#need-res-icon"), SFX.forge3));
  $("#need-bd-toggle").addEventListener("click", e => {
    const body = $("#need-bd"), open = body.classList.toggle("hidden") === false;
    e.currentTarget.classList.toggle("open", open);
    if (open) renderBreakdown();
    open ? SFX.open() : SFX.close(); buzz(6);
  });

  // Projection
  buildStepper($('[data-bind="proj.lv"]'), { min: 1, max: () => MAX_LEVEL, onChange: () => { saveState(); renderProj(); } });
  syncProjXp = bindXp($("#proj-xp"), () => S.proj.lv, "proj.xp", () => { saveState(); renderProj(); });
  $("#proj-clear").addEventListener("click", () => { MATS.forEach(m => S.proj.counts[m.id] = 0); SFX.close(); buzz(10); saveState(); renderProj(); });
  $("#proj-calc").addEventListener("click", () => {
    renderProj();
    strike($("#proj-result"), $(".ring"), projLv > S.proj.lv ? SFX.levelup : SFX.forge);
  });

  // Settings
  $$(".slider").forEach(el => {
    const k = el.dataset.key;
    const after = { brightness: applyAppearance, zoom: applyAppearance }[k];
    const commitSfx = { volume: SFX.select, volUI: SFX.click, volForge: SFX.forge }[k];
    sliderPaint[k] = buildSlider(el, after, () => commitSfx?.());
  });
  $("#set-mute").addEventListener("change", e => { S.muted = e.target.checked; saveState(); if (!S.muted) SFX.click(); buzz(8); });
  $("#set-haptics").addEventListener("change", e => { S.haptics = e.target.checked; saveState(); SFX.click(); buzz(15); });
  $("#theme-dark").addEventListener("click", () => { S.theme = "dark"; applyAppearance(); renderSettingsPanel(); SFX.click(); buzz(8); saveState(); });
  $("#theme-light").addEventListener("click", () => { S.theme = "light"; applyAppearance(); renderSettingsPanel(); SFX.click(); buzz(8); saveState(); });
  $("#set-glow").addEventListener("change", e => { S.glow = e.target.checked; applyAppearance(); SFX.click(); buzz(8); saveState(); });
  $("#set-anim").addEventListener("change", e => { S.anim = e.target.checked; applyAppearance(); SFX.click(); buzz(8); saveState(); });
  $("#btn-reset-mats").addEventListener("click", () => { S.per4 = structuredClone(DEFAULTS.per4); S.unlock = structuredClone(DEFAULTS.unlock); saveState(); refreshAll(); renderSettingsPanel(); SFX.click(); buzz(10); toast("Materials reset"); });
  $("#btn-reset-all").addEventListener("click", () => {
    const keep = { need: S.need, proj: S.proj, per4: S.per4, unlock: S.unlock, tab: S.tab };
    S = { ...structuredClone(DEFAULTS), ...keep };
    applyAppearance(); renderSettingsPanel(); refreshAll(); SFX.click(); buzz(10); toast("Settings reset"); saveState();
  });

  $$(".nav-btn").forEach(b => b.addEventListener("click", () => goTab(b.dataset.tab)));
  $("#btn-theo").addEventListener("click", () => setTheo(!THEO));
  setupSwipe();
  setupPeek("#scroll-needed", "#need-result", "#peek-needed");
  setupPeek("#scroll-proj", "#proj-result", "#peek-proj");

  // hide the bottom bar while the keyboard is up
  const baseH = window.innerHeight;
  window.addEventListener("resize", () => document.body.classList.toggle("kb", window.innerHeight < baseH - 150));
  // make sure focused inputs aren't hidden behind the keyboard (scroll only the panel, never the pager)
  document.addEventListener("focusin", e => {
    if (e.target.tagName !== "INPUT") return;
    setTimeout(() => {
      const sc = e.target.closest(".scroll"); if (!sc) return;
      const r = e.target.getBoundingClientRect(), sr = sc.getBoundingClientRect();
      if (r.top < sr.top + 20 || r.bottom > sr.bottom - 20) sc.scrollBy({ top: r.top - sr.top - sr.height / 2 + r.height / 2, behavior: "smooth" });
    }, 300);
  });
  $("#pager").addEventListener("scroll", e => { e.currentTarget.scrollLeft = 0; });
  setupTapGuard();
  setupCopy();
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });
  // unlock audio on the first touch
  window.addEventListener("pointerdown", () => { try { ac(); } catch {} }, { once: true });

  renderProjMats();
  renderNeed(); renderProj();
  goTab(S.tab, { silent: true, anim: false });
});
