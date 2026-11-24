"use strict";
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Effetti ---------- */
const Sfx = (() => {
  let ctx; const bufs = {};
  const DUR = { "lavare.mp3": 15300, "mcdonalds.mp3": 15600, "paolovallebona.mp3": 19600, "simone-encounter.mp3": 14000, "simone-song.mp3": 11100, "zara.mp3": 16000, "vecchio-cussorgia.mp3": 10500, "simone-lost.mp3": 14000, "narcao.mp3": 14800, "ponzu.mp3": 14900, "tonnara.mp3": 14800, "nuxis.mp3": 16400 };
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  const blip = (f, d, type = "square", v = 0.05, when = 0, slideTo = 0) => {
    if (typeof Q !== "undefined" && Q.fast) return;
    try {
      const a = ac(), o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(a.destination);
      const t = a.currentTime + when; if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o.stop(t + d);
    } catch (e) {}
  };
  return {
    tick: () => blip(300 + Math.random() * 300, 0.05),
    step: () => blip(520, 0.07, "triangle", 0.06),
    card: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.25, "triangle", 0.08, i * 0.09)),
    win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => blip(f, 0.3, "triangle", 0.1, i * 0.14)),
    coin: () => { blip(988, 0.08, "square", 0.05); blip(1319, 0.2, "square", 0.05, 0.08); },
    zone: () => { blip(98, 2.2, 'sine', 0.14); blip(147, 2.2, 'sine', 0.1, 0.1); blip(196, 2.2, 'triangle', 0.06, 0.2); },
    hit: () => blip(220, 0.25, "sawtooth", 0.1, 0, 60),
    heal: () => [392, 523, 659].forEach((f, i) => blip(f, 0.2, "sine", 0.08, i * 0.1)),
    clock: () => blip(880, 0.07, "square", 0.07),
    warn: () => [660, 520, 660, 520].forEach((f, i) => blip(f, 0.15, "square", 0.06, i * 0.16)),
    death: () => [440, 392, 330, 262, 196].forEach((f, i) => blip(f, 0.3, "sawtooth", 0.08, i * 0.2)),
    splat: () => blip(140, 0.35, "sawtooth", 0.12, 0, 40),
    zara() { return Sfx.play("sfx/zara.mp3", 0.9); },
    play(url, vol = 0.95) {          // file audio via WebAudio (funziona anche su iPhone). Promise risolta dopo la durata nota del file; .stop() la interrompe
      if (typeof Q !== "undefined" && Q.fast) { const r0 = Promise.resolve(); r0.stop = () => {}; return r0; }
      let node = null, au = null, fin = () => {}, stopped = false;
      const pr = new Promise((res) => {
        fin = res; setTimeout(res, DUR[url.split("/").pop()] || 1500);
        (async () => {
          try {
            const c = ac(); if (c.state !== "running") await c.resume();
            const buf = await Sfx.load(url); if (stopped) return;
            const g = c.createGain(); g.gain.value = vol; g.connect(c.destination);
            node = c.createBufferSource(); node.buffer = buf; node.connect(g); node.start();
          } catch (e) { try { au = new Audio(url); au.volume = vol; au.play().catch(() => {}); } catch (e2) {} }
        })();
      });
      pr.stop = () => { stopped = true; try { if (node) node.stop(); if (au) au.pause(); } catch (e) {} fin(); };
      return pr;
    },
    load(url) { return (bufs[url] ||= fetch(url).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, ko) => ac().decodeAudioData(b, ok, ko)))); },
    preload() { Object.keys(DUR).forEach((f) => Sfx.load("sfx/" + f).catch(() => { delete bufs["sfx/" + f]; })); },
    noise(dur = 0.5, type = "bandpass", f0 = 800, f1 = 800, vol = 0.2, when = 0) {   // rumore filtrato con sweep di frequenza
      if (typeof Q !== "undefined" && Q.fast) return;
      try {
        const a2 = ac(), len = Math.floor(a2.sampleRate * dur), buf = a2.createBuffer(1, len, a2.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const s = a2.createBufferSource(), f = a2.createBiquadFilter(), g = a2.createGain(), t = a2.currentTime + when;
        s.buffer = buf; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = 1.2;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(a2.destination); s.start(t);
      } catch (e) {}
    },
    whoosh() { this.noise(0.9, "bandpass", 300, 3000, 0.28); },
    slap() { this.noise(0.12, "highpass", 1500, 900, 0.3); blip(180, 0.15, "square", 0.08, 0, 60); },
    rumble() { this.noise(2.0, "lowpass", 160, 40, 0.5); },
    sizzle() { this.noise(0.9, "highpass", 3500, 5000, 0.12); },
    chime() { [880, 1175, 1568].forEach((f, i) => blip(f, 0.5, "sine", 0.07, i * 0.12)); },
    coinRain() { for (let i = 0; i < 6; i++) blip(1200 + Math.random() * 600, 0.1, "square", 0.04, i * 0.07); },
    engine(sec = 2) { try { const a2 = ac(), o = a2.createOscillator(), l = a2.createOscillator(), lg = a2.createGain(), g = a2.createGain(), t = a2.currentTime; o.type = "sawtooth"; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(130, t + sec); l.frequency.value = 22; lg.gain.value = 18; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.2); g.gain.linearRampToValueAtTime(0.0001, t + sec); o.connect(g); g.connect(a2.destination); o.start(t); l.start(t); o.stop(t + sec); l.stop(t + sec); } catch (e) {} },
    horn() { blip(300, 0.35, "sawtooth", 0.08); blip(400, 0.35, "sawtooth", 0.06, 0.05); },
    ctx: ac,
  };
})();

