"use strict";
/* ===== SulcisOca 3D – da Maladroxia a Gonnesa (100 caselle) ===== */
const T = THREE;
const COLORS = ["#e63946", "#2a9d8f", "#f4d35e", "#a06cd5", "#ff8c42", "#3ddc97"], MAX_PLAYERS = 6;
const FINISH = 162, WIN0 = 137, WIN1 = 139, OLTRE0 = 140, OLTRE1 = 161, LAND_H = 3;   // 150 caselle: Gonnesa sono 3 caselle (125–127); oltre si va dritti a Cagliari
const Q = { fast: false, live: false };   // fast = riavvolgimento rapido dopo un ricaricamento di pagina
const MODES = { rapida: { dice: 2, faces: 8, nome: "⚡ Rapida" }, normale: { dice: 1, faces: 8, nome: "🎲 Normale" } };
const START_HP = 2, START_MONEY = 2, MAX_MONEY = 10, MAX_HOLD = 2, CARL0 = 163, NCARL = 4;   // 2 cuori; 151–154: mini mappa di Carloforte (2 porto, Paolo, bar)

const SPECIAL = {};   // le vecchie caselle speciali sono state tolte: ora contano i colori (blu/grigio/verde/giallo)

const PS1_RES = 220, PIX = innerWidth < 700 ? 0.78 : 0.5;   // da telefono un po' più di risoluzione
function ps1(m) { m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n gl_Position.xy = floor(gl_Position.xy / gl_Position.w * " + PS1_RES.toFixed(1) + " + 0.5) / " + PS1_RES.toFixed(1) + " * gl_Position.w;"); }; return m; }
const LM = (o) => ps1(new THREE.MeshLambertMaterial(Object.assign({}, o)));
const PAWNS = [
  { id: "birra", nome: "Bicchiere di birra", emoji: "🍺" }, { id: "bottiglia", nome: "Bottiglia verde", emoji: "🍾" },
  { id: "accendino", nome: "Accendino", emoji: "🔥" }, { id: "carasau", nome: "Pane carasau", emoji: "🫓" },
  { id: "pesce", nome: "Pesce", emoji: "🐟" }, { id: "panino", nome: "Panino", emoji: "🥪" },
];
let SCL = 1;
let DATA, cards = [], AZ = [], MAP, PERC, SQ = [], HOSP = [], SHOP = [];
let collection = new Set(JSON.parse(localStorage.getItem("sulcis_coll") || "[]"));
let players = [], cur = 0, busy = false, inGame = false, mode = MODES.normale;

/* ---------- Dati / percorso ---------- */
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
// Casualità "di gioco" (sr/rnd) condivisa e deterministica: serve alla sincronizzazione online. vrnd = solo grafica.
let _s = 1; const seedRng = (n) => { _s = (n >>> 0) || 1; };
const sr = () => { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = (n) => (sr() * n) | 0, vrnd = (n) => (Math.random() * n) | 0;
const pickOne = (a) => a[rnd(a.length)];
function proj(lon, lat) {
  const [lo0, la0] = PERC.origine, k = PERC.scala;
  return { x: (lon - lo0) * k * Math.cos((la0 * Math.PI) / 180), z: -(lat - la0) * k };
}
const KIND_COLOR = { blue: 0x2e86de, gray: 0x8c8c8c, green: 0x2fbf4b, yellow: 0xf4d03f, hosp: 0xffffff, heart: 0xffffff, shop: 0xe8903d, goal: 0xff8fd0, start: 0x8c8c8c, carl: 0x48c9b0 };
const KIND_NAME = { blue: "Casella blu: +2€", gray: "Casella grigia: niente", green: "Casella verde: evento", yellow: "Casella gialla: carta gratis (fermati qui)", hosp: "Ospedale: cuori al massimo", heart: "Ingresso dell'ospedale: +1 ❤️", shop: "Negozio", goal: "Gonnesa: fermati qui e indovina la gonna giusta per vincere", start: "Partenza", carl: "Carloforte" };
let HOME = 39;   // casella della casa (dove il Rockettaro ti manda)
function buildSquares() {
  const R2 = rng(5), tappe = PERC.tappe;
  HOME = PERC.casa || 39; HOSP = PERC.ospedali; SHOP = PERC.negozi; SCL = PERC.scala / 150;
  const G = PERC.verdi, inR = (n, r) => n >= r[0] && n <= r[1];
  SQ = [null];
  const kindOf = (n) => {
    if (n === 1) return ["start", ""];
    if (HOSP.includes(n)) return ["hosp", ""];
    if (HOSP.includes(n + 1) && !(PERC.eventi && PERC.eventi[n]) && n !== HOME) return ["heart", ""];   // l'ospedale ha 2 caselle bianche attaccate (tranne la casa)
    if (SHOP.includes(n)) return ["shop", ""];
    if (inR(n, G.carloforte)) return ["green", "carloforte"];
    if (inR(n, G.simone)) return ["green", "simone"];
    if (G.ponzu && inR(n, G.ponzu)) return ["green", "ponzu"];
    if (G.tonnara && inR(n, G.tonnara)) return ["green", "tonnara"];
    if (G.narcao && inR(n, G.narcao)) return ["green", "narcao"];
    if (G.giba && inR(n, G.giba)) return ["green", "giba"];
    if (G.bacu && inR(n, G.bacu)) return ["green", "bacu"];
    if (G.nuxis && inR(n, G.nuxis)) return ["green", "nuxis"];
    if (G.negroni && inR(n, G.negroni)) return ["green", "negroni"];
    if (G.pecore && inR(n, G.pecore)) return ["green", "pecore"];
    if (G.mattia && inR(n, G.mattia)) return ["green", "mattia"];
    if (G.pesca && inR(n, G.pesca)) return ["green", "pesca"];
    if (PERC.eventi && ["scuola", "renzo", "rubiu", "bocca"].includes(PERC.eventi[n])) return ["green", PERC.eventi[n]];
    if (n >= WIN0 && n <= WIN1) return ["goal", ""];
    if (n > WIN1) return ["gray", ""];
    if (PERC.ricche && PERC.ricche.includes(n)) return ["blue", ""];
    if (PERC.gialle.includes(n)) return ["yellow", ""];
    if (PERC.tipiFissi) return ["blue", ""];          // colori fissati in percorso.json (non cambiano se si rinumera)
    if (R2() < 0.5) return ["blue", ""];
    return [R2() < 0.5 ? "yellow" : "blue", ""];      // le (ex) grigie: metà diventano caselle carta (gialle), metà blu
  };
  const put = (n, x, z, town, zone, label) => { const [kind, ev0] = kindOf(n), event = (PERC.eventi && PERC.eventi[n]) || ev0; SQ[n] = { n, x, z, town, zone, label, kind, event, empty: n > WIN1, heart: HOSP.includes(n + 1), rich: !!(PERC.ricche && PERC.ricche.includes(n)), tonnoOnly: kind === "yellow" && PERC.tonnaraGialle && inR(n, PERC.tonnaraGialle) }; };
  for (let i = 0; i < tappe.length; i++) {
    const A = tappe[i], pa = proj(A.lon, A.lat);
    put(A.casella, pa.x, pa.z, !A.minore, A.zona, A.minore ? "" : A.nome);
    const B = tappe[i + 1]; if (!B) break;
    const pb = proj(B.lon, B.lat), L = B.casella - A.casella;
    const dx = pb.x - pa.x, dz = pb.z - pa.z, len = Math.hypot(dx, dz) || 1;
    for (let k = 1; k < L; k++) {
      const t = k / L, w = Math.sin(t * Math.PI) * Math.min(14, len * 0.05) * (i % 2 ? 1 : -1), n = A.casella + k;
      put(n, pa.x + dx * t - (dz / len) * w, pa.z + dz * t + (dx / len) * w, false, A.zona, "");
    }
  }
  PERC.carloforte.forEach((c, k) => { const q = proj(c.lon, c.lat); SQ[CARL0 + k] = { n: CARL0 + k, x: q.x, z: q.z, town: k === 0, zone: "true", label: ["Carloforte: porto", "Carloforte: porto", "Paolo Vallebona", "Bar genovese"][k], kind: "carl", event: "", empty: true }; });
}
const zoneOf = (n) => PERC.zone[SQ[n].zone];

/* ---------- Carte ---------- */
function cardHTML(c, o = {}) {
  const t = DATA.tipi[c.tipo] || { colore: "#555", emoji: "❔" };
  const art = c.immagine ? `<img src="${c.immagine}" alt="">` : c.emoji || t.emoji;
  const corner = c.stelle ? `<span class="stars">${"★".repeat(c.stelle)}</span>` : c.prezzo ? `<span class="stars">💰${c.prezzo}</span>` : "";
  return `<div class="card ${o.locked ? "locked" : ""} ${o.isNew ? "new" : ""} ${o.flip ? "flip" : ""}" style="background:linear-gradient(160deg,${t.colore},#1b1410 130%)">
    <div class="top"><span>${t.emoji} ${c.tipo}</span>${corner}</div>
    <div class="art">${art}</div><div class="name">${c.nome}</div>${c.luogo ? `<div class="place">📍 ${c.luogo}</div>` : ""}
    <div class="txt">${c.testo || ""}${c.sfotto && typeof c.id === "number" && c.id < 51 ? `<br><i>😏 ${c.sfotto}</i>` : ""}${c.pena ? `<br><b>⚠️ ${c.pena}</b>` : ""}</div></div>`;
}
const cardById = (id) => cards.find((c) => c.id === id);
const azById = (id) => AZ.find((a) => a.id === id);
function saveColl() { localStorage.setItem("sulcis_coll", JSON.stringify([...collection])); $("#collCount").textContent = `${collection.size}/${cards.length}`; }

/* modale: gli elementi [data-v] cliccati risolvono la promise con quel valore */
let modalDone = null;
function closeModal(v) { $("#modal").hidden = true; $("#modalInner").onclick = null; const r = modalDone; modalDone = null; if (r) r(v); }
function modal(html, btn = "OK", auto = 0) {
  if (Q.fast) return Promise.resolve("ok");
  return new Promise((res) => {
    if (modalDone) { const r = modalDone; modalDone = null; r(undefined); }
    const inner = $("#modalInner");
    inner.innerHTML = html + (btn ? `<p style="text-align:center"><button class="primary" data-v="ok">${btn}</button></p>` : "");
    $("#modal").hidden = false; modalDone = res;
    inner.onclick = (e) => { const el = e.target.closest("[data-v]"); if (el && !el.disabled) closeModal(el.dataset.v); };
    if (auto) setTimeout(() => { if (modalDone === res) closeModal("auto"); }, auto);
  });
}
function zoneBanner(z) {
  if (Q.fast) return;
  const el = $("#zoneBanner"); el.hidden = true; void el.offsetWidth;
  el.querySelector(".zn").textContent = z.nome; el.querySelector(".zd").textContent = z.desc || ""; el.style.setProperty("--c", z.colore);
  const ms = Math.max(2000, Math.min(4000, 1300 + (z.desc || "").length * 22));   // dura in base a quanta descrizione c'è
  el.style.animationDuration = ms + "ms"; el.hidden = false; Sfx.zone(); clearTimeout(zoneBanner.h); zoneBanner.h = setTimeout(() => (el.hidden = true), ms + 100);
}
function toast(msg) {
  if (Q.fast) return;
  const t = $("#toast"); t.hidden = true; void t.offsetWidth; t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2400);
}

/* ================= 3D ================= */
let renderer, scene, camera, seaMesh, seaBase, discs = [], floaters = [], fadeSprites = [], dog = null;
const cam = { target: new T.Vector3(), goal: new T.Vector3(), yaw: 0, pitch: 0.85, dist: 150, goalDist: 150, mode: "menu", focus: null, shake: 0, movingUntil: 0, moveDir: { x: 0, z: 1 } };
const FOLLOW_DIST = 34, FOLLOW_PITCH = 0.42, MIN_DIST = 7, MAX_DIST = 90, PAWN_Y = LAND_H + 0.9; let lastInput = -1e9;

function labelSprite(text, size = 44, bg = "rgba(25,15,8,.78)", color = "#fff", hh = 3) {
  const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
  ctx.font = `bold ${size}px Georgia,serif`;
  const w = Math.ceil(ctx.measureText(text).width) + (bg ? 36 : 8), h = size + (bg ? 22 : 10);
  cv.width = w; cv.height = h;
  if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, w, h, 14) : ctx.rect(0, 0, w, h); ctx.fill(); }
  ctx.font = `bold ${size}px Georgia,serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + 2);
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set((w / h) * hh, hh, 1); sp.userData.text = text; sp.userData.bg = bg; return sp;
}
function spritesToDom(root) {   // insegne fisse degli edifici: diventano etichette HTML nitide (niente pixel)
  root.updateMatrixWorld(true); const list = [];
  root.traverse((o) => { if (o.isSprite && o.userData.text && o.userData.bg) list.push(o); });
  list.forEach((sp) => { const wp = new T.Vector3(); sp.getWorldPosition(wp); addDomLabel(sp.userData.text, wp, "lbl-sign", 170); sp.parent.remove(sp); });
}
function pip(x, y, ring) {
  let ins = false;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i - 1 < 0 ? n - 1 : i - 1], [x2, y2] = ring[i];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) ins = !ins;
  }
  return ins;
}
const onLand = (lon, lat) => MAP.rings.some((r) => pip(lon, lat, r));

function initScene() {
  renderer = new T.WebGLRenderer({ canvas: $("#cv"), antialias: false });
  renderer.setPixelRatio(1);
  scene = new T.Scene(); scene.background = new T.Color(0x9ec7d9); scene.fog = new T.Fog(0x9ec7d9, 110, 430);
  camera = new T.PerspectiveCamera(55, 1, 0.5, 5000);
  scene.add(new T.HemisphereLight(0xfff3d6, 0x3a6a8a, 0.55));
  const sun = new T.DirectionalLight(0xfff0c8, 0.5); sun.position.set(-80, 140, 60); scene.add(sun);

  const sg = new T.PlaneGeometry(7000, 7000, 100, 100); sg.rotateX(-Math.PI / 2);
  seaBase = Float32Array.from(sg.attributes.position.array);
  seaMesh = new T.Mesh(sg, ps1(new T.MeshPhongMaterial({ color: 0x2a7fb0, flatShading: true, shininess: 40, specular: 0x6699bb }))); scene.add(seaMesh);

  const top = LM({ color: 0x86ad4c }), side = LM({ color: 0x7a5a38 });
  MAP.rings.forEach((ring) => {
    const pts = ring.map(([lo, la]) => { const p = proj(lo, la); return new T.Vector2(p.x, -p.z); });
    const mesh = new T.Mesh(new T.ExtrudeGeometry(new T.Shape(pts), { depth: LAND_H, bevelEnabled: false }), [top, side]); mesh.rotation.x = -Math.PI / 2; scene.add(mesh);
    scene.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(pts.map((p) => new T.Vector3(p.x, LAND_H + 0.06, -p.y))), new T.LineBasicMaterial({ color: 0xfff6dc })));
    const sand = new T.Mesh(new T.ExtrudeGeometry(new T.Shape(pts), { depth: 0.5, bevelEnabled: true, bevelSize: 14, bevelThickness: 0.1, bevelSegments: 1 }), LM({ color: 0x5fc4cf, transparent: true, opacity: 0.65 }));
    sand.rotation.x = -Math.PI / 2; sand.position.y = 0.4; scene.add(sand);
  });

  const hm = LM({ color: 0x7f9a4f }), R = rng(11);
  [[8.55, 39.37, 9], [8.62, 39.42, 10], [8.70, 39.05, 11], [8.80, 39.2, 9], [8.74, 39.28, 8], [8.5, 39.5, 8], [8.85, 39.0, 9], [8.67, 39.12, 8], [8.46, 39.32, 6]].forEach(([lo, la, r]) => {
    if (!onLand(lo, la)) return; const p = proj(lo, la);
    if (SQ.some((q) => q && Math.hypot(q.x - p.x, q.z - p.z) < r * SCL * 0.3 + 8)) return;
    const rr = r * SCL * 0.6, h = new T.Mesh(new T.SphereGeometry(rr, 8, 6), hm); h.scale.y = 0.2; h.position.set(p.x, LAND_H - 1, p.z); scene.add(h);
  });
  const treeM = new T.InstancedMesh(new T.ConeGeometry(1.7, 5.2, 5), LM({ color: 0x35602f }), 9000), d = new T.Object3D();
  let n = 0;
  for (let tries = 0; tries < 80000 && n < 9000; tries++) {
    const lo = 8.2 + R() * 0.85, la = 38.85 + R() * 0.75; if (!onLand(lo, la)) continue;
    const p = proj(lo, la); if (SQ.some((s) => s && Math.hypot(s.x - p.x, s.z - p.z) < 6)) continue;
    const s = 0.55 + R() * 0.55; d.position.set(p.x, LAND_H + 2.2 * s, p.z); d.scale.set(s, s, s); d.updateMatrix(); treeM.setMatrixAt(n++, d.matrix);
  }
  treeM.count = n; scene.add(treeM);

  buildBoard3D(); resize(); addEventListener("resize", resize); controls($("#cv")); renderer.setAnimationLoop(frame);
}

let EM_NEAR = 30;   // le emoji delle caselle si vedono solo vicino al punto inquadrato (circa 2-3 caselle)
function buildBoard3D() {
  { let t = 0; for (let n = 2; n <= FINISH; n++) t += Math.hypot(SQ[n].x - SQ[n - 1].x, SQ[n].z - SQ[n - 1].z); EM_NEAR = (t / (FINISH - 1)) * 3.2; }
  const pts = []; for (let n = 1; n <= FINISH; n++) pts.push(new T.Vector3(SQ[n].x, LAND_H + 0.1, SQ[n].z));
  scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 1500, 0.55, 5, false), LM({ color: 0xd8c28a })));
  const cp = []; for (let k = 0; k < NCARL; k++) cp.push(new T.Vector3(SQ[CARL0 + k].x, LAND_H + 0.1, SQ[CARL0 + k].z));
  scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(cp), 60, 0.55, 5, false), LM({ color: 0xd8c28a })));
  const list = []; for (let n = 1; n <= FINISH; n++) list.push(n); for (let k = 0; k < NCARL; k++) list.push(CARL0 + k);
  list.forEach((n) => {
    const s = SQ[n], hosp = s.kind === "hosp", shop = s.kind === "shop", r = s.town ? 2.6 : 1.7, zc = new T.Color(zoneOf(n).colore);
    const g = new T.Group(); g.position.set(s.x, LAND_H, s.z);
    const disc = new T.Mesh(new T.CylinderGeometry(r, r * 1.08, 0.7, 28), LM({ color: KIND_COLOR[s.kind] })); disc.position.y = 0.35; disc.userData.n = n; if (hosp || s.kind === "heart") { disc.userData.em = 0x8a8a8a; disc.material.emissive = new T.Color(0x8a8a8a); } g.add(disc); discs.push(disc);   // ospedale: casella bianca ben visibile
    const rim = new T.Mesh(new T.TorusGeometry(r, 0.14, 6, 28), LM({ color: zc })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.72; g.add(rim);
    addDomLabel(n <= FINISH ? String(n) : "C" + (n - CARL0 + 1), new T.Vector3(s.x, LAND_H + 1.8, s.z), hosp ? "lbl-n red" : "lbl-n", 60);
    if (s.town) {
      const Rn = rng(n * 31);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Rn(), rr = r + 1.2 + Rn() * 1.2, w = 0.9 + Rn() * 0.7, h = 0.9 + Rn() * 0.8;
        const house = new T.Group(); house.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
        const body = new T.Mesh(new T.BoxGeometry(w, h, w), LM({ color: [0xf2e6c9, 0xe9c9a0, 0xf6dcc0][i % 3] })); body.position.y = h / 2 + 0.2;
        const roof = new T.Mesh(new T.ConeGeometry(w * 0.85, 0.7, 4), LM({ color: 0xb5472b })); roof.position.y = h + 0.55; roof.rotation.y = Math.PI / 4;
        house.add(body, roof); g.add(house);
      }
      if (s.label) addDomLabel(s.label, new T.Vector3(s.x, LAND_H + 9, s.z), "lbl-t", 320);
    }
    if (hosp) {   // ospedale vero: edificio bianco a due piani, croce rossa, insegna e ingresso del pronto soccorso
      const b = new T.Group(), Wm = LM({ color: 0xf7f7f7 }), Rm = LM({ color: 0xd62828 }), Gm = LM({ color: 0x8fc7e8 });
      const B = (w, h, d, x, y, z, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); b.add(o); return o; };
      B(9, 6, 6, 0, 3, 0, Wm); B(9.3, 0.4, 6.3, 0, 6.2, 0, LM({ color: 0xbfbfbf }));
      for (const y of [1.8, 4.3]) for (let i = 0; i < 4; i++) B(1.3, 1.1, 0.1, -3.3 + i * 2.2, y, 3.02, Gm);
      B(3, 0.9, 0.12, 0, 7.4, 0, Rm); B(0.9, 3, 0.12, 0, 7.4, 0, Rm);                       // croce rossa sul tetto
      B(3.4, 0.3, 2.2, 0, 2.7, 4.1, Rm); B(2, 2.4, 0.1, 0, 1.2, 3.03, LM({ color: 0x5a6b78 }));   // pensilina e porta del pronto soccorso
      const sg = labelSprite("🏥 OSPEDALE", 46, "rgba(200,20,20,.92)", "#fff", 1.6); sg.position.set(0, 9.2, 0); b.add(sg);
      const dR = roadDir(n), pv = SQ[n - 1] || s, mx = (pv.x - s.x) / 2, mz = (pv.z - s.z) / 2;
      b.position.set(mx + dR.sx * 13, 0, mz + dR.sz * 13); b.rotation.y = Math.atan2(-dR.sx, -dR.sz); b.scale.setScalar(0.9); g.add(b);   // a lato della strada, di fronte alle 2 caselle bianche
    }
    if (shop) {
      const b = new T.Group(); b.position.set(4.6, 0, 0); b.scale.setScalar(1.3);
      const body = new T.Mesh(new T.BoxGeometry(2.2, 1.8, 1.8), LM({ color: 0xe8b04a })); body.position.y = 1.1; b.add(body);
      if (false) { const m = LM({ color: 0xd62828 }); const c1 = new T.Mesh(new T.BoxGeometry(1.1, 0.3, 0.1), m), c2 = new T.Mesh(new T.BoxGeometry(0.3, 1.1, 0.1), m); c1.position.set(0, 1.2, 0.95); c2.position.set(0, 1.2, 0.95); b.add(c1, c2); }
      else { const roof = new T.Mesh(new T.ConeGeometry(1.8, 0.9, 4), LM({ color: 0xb5472b })); roof.position.y = 2.5; roof.rotation.y = Math.PI / 4; b.add(roof); }
      g.add(b);
    }
    const em = s.event === "vecchio" ? "👴" : { hosp: "🏥", shop: "🏪", yellow: "🎁", goal: n === WIN0 + 1 ? "👗" : "", green: { giba: "💊", mattia: "🎮", pecore: "🐑", pesca: "🎣", negroni: "🍸", simone: "🎸", carloforte: "⛵", ponzu: "🍣", tonnara: "🐟", narcao: "💊", bacu: "🧱", nuxis: "🕷️", scuola: "🏫", renzo: "🍕", rubiu: "🍺", bocca: "🥪" }[s.event] || "❓" }[s.kind] || (s.heart ? "❤️" : "") || (n === FINISH ? "🏙️" : "");
    if (em) addDomLabel(em, new T.Vector3(s.x, LAND_H + 4.6, s.z), "lbl-em", EM_NEAR, null, true);   // emoji delle caselle in HTML: nitide, mai pixelate
    scene.add(g); if (hosp) spritesToDom(g);
  });
  zoneDecor(); if (typeof buildExtras === "function") buildExtras();
}


function lonLatOf(x, z) { const [lo0, la0] = PERC.origine, k = PERC.scala; return [x / (k * Math.cos((la0 * Math.PI) / 180)) + lo0, -z / k + la0]; }
function zoneProp(zone, R) {
  const g = new T.Group(), add = (geo, c, x, y, z) => { const m = new T.Mesh(geo, LM({ color: c })); m.position.set(x, y, z); g.add(m); return m; };
  if (zone === "fake") { const c = [0xff5d8f, 0xffd166, 0x4cc9f0][(R() * 3) | 0]; add(new T.CylinderGeometry(0.12, 0.12, 3.2, 5), 0xffffff, 0, 1.6, 0); add(new T.ConeGeometry(2.2, 1, 8), c, 0, 3.5, 0); add(new T.BoxGeometry(2.4, 0.3, 1), 0xf4e8d0, 2, 0.3, 0); }
  else if (zone === "true") { if (R() < 0.5) { add(new T.SphereGeometry(1.6, 6, 5), 0x4f8f3a, 0, 2.2, 0); add(new T.CylinderGeometry(0.25, 0.3, 1.8, 5), 0x6b4a2b, 0, 0.9, 0); } else { add(new T.BoxGeometry(3.4, 0.8, 1.3), 0xf4f1e8, 0, 0.6, 0); add(new T.BoxGeometry(0.2, 2.4, 0.2), 0x8b5a2b, 0, 2, 0); add(new T.BoxGeometry(1.6, 1.5, 0.05), 0x3fb6e0, 0.9, 2.2, 0); } }
  else if (zone === "mid") { if (R() < 0.5) { add(new T.CylinderGeometry(0.2, 0.35, 3.4, 5), 0x5a4632, 0, 1.7, 0); add(new T.BoxGeometry(2, 0.15, 0.15), 0x5a4632, 0.6, 2.8, 0); } else add(new T.DodecahedronGeometry(1.4 + R(), 0), 0x8c8579, 0, 0.8, 0); }
  else { const k = R(); if (k < 0.4) { add(new T.CylinderGeometry(0.8, 1.1, 7, 7), 0x6b6f78, 0, 3.5, 0); add(new T.BoxGeometry(1.8, 1.2, 1.8), 0x2a2a2e, 0, 7.4, 0); } else if (k < 0.75) { add(new T.BoxGeometry(2.2, 6, 2.2), 0x7a5a38, 0, 3, 0); add(new T.CylinderGeometry(1.2, 1.2, 0.4, 8), 0x333333, 0, 6.2, 0); } else { add(new T.BoxGeometry(2.4, 1.8, 2.4), 0x9a7b4f, 0, 0.9, 0); add(new T.BoxGeometry(1.6, 1.2, 1.6), 0xb4915c, 0.4, 2.3, 0.2); } }
  return g;
}
/* etichette HTML (testo nitido, non pixelato) agganciate a punti 3D */
const domLabels = [];
function addDomLabel(text, pos, cls, maxD, ref, near) {
  const el = document.createElement("div"); el.className = "dl " + cls; el.textContent = text; $("#labels").appendChild(el);
  const o = { el, pos, maxD, ref, near }; domLabels.push(o); return o;
}
function removeDomLabel(o) { o.el.remove(); const i = domLabels.indexOf(o); if (i >= 0) domLabels.splice(i, 1); }
const _lv = new T.Vector3();
function updateDomLabels() {
  const w = innerWidth, h = innerHeight;
  for (const o of domLabels) {
    const p = o.ref ? o.ref : o.pos, d = o.near ? Math.hypot(p.x - cam.target.x, p.z - cam.target.z) : camera.position.distanceTo(p);   // "near": distanza dal punto inquadrato
    if (d > o.maxD) { if (o.on) { o.el.style.display = "none"; o.on = false; } continue; }
    _lv.copy(p).project(camera);
    if (_lv.z > 1 || Math.abs(_lv.x) > 1.2 || Math.abs(_lv.y) > 1.2) { if (o.on) { o.el.style.display = "none"; o.on = false; } continue; }
    if (!o.on) { o.el.style.display = "block"; o.on = true; }
    o.el.style.transform = `translate(-50%,-50%) translate(${((_lv.x * 0.5 + 0.5) * w).toFixed(0)}px,${((-_lv.y * 0.5 + 0.5) * h).toFixed(0)}px)`;
    o.el.style.opacity = Math.max(0, Math.min(1, (o.maxD - d) / (o.maxD * 0.35)));
  }
}
/* contorno colorato attorno a ciascuna zona: curva di livello (marching squares) di un campo di distanza dalle sue caselle */
function zoneOutlines() {
  const R = 55, STEP = 5, W = 0.7, Y = LAND_H + 0.35, zones = Object.keys(PERC.zone);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let n = 1; n <= FINISH; n++) { const q = SQ[n]; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
  x0 -= R + 10; z0 -= R + 10; x1 += R + 10; z1 += R + 10;
  const nx = Math.ceil((x1 - x0) / STEP) + 1, nz = Math.ceil((z1 - z0) / STEP) + 1, D = {};
  zones.forEach((zk) => { D[zk] = new Float32Array(nx * nz); });
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * STEP, z = z0 + j * STEP, best = {}; zones.forEach((zk) => (best[zk] = 1e9));
    for (let n = 1; n <= FINISH; n++) { const q = SQ[n], d = Math.hypot(q.x - x, q.z - z); if (d < best[q.zone]) best[q.zone] = d; }
    zones.forEach((zk) => { D[zk][j * nx + i] = best[zk]; });
  }
  zones.forEach((zk) => {
    const col = new T.Color(PERC.zone[zk].colore), others = zones.filter((o) => o !== zk);
    const F = new Float32Array(nx * nz);   // >0 dentro la zona: vicino alle sue caselle e più vicino a lei che alle altre zone (con piccolo margine)
    for (let k = 0; k < F.length; k++) { let dm = 1e9; others.forEach((o) => (dm = Math.min(dm, D[o][k]))); F[k] = Math.min(R - D[zk][k], dm - D[zk][k] - 3); }
    const pos = []; let segs = 0;
    const P = (i, j) => [x0 + i * STEP, z0 + j * STEP], lerp = (pa, fa, pb, fb) => { const t = fa / (fa - fb); return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]; };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const f00 = F[j * nx + i], f10 = F[j * nx + i + 1], f11 = F[(j + 1) * nx + i + 1], f01 = F[(j + 1) * nx + i], pts = [];
      const p00 = P(i, j), p10 = P(i + 1, j), p11 = P(i + 1, j + 1), p01 = P(i, j + 1);
      if ((f00 > 0) !== (f10 > 0)) pts.push(lerp(p00, f00, p10, f10));
      if ((f10 > 0) !== (f11 > 0)) pts.push(lerp(p10, f10, p11, f11));
      if ((f11 > 0) !== (f01 > 0)) pts.push(lerp(p11, f11, p01, f01));
      if ((f01 > 0) !== (f00 > 0)) pts.push(lerp(p01, f01, p00, f00));
      for (let k = 0; k + 1 < pts.length; k += 2) {
        const a = pts[k], b = pts[k + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, [lo, la] = lonLatOf(mx, mz);
        if (!onLand(lo, la)) continue;
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * W, oz = (dx / l) * W;
        pos.push(a[0] + ox, Y, a[1] + oz, a[0] - ox, Y, a[1] - oz, b[0] + ox, Y, b[1] + oz, b[0] + ox, Y, b[1] + oz, a[0] - ox, Y, a[1] - oz, b[0] - ox, Y, b[1] - oz);
        segs++;
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    scene.add(new T.Mesh(g, ps1(new T.MeshBasicMaterial({ color: col, side: T.DoubleSide }))));
  });
}
function zoneDecor() {
  zoneOutlines(); // terreno colorato per zona e props a tema lungo il percorso
  const R = rng(99);
  for (let n = 1; n <= FINISH; n++) {
    const s = SQ[n];
    for (let i = 0; i < 4; i++) {
      const a = R() * Math.PI * 2, d = 8 + R() * 18, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, [l2, la2] = lonLatOf(x, z);
      if (!onLand(l2, la2) || SQ.some((q) => q && Math.hypot(q.x - x, q.z - z) < 6)) continue;
      const o = zoneProp(s.zone, R); o.position.set(x, LAND_H, z); o.rotation.y = R() * 6.28; scene.add(o);
    }
  }
}
/* dado a 8 facce (ottaedro) con i numeri sulle facce, lanciato sulla mappa: si ferma con il numero uscito in alto */
let diceObjs = [], d8tex = null;
const D8R = 2.1;
function d8Texture() {
  if (d8tex) return d8tex;
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256; const c = cv.getContext("2d");
  c.textAlign = "center"; c.textBaseline = "middle";
  for (let i = 0; i < 8; i++) {
    const cx = (i % 4) * 128, cy = (1 - Math.floor(i / 4)) * 128;   // v verso l'alto: riga 0 = metà bassa
    c.fillStyle = i % 2 ? "#ece0c0" : "#f8f0da"; c.fillRect(cx, cy, 128, 128);
    c.strokeStyle = "#1b1410"; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + 64, cy + 10); c.lineTo(cx + 10, cy + 118); c.lineTo(cx + 118, cy + 118); c.closePath(); c.stroke();
    c.fillStyle = "#1b1410"; c.font = "bold 52px Georgia,serif"; c.fillText(String(i + 1), cx + 64, cy + 82);
  }
  d8tex = new T.CanvasTexture(cv); d8tex.magFilter = T.NearestFilter; return d8tex;
}
function d8Geometry() {
  const pos = [], uv = [];
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1, A = [sx * D8R, 0, 0], B = [0, sy * D8R, 0], C = [0, 0, sz * D8R];
    const tri = sx * sy * sz > 0 ? [A, B, C] : [A, C, B], col = i % 4, row = Math.floor(i / 4);
    const uvs = sx * sy * sz > 0 ? [[0.5, 0.92], [0.08, 0.1], [0.92, 0.1]] : [[0.5, 0.92], [0.92, 0.1], [0.08, 0.1]];
    tri.forEach((v, k) => { pos.push(...v); uv.push((col + uvs[k][0]) / 4, (row + uvs[k][1]) / 2); });
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
function clearDice() { diceObjs.forEach((d) => { scene.remove(d.mesh); if (d.lab) removeDomLabel(d.lab); }); diceObjs = []; }
function dieFinalQuat(r, yaw) {   // la faccia r in alto, col numero leggibile dalla camera
  const i = r - 1, sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1, n = new T.Vector3(sx, sy, sz).normalize(), up = new T.Vector3(0, 1, 0);
  const q1 = new T.Quaternion().setFromUnitVectors(n, up), apex = new T.Vector3(sx * D8R, 0, 0).applyQuaternion(q1);
  const cur = Math.atan2(apex.x, apex.z), want = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  return new T.Quaternion().setFromAxisAngle(up, want - cur).multiply(q1);
}
function throwDice(p, results) {
  clearDice();
  const g0 = typeof gen === "undefined" ? 0 : gen;
  const a = SQ[Math.min(FINISH - 1, p.pos)] || SQ[p.pos], b = SQ[Math.min(FINISH, p.pos + 1)] || SQ[p.pos];
  let fx = b.x - a.x, fz = b.z - a.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const base = p.obj.position, sx = -fz, sz = fx, floor = LAND_H + D8R, rest = LAND_H + D8R / Math.sqrt(3) + 0.02, yaw = cam.yaw;
  results.forEach((r, i) => {
    const off = (i - (results.length - 1) / 2) * 4.2, tex = d8Texture();
    const mesh = new T.Mesh(d8Geometry(), LM({ map: tex }));
    mesh.position.set(base.x + fx * 5 + sx * off, floor + 9, base.z + fz * 5 + sz * off); scene.add(mesh);
    const sp = 8 + vrnd(4);
    diceObjs.push({ mesh, r, q: dieFinalQuat(r, yaw), vx: fx * sp + sx * (vrnd(5) - 2), vy: 4 + vrnd(4), vz: fz * sp + sz * (vrnd(5) - 2), wx: 6 + vrnd(10), wy: 4 + vrnd(8), wz: 6 + vrnd(10), bounces: 0, state: 0, s: 0 });
  });
  return new Promise((res) => {
    let last = performance.now(); const t0 = last;
    (function f(now) {
      if (typeof gen !== "undefined" && g0 !== gen) return;
      const dt = Math.min(0.04, (now - last) / 1000); last = now; let all = true;
      diceObjs.forEach((d) => {
        if (d.state === 2) return; all = false;
        if (d.state === 1) { d.s = Math.min(1, d.s + dt / 0.35); d.mesh.quaternion.slerpQuaternions(d.q0, d.q, d.s); d.mesh.position.y += (rest - d.mesh.position.y) * 0.3; if (d.s >= 1) { d.state = 2; d.mesh.position.y = rest; } return; }
        d.vy -= 34 * dt; d.mesh.position.x += d.vx * dt; d.mesh.position.y += d.vy * dt; d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += d.wx * dt; d.mesh.rotation.y += d.wy * dt; d.mesh.rotation.z += d.wz * dt;
        if (d.mesh.position.y < floor) { d.mesh.position.y = floor; if (d.vy < -2) { Sfx.tick(); d.bounces++; } d.vy = -d.vy * 0.45; d.vx *= 0.7; d.vz *= 0.7; d.wx *= 0.6; d.wy *= 0.6; d.wz *= 0.6; }
        if ((d.bounces >= 2 && Math.abs(d.vy) < 1.5 && Math.hypot(d.vx, d.vz) < 1.2) || now - t0 > 3500) { d.state = 1; d.q0 = d.mesh.quaternion.clone(); }
      });
      if (all) { diceObjs.forEach((d) => (d.lab = addDomLabel(String(d.r), null, "lbl-big", 120, d.mesh.position.clone().add(new T.Vector3(0, 3.4, 0))))); res(); } else requestAnimationFrame(f);
    })(last);
  });
}
function makePawn(id, color) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const add = (geo, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sc) => { const m = new T.Mesh(geo, LM({ color: c })); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); if (sc) m.scale.set(...sc); body.add(m); return m; };
  const C = (rt, rb, h, n = 14) => new T.CylinderGeometry(rt, rb, h, Math.max(n, 12));   // più segmenti: pedine più rotonde
  if (id === "birra") { add(C(0.8, 0.65, 1.9), 0xe8a317, 0, 1.1); add(C(0.85, 0.85, 0.45), 0xfff6dc, 0, 2.2); add(new T.TorusGeometry(0.45, 0.14, 5, 8), 0xdddddd, 0.95, 1.1, 0); }
  else if (id === "bottiglia") { add(C(0.6, 0.6, 1.7), 0x2f8f3a, 0, 1.0); add(C(0.22, 0.6, 0.7), 0x2f8f3a, 0, 2.2); add(C(0.25, 0.25, 0.9), 0x2f8f3a, 0, 2.85); add(C(0.3, 0.3, 0.15), 0xd4af37, 0, 3.35); add(C(0.62, 0.62, 0.6), 0xf1e3b0, 0, 1.0); }
  else if (id === "accendino") { add(new T.BoxGeometry(1.0, 1.9, 0.5), 0xd62828, 0, 1.0); add(new T.BoxGeometry(1.05, 0.45, 0.55), 0xc0c0c8, 0, 2.15); g.userData.flame = add(new T.ConeGeometry(0.38, 1.1, 6), 0xff8a1f, 0, 3.0); add(new T.ConeGeometry(0.18, 0.6, 6), 0xfff29a, 0, 2.85); }
  else if (id === "carasau") { [[1.3, 0.5, 0], [1.15, 0.72, 0.6], [1.0, 0.94, 1.3], [0.85, 1.16, 2.1], [0.7, 1.38, 0.3]].forEach(([r, y, ry]) => add(C(r, r, 0.16, 9), 0xd9a95b + ((y * 20) | 0) * 0x010100, 0, y, 0, 0, ry)); add(C(0.5, 0.5, 1.7, 8), 0xc79443, 0, 2.2, 0, 0, 0, 0); }
  else if (id === "pesce") { add(new T.SphereGeometry(1, 8, 6), 0x6fa8dc, 0, 1.5, 0, 0, 0, 0, [1.5, 0.9, 0.5]); add(new T.ConeGeometry(0.7, 1.0, 4), 0x4f86c0, -1.7, 1.5, 0, 0, 0, -Math.PI / 2); add(new T.ConeGeometry(0.4, 0.7, 3), 0x4f86c0, 0, 2.4, 0); add(new T.SphereGeometry(0.2, 5, 4), 0xffffff, 0.9, 1.7, 0.4); add(new T.SphereGeometry(0.1, 4, 3), 0x000000, 1.0, 1.7, 0.5); }
  else { add(new T.SphereGeometry(1.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xd9a05b, 0, 0.45, 0, 0, 0, 0, [1, 0.6, 1]); add(C(1.15, 1.15, 0.12, 8), 0x4fae3a, 0, 0.75); add(C(1.0, 1.0, 0.3, 8), 0x6b3a1e, 0, 1.0); add(new T.BoxGeometry(2.0, 0.08, 2.0), 0xf2c744, 0, 1.2, 0, 0, 0.7, 0); add(new T.SphereGeometry(1.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xe0a95f, 0, 1.25, 0, 0, 0, 0, [1, 0.85, 1]); }
  if (id === "birra") { for (let i = 0; i < 5; i++) add(new T.SphereGeometry(0.22, 6, 4), 0xfffbe8, Math.cos(i * 1.3) * 0.5, 2.5, Math.sin(i * 1.3) * 0.5); add(C(0.82, 0.82, 0.08), 0xffffff, 0, 0.2); }   // schiuma e fondo del boccale
  else if (id === "bottiglia") { add(C(0.63, 0.63, 0.25), 0xb01e1e, 0, 1.35); }                       // fascetta rossa dell'etichetta
  else if (id === "pesce") { add(new T.SphereGeometry(0.16, 6, 4), 0x111111, 1.05, 1.75, 0.35); add(new T.SphereGeometry(0.16, 6, 4), 0x111111, 1.05, 1.75, -0.35); add(new T.ConeGeometry(0.35, 0.6, 4), 0x4f86c0, 0, 0.75, 0, Math.PI); }   // occhi e pinna sotto
  const base = new T.Mesh(C(1.5, 1.6, 0.25, 18), LM({ color })); base.position.y = 0.12; g.add(base);
  const rim = new T.Mesh(new T.TorusGeometry(1.55, 0.08, 4, 18), LM({ color: 0xffffff })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.26; g.add(rim);
  g.scale.setScalar(0.95); return g;
}
function makeDog() { // Zara: staffy nero low poly (striscia bianca, muso e petto bianchi, zampe anteriori bianche, un orecchio dritto e uno piegato)
  const g = new T.Group(), blk = LM({ color: 0x16110f }), wht = LM({ color: 0xf1efe9 }), brn = LM({ color: 0x3a2417 });
  const box = (w, h, d, x, y, z, m, parent) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; };
  const body = new T.Group(); g.add(body);
  box(1.5, 1.3, 1.25, 0.55, 2.1, 0, blk, body); box(1.25, 1.15, 1.1, -0.8, 2.05, 0, blk, body); box(1.5, 0.95, 1.05, -0.1, 1.95, 0, blk, body);
  const neck = box(0.8, 0.95, 0.85, 1.35, 2.6, 0, blk, body); neck.rotation.z = -0.55;
  box(0.4, 0.65, 0.95, 1.22, 1.7, 0, wht, body);                                   // petto bianco
  const head = new T.Group(); head.position.set(1.95, 2.9, 0); body.add(head);
  box(1.0, 0.85, 0.9, 0, 0, 0, blk, head); box(0.7, 0.55, 0.64, 0.7, -0.18, 0, wht, head); box(0.18, 0.16, 0.3, 1.08, -0.04, 0, blk, head);   // muso e naso
  box(0.6, 0.06, 0.2, 0.0, 0.44, 0, wht, head);                                    // striscia bianca sulla fronte
  box(0.1, 0.1, 0.1, 0.36, 0.1, 0.34, brn, head); box(0.1, 0.1, 0.1, 0.36, 0.1, -0.34, brn, head);   // occhi
  const earUp = new T.Mesh(new T.ConeGeometry(0.28, 0.85, 4), blk); earUp.position.set(-0.1, 0.78, 0.3); head.add(earUp);   // orecchio dritto
  const earDn = box(0.4, 0.1, 0.42, -0.1, 0.5, -0.5, blk, head); earDn.rotation.x = 0.7;                                     // orecchio piegato
  const legs = [];
  [[0.95, 0.42, true], [0.95, -0.42, true], [-1.0, 0.42, false], [-1.0, -0.42, false]].forEach(([x, z, front]) => {
    const lg = new T.Group(); lg.position.set(x, 1.6, z); g.add(lg);
    box(front ? 0.3 : 0.4, 1.55, front ? 0.3 : 0.42, 0, -0.78, 0, blk, lg); box(0.44, 0.18, 0.36, 0.07, -1.55, 0, front ? wht : blk, lg); legs.push(lg);
  });
  const tail = new T.Group(); tail.position.set(-1.4, 2.3, 0); body.add(tail); box(1.5, 0.14, 0.14, -0.75, 0, 0, blk, tail); tail.rotation.z = 0.3;
  const anchor = new T.Object3D(); anchor.position.set(-1.55, 1.7, 0); body.add(anchor);
  g.userData = { body, legs, tail, head, anchor }; g.scale.setScalar(1.15); return g;
}
function tintPawn(p, hex) {   // colora temporaneamente la pedina (es. di verde per la puzza)
  p.obj.children[0].traverse((m) => { if (!m.isMesh) return; if (m.userData.col0 === undefined) m.userData.col0 = m.material.color.getHex(); m.material.color.setHex(hex === null ? m.userData.col0 : hex); });
}
function slotPos(p) {
  const same = players.filter((q) => q.pos === p.pos), i = same.indexOf(p), n = same.length, s = SQ[p.pos];
  if (n < 2) return { x: s.x, z: s.z };
  const a = (i / n) * Math.PI * 2 + 0.6; return { x: s.x + Math.cos(a) * 1.7, z: s.z + Math.sin(a) * 1.7 };
}
function placePawns() { players.forEach((p) => { if (p.animating) return; const q = slotPos(p); p.obj.position.set(q.x, PAWN_Y, q.z); }); }
function tween(ms, fn) { if (Q.fast) { fn(1); return Promise.resolve(); } const g = typeof gen === "undefined" ? 0 : gen; return new Promise((res) => { const t0 = performance.now(); (function f(now) { if (typeof gen !== "undefined" && g !== gen) return; const t = Math.min(1, (now - t0) / ms); fn(t); t < 1 ? requestAnimationFrame(f) : res(); })(t0); }); }
async function hop(p, toN, ms = 520, arc = 4.5, quiet = false) {
  p.animating = true; const fromN = p.pos; p.pos = toN;
  if (ms <= 700 && !quiet && typeof players !== "undefined" && p === players[cur] && SQ[fromN] && SQ[toN]) { cam.moveDir = { x: SQ[toN].x - SQ[fromN].x, z: SQ[toN].z - SQ[fromN].z }; cam.movingUntil = performance.now() + ms + 350; }   // la camera si gira nella direzione di marcia
  const a = p.obj.position.clone(), b = slotPos(p);
  await tween(ms, (t) => p.obj.position.set(a.x + (b.x - a.x) * t, PAWN_Y + Math.sin(t * Math.PI) * arc, a.z + (b.z - a.z) * t));
  p.animating = false; placePawns(); if (!quiet) Sfx.step();
}

function controls(cv) {   // trascina per ruotare la visuale (lo zoom è fisso)
  let down = null, moved = 0;
  cv.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; moved = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; moved += Math.abs(dx) + Math.abs(dy); lastInput = performance.now(); cam.yaw -= dx * 0.005; cam.pitch = Math.max(0.12, Math.min(1.45, cam.pitch + dy * 0.004)); down = { x: e.clientX, y: e.clientY }; }
    else if (e.pointerType === "mouse") hover(e);
  });
  const up = (e) => { if (down && moved < 8 && e.type === "pointerup") clickSquare(e); down = null; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
}
const ray = new T.Raycaster(), mouse = new T.Vector2();
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
  const h = ray.intersectObjects(discs)[0]; return h ? h.object.userData.n : 0;
}
function squareDesc(n) {
  const q = SQ[n], EV = { giba: " (lo spaccio del mafioso di Giba: stesso shop di Narcao)", mattia: " (Mattia ti vuole far giocare a Roblox)", pecore: " (gregge di pecore: paghi 1€ al pastore o salti un turno)", pesca: " (il pescatore di Calasetta: minigioco della pesca)", negroni: " (Marilena e il Negroni sbagliato: 2€, +2 o −2 al prossimo tiro)", simone: " (il Rockettaro)", carloforte: " (traghetto per Carloforte)", ponzu: " (Ponzu Sushi)", tonnara: " (bottega del tonno: carte tonno scontate)", narcao: " (Narcao: il boss e il suo shop)", bacu: " (Bacu Abis: architettura e muro)", nuxis: " (il principe di Nuxis e i suoi servizi da ragno)", scuola: " (Liceo Emilio Lussu: salti un turno)", renzo: " (pizzeria Renzo e Rita)", rubiu: " (burrificio Rubiu: birra e pizza)", bocca: " (Il Boccadillos: +1 ❤️ e panini)", vecchio: " (il vecchio di Cussorgia)" };
  return `${q.rich ? "Casella blu: +3€" : KIND_NAME[q.kind] || ""}${EV[q.event] || ""}${q.tonnoOnly ? " (zona Tonnara: solo carte tonno)" : ""}${q.heart ? " · ❤️ passandoci sopra recuperi 1 cuore" : ""}${n === HOME ? " · 🏠 casa" : ""} · ${zoneOf(n).nome}`;
}
function hover(e) {
  const n = pick(e), tip = $("#tip"); if (!n) { tip.hidden = true; return; }
  const s = SQ[n]; tip.innerHTML = `<b>${n <= FINISH ? n + ". " : "Carloforte "}${s.label || ""}</b><br><small>${squareDesc(n)}</small>`;
  tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY + 14 + "px"; tip.hidden = false;
}
function clickSquare(e) {
  const n = pick(e); if (!n || !$("#modal").hidden) return;
  modal(`<h2>Casella ${n <= FINISH ? n : "di Carloforte " + (n - CARL0 + 1)}${SQ[n].label ? ": " + SQ[n].label : ""}</h2><p>${squareDesc(n)}</p>`, "Chiudi");
}
let VDIST = 1;
function resize() {
  const w = innerWidth, h = innerHeight, asp = w / h; renderer.setSize(Math.round(w * PIX), Math.round(h * PIX), false);
  camera.aspect = asp; camera.fov = asp < 1 ? 67 : 55;   // in verticale (telefono) campo visivo più ampio: immagine meno stretta
  VDIST = asp < 1 ? 1.25 : 1; camera.updateProjectionMatrix();
}
let tPrev = 0; const wp = new T.Vector3();
function frame(now) {
  const t = now / 1000, dt = Math.min(0.05, t - tPrev); tPrev = t;
  const pa = seaMesh.geometry.attributes.position, a = pa.array;
  for (let i = 0; i < a.length; i += 3) a[i + 1] = Math.sin(seaBase[i] * 0.02 + t * 0.9) * 0.9 + Math.cos(seaBase[i + 2] * 0.03 + t * 0.7) * 0.8;
  pa.needsUpdate = true;
  floaters.forEach((f, i) => (f.position.y = (f.userData.y ??= f.position.y) + Math.sin(t * 2 + i) * 0.3));
  players.forEach((p, i) => { const cu = inGame && i === cur; p.obj.rotation.y += dt * (cu ? 3 : 0.6); p.obj.children[0].scale.setScalar(cu ? 1 + Math.sin(t * 6) * 0.06 : 1); if (p.obj.userData.flame) p.obj.userData.flame.scale.set(1, 0.8 + Math.sin(t * 25 + i) * 0.3, 1); });
  if (cam.mode === "menu") { cam.yaw += dt * 0.06; cam.goal.set(SQ[1].x, LAND_H + 2, SQ[1].z); cam.goalDist = 60; cam.pitch = 0.5; }
  else {   // terza persona: sempre dietro al giocatore di turno
    const P = cam.focus || (players[cur] && players[cur].obj.position);
    if (P) cam.goal.set(P.x, P.y + 3, P.z);
    if (!cam.focus && !cam.keepDist) cam.goalDist = FOLLOW_DIST * VDIST;
    cam.goalDist = Math.max(MIN_DIST, Math.min(MAX_DIST, cam.goalDist));
    const nowT = performance.now();
    if (nowT < cam.movingUntil && !cam.focus && nowT - lastInput > 1500) {   // mentre il giocatore si sposta: segue la direzione di marcia e sospende la rotazione automatica
      const want = Math.atan2(-cam.moveDir.x, -cam.moveDir.z), dy2 = ((want - cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; cam.yaw += dy2 * Math.min(1, dt * 2.5);
    } else if (nowT - lastInput > 15000) cam.yaw -= dt * 0.12;   // gira lentamente finché non la sposti (poi ferma 15 s)
  }
  cam.target.lerp(cam.goal, Math.min(1, dt * 6)); cam.dist += (cam.goalDist * (cam.focus && VDIST > 1 ? 1.2 : 1) - cam.dist) * Math.min(1, dt * 3);   // in verticale le animazioni si vedono da un po' più lontano, così stanno nello schermo
  camera.position.set(cam.target.x + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw), cam.target.y + cam.dist * Math.sin(cam.pitch), cam.target.z + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw));
  if (cam.shake) camera.position.add(new T.Vector3((Math.random() - 0.5) * cam.shake, (Math.random() - 0.5) * cam.shake, 0));
  updateDomLabels();
  fadeSprites.forEach((sp) => { sp.getWorldPosition(wp); sp.material.opacity = Math.max(0, Math.min(1, (camera.position.distanceTo(wp) - 30) / 25)); });
  if (typeof extraFrame === "function") extraFrame(t, dt);
  camera.lookAt(cam.target); renderer.render(scene, camera);
}