/* ---------- Musica ----------
   Usa i file in music/ (loop senza stacchi via WebAudio). Se non ce ne sono, genera un tema sardo. */
const Music = (() => {
  let on = false, files = [], idx = 0, src = null, gain = null, genTimer = null, drone = null, master = null, ducked = false, held = false, holdOwner = null;
  let vol = parseFloat(localStorage.getItem("sulcis_vol") ?? "0.5"); const base = () => (held ? 0 : 1.1 * vol * (ducked ? 0.2 : 1));
  const cache = {}, D = 146.83, SCALE = [0, 2, 3, 5, 7, 9, 10, 12, 14];
  async function loadFiles() { try { files = ["music/main-menu.mp3"]; } catch (e) { files = []; } }
  async function playFile() {
    const a = Sfx.ctx(); if (a.state === "suspended") await a.resume();
    const url = files[idx % files.length];
    if (!cache[url]) cache[url] = await a.decodeAudioData(await (await fetch(url)).arrayBuffer());
    if (!on) return;
    stopFile(); gain = a.createGain(); gain.gain.value = base(); gain.connect(a.destination);
    src = a.createBufferSource(); src.buffer = cache[url]; src.loop = true; src.connect(gain); src.start();
  }
  function stopFile() { if (src) { try { src.stop(); } catch (e) {} src = null; } }
  function startGen() {
    const a = Sfx.ctx(); master = a.createGain(); master.gain.value = base(); master.connect(a.destination);
    drone = [D / 2, (D / 2) * 1.5, D].map((f, i) => {
      const o = a.createOscillator(), g = a.createGain(), fl = a.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = i * 4 - 4; fl.type = "lowpass"; fl.frequency.value = 500; g.gain.value = 0.03;
      o.connect(fl); fl.connect(g); g.connect(master); o.start(); return o;
    });
    let deg = 4, beat = 0;
    const note = () => {
      if (!on) return;
      deg = Math.max(0, Math.min(SCALE.length - 1, deg + [-2, -1, -1, 0, 1, 1, 2][(Math.random() * 7) | 0]));
      const f = D * 2 * Math.pow(2, SCALE[deg] / 12), len = [0.25, 0.25, 0.5, 0.5, 1][(Math.random() * 5) | 0];
      const o = a.createOscillator(), g = a.createGain(), fl = a.createBiquadFilter(), t = a.currentTime;
      o.type = "sawtooth"; o.frequency.value = f; fl.type = "bandpass"; fl.frequency.value = f * 2; fl.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.5 + 0.1);
      o.connect(fl); fl.connect(g); g.connect(master); o.start(t); o.stop(t + len * 0.5 + 0.15);
      if (beat++ % 4 === 0) { const k = a.createOscillator(), kg = a.createGain(); k.frequency.setValueAtTime(110, t); k.frequency.exponentialRampToValueAtTime(40, t + 0.2); kg.gain.setValueAtTime(0.15, t); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); k.connect(kg); kg.connect(master); k.start(t); k.stop(t + 0.3); }
      genTimer = setTimeout(note, len * 450);
    };
    note();
  }
  function stopGen() { clearTimeout(genTimer); (drone || []).forEach((o) => { try { o.stop(); } catch (e) {} }); drone = null; }
  const api = {
    async start() {
      if (on) return; on = true; $("#btnMusic").textContent = "🎵";
      if (!files.length) await loadFiles();
      if (files.length) playFile().catch(() => {}); else startGen();
    },
    stop() { on = false; $("#btnMusic").textContent = "🔇"; stopFile(); stopGen(); },
    toggle() { on ? api.stop() : api.start(); },
    next() { if (on && files.length > 1) { idx++; playFile().catch(() => {}); } },
    get owner() { return holdOwner; },
    hold(on, who) { held = on; holdOwner = on ? who || "" : null; if (gain) gain.gain.value = base(); if (master) master.gain.value = base(); },
    duck(v) { ducked = v < 0.3; if (gain) gain.gain.value = base(); if (master) master.gain.value = base(); },
    setVolume(p) { vol = p / 100; localStorage.setItem("sulcis_vol", String(vol)); if (gain) gain.gain.value = base(); if (master) master.gain.value = base(); },
    get volume() { return Math.round(vol * 100); },
  };
  return api;
})();
$("#btnMusic").onclick = () => { const p = $("#volPop"); p.hidden = !p.hidden; document.querySelectorAll("#volPop [data-vol]").forEach((b) => b.classList.toggle("sel", +b.dataset.vol === Music.volume)); };
document.querySelectorAll("#volPop [data-vol]").forEach((b) => (b.onclick = () => { Music.setVolume(+b.dataset.vol); document.querySelectorAll("#volPop [data-vol]").forEach((x) => x.classList.toggle("sel", x === b)); $("#btnMusic").textContent = +b.dataset.vol ? "🎵" : "🔇"; }));
$("#btnNext").onclick = () => Music.next();

/* iPhone/Safari: il suono parte solo dopo un tocco. Al primo tocco sblocco il contesto audio e precarico i file degli eventi. */
(() => { const unlock = () => { try { const c = Sfx.ctx(); if (c.state !== "running") c.resume(); Sfx.preload(); } catch (e) {} };
  ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => addEventListener(ev, unlock, { passive: true })); })();
// app mobile: quando l'app va in background l'audio si ferma, quando torna riparte
document.addEventListener("visibilitychange", () => { try { const c = Sfx.ctx(); if (document.hidden) c.suspend(); else c.resume(); } catch (e) {} });
