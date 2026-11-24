"use strict";
/* ===== SulcisOca – contenuti nuovi: porti, bar genovese, casa di Paolo, casa della 39, Nobody Lives Here Lands,
   Narcao (boss + shop), Tonnara (bottega del tonno), Bacu Abis (muro), minigioco della gonna a Gonnesa,
   pizzo (guardia del corpo), Renault 4, sicario, pistola. Animazioni + modelli; le regole sono in rules.js. ===== */

const sideOf = (n, dist, along = 0) => { const s = SQ[n], d = roadDir(n); return V3(s.x + d.sx * dist + d.fx * along, LAND_H, s.z + d.sz * dist + d.fz * along); };
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);   // per gli oggetti che "guardano" verso +Z
function gunshot() { Sfx.noise(0.22, "lowpass", 4200, 300, 0.55); Sfx.noise(0.5, "bandpass", 900, 120, 0.18, 0.05); }

/* ---------- modelli statici ---------- */
function makePort() {   // molo in legno con bitte, un lampione e una barchetta ormeggiata
  const g = new T.Group();
  box(16, 0.5, 4, 0, 0.25, 0, 0x8a6a45, g); for (let i = -7; i <= 7; i += 3.5) box(0.5, 2.4, 0.5, i, -0.8, 1.8, 0x5e4630, g), box(0.5, 2.4, 0.5, i, -0.8, -1.8, 0x5e4630, g);
  [-6, -2, 2, 6].forEach((x) => { const b = new T.Mesh(new T.CylinderGeometry(0.3, 0.4, 0.8, 6), LM({ color: 0x2f2f2f })); b.position.set(x, 0.9, 1.6); g.add(b); });
  box(0.25, 5, 0.25, 7.5, 2.7, -1.6, 0x333333, g); box(0.8, 0.5, 0.8, 7.5, 5.3, -1.6, 0xfff2a8, g, false);
  const boat = makeBoat(); boat.scale.setScalar(0.7); boat.position.set(-2, -0.6, 4.4); g.add(boat);
  return g;
}
function makeBarGenovese() {   // bar genovese: muri chiari, tenda a strisce, insegna BAR, tavolini fuori
  const g = new T.Group();
  box(7, 4, 5, 0, 2, 0, 0xf1e3c4, g); box(7.3, 0.4, 5.3, 0, 4.2, 0, 0xb5472b, g);
  for (let i = 0; i < 7; i++) box(1, 0.25, 2.2, -3 + i, 3.2, 3.4, i % 2 ? 0xffffff : 0x1f6fb5, g);       // tenda a strisce
  box(1.4, 2.4, 0.1, 0, 1.2, 2.52, 0x5a3a22, g); box(1.6, 1.3, 0.1, 2.3, 2.1, 2.52, 0x9fd3f0, g); box(1.6, 1.3, 0.1, -2.3, 2.1, 2.52, 0x9fd3f0, g);
  [2.3, -2.3].forEach((x) => box(1.8, 0.15, 0.25, x, 1.4, 2.6, 0xffffff, g)); box(0.3, 1.6, 0.3, 3.3, 0.8, 4.4, 0x777777, g);   // davanzali e lavagna del menù
  const menu = labelSprite("☕ 10€", 34, "rgba(20,20,20,.9)", "#fff", 0.9); menu.position.set(3.3, 1.9, 4.6); g.add(menu);
  const sign = labelSprite("☕ BAR GENOVESE", 44, "rgba(20,40,90,.9)", "#fff", 1.6); sign.position.set(0, 5.4, 2.6); g.add(sign);
  [-2.5, 2.5].forEach((x) => { const t = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 0.12, 10), LM({ color: 0xffffff })); t.position.set(x, 1.1, 5.2); g.add(t); box(0.15, 1.1, 0.15, x, 0.55, 5.2, 0x777777, g); });
  return g;
}
function makePaoloHouse() {   // casetta di Paolo Vallebona (da cui esce)
  const g = new T.Group();
  box(5, 3.6, 4.4, 0, 1.8, 0, 0xf3c9a0, g);
  const roof = new T.Mesh(new T.ConeGeometry(4.1, 2, 4), LM({ color: 0xa8432a })); roof.position.y = 4.6; roof.rotation.y = Math.PI / 4; g.add(roof);
  box(1.2, 2.2, 0.1, 0, 1.1, 2.22, 0x3c6e9e, g); box(1, 1, 0.1, 1.6, 2.2, 2.22, 0x9fd3f0, g); box(1, 1, 0.1, -1.6, 2.2, 2.22, 0x9fd3f0, g);
  [1.6, -1.6].forEach((x) => { box(1.2, 0.12, 0.2, x, 1.65, 2.28, 0xffffff, g); box(0.35, 1.1, 0.08, x - 0.72, 2.2, 2.26, 0x2e7d32, g); box(0.35, 1.1, 0.08, x + 0.72, 2.2, 2.26, 0x2e7d32, g); });   // davanzali e persiane verdi
  box(0.12, 0.12, 0.1, 0.4, 1.1, 2.3, 0xd4af37, g); box(2, 0.25, 1, 0, 0.12, 2.8, 0xbbbbbb, g); box(0.8, 1.5, 0.8, -1.5, 5, -1, 0x9c4a32, g);   // maniglia, gradino, comignolo
  return g;
}
function makeHouse39() {   // la casa della casella 39: palazzina beige di 3 piani, balconi, pilastro in mattoni, negozio "ACQUA & SAPONE" al piano terra
  const g = new T.Group(), BEIGE = 0xe9dcc0, TRAV = 0xd8cbb0, BRICK = 0x9c4a32;
  box(16, 9.5, 7, 0, 4.75, 0, BEIGE, g); box(16.1, 3, 7.1, 0, 1.5, 0, TRAV, g);                                 // volume e zoccolo in travertino
  box(1.4, 10.4, 1.2, 4.2, 5.2, 3.2, BRICK, g);                                                               // pilastro in mattoni
  const ring = new T.Mesh(new T.TorusGeometry(0.45, 0.12, 6, 12), LM({ color: 0xf2f2f2 })); ring.position.set(4.2, 9.2, 3.85); g.add(ring);
  [-5, 0.5, 6.4].forEach((x) => { box(2.6, 2.4, 0.1, x, 1.3, 3.55, 0x8d9296, g); });                         // serrande
  [-5.4, 0.2].forEach((x) => { box(4.2, 0.9, 0.12, x, 2.75, 3.6, 0x1f3f99, g); const s = labelSprite("ACQUA & SAPONE", 40, "rgba(255,255,255,.95)", "#1f3f99", 0.8); s.position.set(x, 2.75, 3.75); g.add(s); });
  [[-4.6, 4.6], [0.2, 4.6], [-4.6, 7.4], [0.2, 7.4], [6.4, 4.6], [6.4, 7.4]].forEach(([x, y]) => {        // balconi con ringhiera scura + finestre
    box(3.4, 0.25, 1.4, x, y - 1, 4.1, 0xcfc2a6, g); box(3.4, 1, 0.08, x, y - 0.4, 4.8, 0x4a4036, g);
    box(1.1, 1.6, 0.1, x - 0.6, y, 3.52, 0x6e4a2e, g);
  });
  box(16.4, 0.4, 7.4, 0, 9.7, 0, 0xcfc2a6, g);
  return g;
}
function makeTunaStall() {   // mini bottega del tonno: bancone, tenda, tonni appesi
  const g = new T.Group();
  box(6, 1.4, 2, 0, 0.7, 0, 0x8a6a45, g); box(6.2, 0.15, 2.2, 0, 1.45, 0, 0xdedede, g);
  [-2.8, 2.8].forEach((x) => box(0.25, 4, 0.25, x, 2, -0.9, 0x5e4630, g)); box(6.6, 0.3, 2.8, 0, 4.1, -0.3, 0xd62828, g);
  for (let i = 0; i < 3; i++) { const t = makeTuna(); t.scale.setScalar(0.55); t.rotation.z = Math.PI / 2; t.position.set(-1.8 + i * 1.8, 2.8, -0.6); g.add(t); }
  for (let i = 0; i < 2; i++) { const t = makeTuna(); t.scale.setScalar(0.5); t.position.set(-1 + i * 2, 1.8, 0.3); g.add(t); }
  const s = labelSprite("🐟 TONNO DI TONNARA", 40, "rgba(120,10,10,.9)", "#fff", 1.4); s.position.set(0, 5.1, 0); g.add(s);
  return g;
}
function makePithead() {   // castello minerario di Bacu Abis
  const g = new T.Group(), M = 0x6d4a3a;
  [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].forEach(([x, z]) => { const l = box(0.35, 12, 0.35, x * 0.6, 6, z * 0.6, M, g); l.rotation.z = x * 0.04; l.rotation.x = -z * 0.04; });
  for (let y = 2; y < 12; y += 2.5) box(2.4, 0.2, 2.4, 0, y, 0, M, g);
  const wheel = new T.Mesh(new T.TorusGeometry(1.6, 0.15, 6, 16), LM({ color: 0x3a3a3a })); wheel.position.set(0, 12.6, 0); g.add(wheel); g.userData.wheel = wheel;
  box(6, 4, 4, 4, 2, 0, 0xc9b28f, g); box(6.2, 0.4, 4.2, 4, 4.1, 0, 0x8a3b2a, g);
  return g;
}
function makeWall() {   // muro di mattoni di traverso sulla strada
  const g = new T.Group();
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) box(1.15, 0.7, 0.9, -2.9 + c * 1.18 + (r % 2) * 0.55, 0.4 + r * 0.74, 0, r % 2 ? 0xa0472f : 0xb5563a, g);
  return g;
}
function makeR4() {   // Renault 4 bianca, squadrata
  const g = new T.Group();
  box(5.2, 1.4, 2.4, 0, 1.1, 0, 0xeeeeea, g); box(3.4, 1.3, 2.3, -0.5, 2.4, 0, 0xeeeeea, g);
  box(3.2, 1, 2.35, -0.5, 2.45, 0, 0x2b3b4a, g); box(0.1, 0.7, 2, 2.62, 1.2, 0, 0x888888, g);
  [[-1.7, 1.25], [1.7, 1.25], [-1.7, -1.25], [1.7, -1.25]].forEach(([x, z]) => { const w = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.4, 10), LM({ color: 0x151515 })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.55, z); g.add(w); });
  box(3, 0.15, 2, -0.5, 3.15, 0, 0x555555, g);                       // portapacchi
  for (let i = 0; i < 4; i++) box(0.08, 0.3, 2.1, -1.8 + i * 0.85, 3.3, 0, 0x555555, g);
  [0.75, -0.75].forEach((z) => { box(0.12, 0.42, 0.42, 2.66, 1.35, z, 0xfffbd0, g, false); box(0.12, 0.25, 0.3, -2.62, 1.3, z, 0xd62828, g, false); });   // fari e fanali
  box(0.12, 0.3, 2.5, 2.7, 0.65, 0, 0x9a9a9a, g); box(0.12, 0.3, 2.5, -2.66, 0.65, 0, 0x9a9a9a, g);                                                 // paraurti
  for (let i = 0; i < 4; i++) box(0.05, 0.08, 0.9, 2.64, 1.05 + i * 0.12, 0, 0x333333, g);                                                       // griglia
  [0.3, -1.2].forEach((x) => box(0.3, 0.06, 0.05, x, 1.6, 1.21, 0x222222, g));                                                                        // maniglie
  return g;
}
const makeHood = () => makeHuman({ skin: 0x8a6a55, shoe: 0x111111, shorts: 0x1c1c1c, top: 0x262626, mouth: 0x3a2a22,
  hair: (head) => { box(1.3, 1.35, 1.25, 0, 0.12, -0.05, 0x262626, head); box(1.3, 0.25, 0.2, 0, 0.62, 0.58, 0x262626, head); },
  extra: (head, body, arms) => { const k = box(0.1, 0.9, 0.12, 0, -1.6, 0.25, 0xcfd6dc, arms[1], false); k.rotation.x = 0.4; } });   // incappucciato con coltello
const makeBoss = () => makeHuman({ skin: 0xe0b08e, shoe: 0x111111, shorts: 0x222a3a, top: 0x111111, mouth: 0x8a3b3b,
  extra: (head, body, arms) => {   // punk pelato e tatuato: canotta nera, catena d'oro, tatuaggi su braccia e testa
    [-0.3, 0.2].forEach((y) => box(0.44, 0.18, 0.44, 0, y - 0.6, 0, 0x2e5d3a, arms[0])); [-0.2, -0.9].forEach((y) => box(0.44, 0.2, 0.44, 0, y, 0, 0x2e5d3a, arms[1]));
    box(0.5, 0.35, 0.1, 0.25, 0.35, 0.54, 0x2e5d3a, head); box(0.1, 0.5, 0.5, 0.56, 0.1, 0, 0x2e5d3a, head);
    box(1.2, 0.12, 0.2, 0, 4.6, 0.48, 0xffd23f, body); box(0.3, 0.3, 0.12, 0, 4.35, 0.52, 0xffd23f, body);
    box(0.9, 0.18, 0.08, 0, 0.12, 0.55, 0x111111, head);   // occhiali scuri
  } });
const makeMafioso = () => makeHuman({ skin: 0xd9a782, shoe: 0x111111, shorts: 0x111111, top: 0x1a1a1a, mouth: 0x7a3b3b,
  hair: (head) => { box(1.15, 0.3, 1.1, 0, 0.55, 0, 0x111111, head); box(1.6, 0.12, 1.6, 0, 0.72, 0, 0x111111, head); box(1, 0.35, 1, 0, 0.95, 0, 0x111111, head); },   // borsalino
  extra: (head, body, arms) => { box(0.9, 0.18, 0.08, 0, 0.12, 0.55, 0x111111, head); box(0.3, 1.2, 0.1, 0, 3.9, 0.47, 0xffffff, body); box(0.4, 0.3, 0.5, 0.75, 2.8, 0.2, 0x222222, body);
    arms[0].rotation.x = arms[1].rotation.x = 0.35; arms[0].rotation.z = 0.25; arms[1].rotation.z = -0.25; } });   // mani in tasca, pistola alla cintura

/* ---------- decorazioni fisse sulla mappa ---------- */
let MATTIA = null, PAOLO_DOOR = null, PONZU_BLD = null, TUNA_BLD = null, NUXIS_HOME = null;
function buildExtras() {
  const add = (obj, pos, yaw) => { obj.position.copy(pos); obj.rotation.y = yaw; scene.add(obj); spritesToDom(obj); return obj; };
  // porto di Calasetta (verso Carloforte) e porto di Carloforte (verso Calasetta)
  const cal = SQ[30], c1 = SQ[CARL0], c2 = SQ[CARL0 + 1];
  const toC = V3(c1.x - cal.x, 0, c1.z - cal.z).normalize(), pCal = V3(cal.x + toC.x * 9, LAND_H - 0.2, cal.z + toC.z * 9);
  add(makePort(), pCal, Math.atan2(-toC.z, toC.x) + Math.PI / 2);
  const mc = V3((c1.x + c2.x) / 2 - toC.x * 8, LAND_H - 0.2, (c1.z + c2.z) / 2 - toC.z * 8);
  add(makePort(), mc, Math.atan2(-toC.z, toC.x) + Math.PI / 2);
  // Carloforte: casetta di Paolo (C3) e bar genovese (C4)
  const sq3 = SQ[CARL0 + 2], sq4 = SQ[CARL0 + 3], dC = V3(sq4.x - sq3.x, 0, sq4.z - sq3.z).normalize(), sideC = V3(-dC.z, 0, dC.x);
  const ph = V3(sq3.x + sideC.x * 8, LAND_H, sq3.z + sideC.z * 8); add(makePaoloHouse(), ph, yawTo(ph, sq3));
  PAOLO_DOOR = ph.clone().add(V3(sq3.x - ph.x, 0, sq3.z - ph.z).normalize().multiplyScalar(2.6));
  const pb = V3(sq4.x + sideC.x * 8, LAND_H, sq4.z + sideC.z * 8); add(makeBarGenovese(), pb, yawTo(pb, sq4));
  // casa della casella 39 (dove il Rockettaro ti manda a casa)
  const h39 = sideOf(HOME, -13); add(makeHouse39(), h39, yawTo(h39, SQ[HOME]));
  // Sant'Antioco: liceo, pizzeria, burrificio, Boccadillos
  { const evN = (ev) => +Object.keys(PERC.eventi || {}).find((k) => PERC.eventi[k] === ev);
    [["scuola", makeLiceo, 11], ["bocca", () => makeShopBld("🥪 IL BOCCADILLOS", 0xffe08a, 0xc62828, false), -11], ["renzo", () => makeShopBld("🍕 PIZZERIA RENZO E RITA", 0xf3d9b1, 0x2e7d32, true), -11], ["rubiu", () => makeShopBld("🧈 RUBIU BURRIFICIO", 0xfff3d6, 0x1f5fa8, false), 11]]
      .forEach(([ev, mk, side]) => { const n = evN(ev); if (!n || !SQ[n]) return; const pos = sideOf(n, side); add(mk(), pos, yawTo(pos, SQ[n])); }); }
  // Mattia: sempre lì alla sua casella, col telefono in mano, che aspetta qualcuno con cui giocare a Roblox
  if (PERC.verdi.mattia) { const n = PERC.verdi.mattia[0], pos = sideOf(n, 4.5); MATTIA = makeMattia(); MATTIA.scale.setScalar(0.5); add(MATTIA, pos, yawTo(pos, SQ[n])); MATTIA.userData.home = pos.clone(); MATTIA.userData.arms[1].rotation.x = -1.1; }
  // Ponzu Sushi: sempre visibile accanto alle caselle verdi di Santadi
  { const n = PERC.verdi.ponzu ? Math.round((PERC.verdi.ponzu[0] + PERC.verdi.ponzu[1]) / 2) : 86, pos = sideOf(n, 18); PONZU_BLD = add(makePonzu(), pos, 0); PONZU_BLD.rotation.y = Math.atan2(-roadDir(n).sx, -roadDir(n).sz); }
  // bottega del tonno (Tonnara) e tana del principe di Nuxis: sempre visibili
  { const n = Math.round((PERC.verdi.tonnara[0] + PERC.verdi.tonnara[1]) / 2), pos = sideOf(n, 8); TUNA_BLD = add(makeTunaStall(), pos, yawTo(pos, SQ[n])); }
  if (PERC.verdi.nuxis) { const n = Math.round((PERC.verdi.nuxis[0] + PERC.verdi.nuxis[1]) / 2), pos = sideOf(n, -10); NUXIS_HOME = pos; add(makeWebNest(), pos, yawTo(pos, SQ[n])); }
  // castello minerario a Bacu Abis
  const pt = sideOf(Math.round((PERC.verdi.bacu[0] + PERC.verdi.bacu[1]) / 2), -14); const pit = add(makePithead(), pt, 0); floatersPit.push(pit);
}
const floatersPit = [];

/* ---------- elementi dinamici: muri, guardie del pizzo, effetto cocaina ---------- */
const wallObjs = new Map(); let guardObjs = new Map();
function extraFrame(t, dt) {
  floatersPit.forEach((p) => (p.userData.wheel.rotation.z += dt * 1.2));
  if (typeof players === "undefined") return;
  // muri
  const want = new Set((typeof walls !== "undefined" && inGame ? walls : []).map((w) => w.pos));
  wallObjs.forEach((o, pos) => { if (!want.has(pos)) { scene.remove(o); wallObjs.delete(pos); } });
  want.forEach((pos) => { if (!wallObjs.has(pos) && SQ[pos]) { const o = makeWall(), d = roadDir(pos); o.position.set(SQ[pos].x + d.fx * 1.2, LAND_H + 0.3, SQ[pos].z + d.fz * 1.2); o.rotation.y = Math.atan2(d.fx, d.fz); o.scale.setScalar(1.1); scene.add(o); wallObjs.set(pos, o); } });
  // guardie del corpo per chi paga il pizzo: stanno a distanza, mani in tasca, e seguono la pedina
  players.forEach((p, i) => {
    let gd = guardObjs.get(i);
    if (inGame && p.pizzo && !p.finished) {
      if (!gd) { gd = makeMafioso(); gd.scale.setScalar(0.55); gd.position.copy(p.obj.position); scene.add(gd); guardObjs.set(i, gd); }
      const d = roadDir(Math.min(FINISH, Math.max(1, p.pos <= FINISH ? p.pos : 30))), goal = V3(p.obj.position.x - d.fx * 7 + d.sx * 5, LAND_H, p.obj.position.z - d.fz * 7 + d.sz * 5);
      if (!gd.userData.busy) { gd.position.lerp(goal, Math.min(1, dt * 1.5)); gd.position.y = LAND_H; gd.rotation.y = yawTo(gd.position, p.obj.position); }
    } else if (gd) { scene.remove(gd); guardObjs.delete(i); }
  });
  document.body.classList.toggle("coke", !!(inGame && players[cur] && players[cur].coke > 0));
}

/* ---------- Nobody Lives Here Lands: qualcuno si avvicina alle spalle, tu scappi indietro ---------- */
async function eventStranger(p, dest) {
  const g0 = gen, spot = p.obj.position.clone(), d = roadDir(p.pos), hood = makeHood(); hood.scale.setScalar(0.72);
  log(`😰 ${p.name} si sente molto solo… e sente dei passi alle spalle!`); toast("😶 Ti senti molto solo…");
  Music.hold(true);
  const start = V3(spot.x + d.fx * 22 + d.sx * 3, LAND_H, spot.z + d.fz * 22 + d.sz * 3), near = V3(spot.x + d.fx * 4 + d.sx * 1.5, LAND_H, spot.z + d.fz * 4 + d.sz * 1.5);
  if (!Q.fast) { hood.position.copy(start); scene.add(hood); faceTo(hood, start, spot); camFocus(spot.clone(), 18, 0.32, d.yaw + Math.PI); }
  await gsleep(900); if (g0 !== gen) return;
  toast("👣 Senti dei passi dietro di te…"); let nextStep = 0;
  await tween(3400, (t) => { hood.position.lerpVectors(start, near, t * t); hood.position.y = LAND_H + Math.abs(Math.sin(t * 18)) * 0.2; swingLegs(hood.userData.legs, t * 0.6, 0.45); if (t * 3400 > nextStep) { nextStep += 420 - t * 200; Sfx.step(); } });
  if (g0 !== gen) return;
  // ti accoltella alle spalle e scappa via
  toast("🔪 Ti accoltella alle spalle!"); log(`🔪 Lo sconosciuto accoltella ${p.name} alle spalle.`);
  await tween(500, (t) => { hood.userData.arms[1].rotation.x = -1.6 * Math.sin(t * Math.PI); hood.position.lerpVectors(near, spot, t * 0.35); });
  cam.shake = 0.9; for (let i = 0; i < 10 && !Q.fast; i++) fxSpawn(ico(0.25, 0xaa1111, 0.9), spot.clone().add(V3(0, 1.5, 0)), V3(rj(5), 3 + Math.random() * 3, rj(5)), 0.8, { grav: -12 });
  await gsleep(500); cam.shake = 0; if (g0 !== gen) return;
  const away = start.clone(); faceTo(hood, hood.position, away); const hp0 = hood.position.clone();
  await tween(1200, (t) => { hood.position.lerpVectors(hp0, away, t); hood.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.3; swingLegs(hood.userData.legs, t * 1.5, 0.7); });
  scene.remove(hood); camBack(); Music.hold(false); redraw();
  if (g0 !== gen) return;
  toast("🩸 Hai perso 1 ❤️"); await damage(p, 1, "accoltellato alle spalle"); redraw();
}

/* ---------- pizzo: il mafioso spara a chi ti vuole dare fastidio ---------- */
async function mafiaSave(p, who) {
  const g0 = gen, spot = p.obj.position.clone(), d = roadDir(Math.min(FINISH, p.pos)), npc = who === "mamma" ? makeMamma() : who === "angelica" ? makeAngelica() : makeHood(); npc.scale.setScalar(0.72);
  const start = V3(spot.x + d.sx * 24, LAND_H, spot.z + d.sz * 24), near = V3(spot.x + d.sx * 5, LAND_H, spot.z + d.sz * 5);
  if (!Q.fast) { npc.position.copy(start); scene.add(npc); faceTo(npc, start, spot); camFocus(mid2(spot, near), 22, 0.42, d.yaw + 0.8); }
  toast(who === "mamma" ? "🍟 Arriva la mamma di Giorgia…" : who === "angelica" ? "🧹 Porca puttana... Arriva Marilena…" : "Qualcuno si avvicina…");
  await tween(1800, (t) => { npc.position.lerpVectors(start, near, t); npc.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.3; swingLegs(npc.userData.legs, t, 0.6); });
  if (g0 !== gen) return;
  const gd = guardObjs.get(players.indexOf(p)) || (() => { const m = makeMafioso(); m.scale.setScalar(0.55); m.position.copy(spot).add(V3(-d.fx * 7, 0, -d.fz * 7)); if (!Q.fast) scene.add(m); m.userData.temp = true; return m; })();
  gd.userData.busy = true; faceTo(gd, gd.position, npc.position); gd.userData.arms[1].rotation.x = -1.5; gd.userData.arms[1].rotation.z = 0;
  toast("💼 «Lascialo stare. Paga il pizzo.»"); await gsleep(600); if (g0 !== gen) return;
  gunshot(); fxSpawn(ico(0.5, 0xffd23f, 0.95), gd.position.clone().add(V3(0, 3.5, 0)), V3(0, 1, 0), 0.25, { grow: 2 }); cam.shake = 0.8;
  await tween(700, (t) => { npc.rotation.x = -Math.PI / 2 * t; npc.position.y = LAND_H + 0.2 - t * 0.6; }); cam.shake = 0;
  await gsleep(500); scene.remove(npc); gd.userData.arms[1].rotation.x = 0.35; gd.userData.arms[1].rotation.z = -0.25; gd.userData.busy = false; if (gd.userData.temp) scene.remove(gd);
  log(`💼 Il mafioso di ${p.name} sistema la faccenda: si va avanti come se niente fosse.`); toast("😎 Vai avanti come se niente fosse"); camBack();
}

/* ---------- Narcao, Tonnara, Bacu Abis: chi ti accoglie prima dello shop ---------- */
async function narcaoIntro(p) {
  const spot = p.obj.position.clone(), d = roadDir(p.pos), boss = makeBoss(); boss.scale.setScalar(0.75);
  const start = V3(spot.x + d.sx * 22, LAND_H, spot.z + d.sz * 22), near = V3(spot.x + d.sx * 4, LAND_H, spot.z + d.sz * 4);
  if (!Q.fast) { boss.position.copy(start); scene.add(boss); faceTo(boss, start, spot); camFocus(mid2(spot, near).add(V3(0, 2, 0)), 16, 0.32, d.yaw + 0.9); }
  Music.hold(true); const song = Sfx.play("sfx/narcao.mp3");
  Sfx.horn(); await tween(1800, (t) => { boss.position.lerpVectors(start, near, t); boss.position.y = LAND_H + Math.abs(Math.sin(t * 26)) * 0.3; swingLegs(boss.userData.legs, t, 0.6); });
  faceTo(boss, near, spot); toast("😎 «Ciao, benvenuto a Narcao, la città dei narcotici.»"); log(`💊 ${p.name} incontra il boss di Narcao.`);
  await tween(1600, (t) => { boss.userData.arms[0].rotation.z = 0.3 + Math.sin(t * 12) * 0.5; });
  return () => { scene.remove(boss); song.stop(); Music.hold(false); camBack(); };
}
async function tonnaraIntro(p) {   // la bottega è fissa sulla mappa: la camera ci va e parte la musica
  const spot = p.obj.position.clone(), d = roadDir(p.pos), pos = TUNA_BLD ? TUNA_BLD.position.clone() : spot.clone();
  if (!Q.fast) camFocus(mid2(spot, pos).add(V3(0, 2, 0)), 18, 0.38, d.yaw + 0.8);
  Music.hold(true); const song = Sfx.play("sfx/tonnara.mp3");
  Sfx.chime(); toast("🐟 Bottega del tonno: offerte eccezionali!"); log(`🐟 ${p.name} passa dalla bottega del tonno di Tonnara.`);
  if (TUNA_BLD && !Q.fast) { const s0 = TUNA_BLD.scale.x; await tween(900, (t) => TUNA_BLD.scale.setScalar(s0 * (1 + Math.sin(t * Math.PI) * 0.12))); }
  return () => { song.stop(); Music.hold(false); camBack(); };
}
async function bacuIntro(p) {
  const d = roadDir(p.pos), c = sideOf(p.pos, -7); toast("🏛️ Apprezzi l'architettura di Bacu Abis…"); log(`🏛️ ${p.name} apprezza l'architettura di Bacu Abis.`);
  camFocus(c.clone().add(V3(0, 5, 0)), 30, 0.35, d.yaw);
  const y0 = cam.yaw; await tween(2600, (t) => { if (!Q.fast) cam.yaw = y0 + t * 1.6; });
  return () => camBack();
}

/* ---------- Renault 4: rapimento e scambio di posto ---------- */
async function r4Swap(p, t) {
  const car = makeR4(); car.scale.setScalar(0.9); const a = p.obj.position.clone(), b = t.obj.position.clone();
  if (Q.fast) return;
  car.position.copy(a).setY(LAND_H); scene.add(car); Sfx.engine && Sfx.engine(); toast("🚗 Arriva la Renault 4…");
  const drive = async (from, to, ms) => { car.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x); const cf = from.clone(); camFocus(cf, 26, 0.45); await tween(ms, (u) => { const e = u * u * (3 - 2 * u); car.position.set(from.x + (to.x - from.x) * e, LAND_H + Math.abs(Math.sin(u * 40)) * 0.15, from.z + (to.z - from.z) * e); cf.copy(car.position); }); };
  p.animating = true; p.obj.visible = false; await drive(a, b, 2200);
  toast(`🎒 ${t.name} viene caricato nel bagagliaio!`); Sfx.slap(); t.animating = true; t.obj.visible = false; p.obj.visible = true; p.obj.position.copy(b).setY(PAWN_Y); await gsleep(700);
  await drive(b, a, 2200); t.obj.visible = true; t.obj.position.copy(a).setY(PAWN_Y); Sfx.splat();
  scene.remove(car); p.animating = false; t.animating = false; camBack();
}
/* ---------- sicario e pistola ---------- */
async function sicarioAnim(t) {
  if (Q.fast) return; const d = roadDir(Math.min(FINISH, t.pos)), m = makeMafioso(); m.scale.setScalar(0.65);
  const pos = t.obj.position.clone().add(V3(d.sx * 4, 0, d.sz * 4)); m.position.copy(pos).setY(LAND_H); m.rotation.y = yawTo(pos, t.obj.position); scene.add(m);
  camFocus(mid2(pos, t.obj.position), 14, 0.35, d.yaw + 0.8); toast("🔪 Arriva il sicario…"); await gsleep(900);
  m.userData.arms[1].rotation.x = -1.5; m.userData.arms[1].rotation.z = 0; await gsleep(400); gunshot(); cam.shake = 0.8;
  fxSpawn(ico(0.5, 0xffd23f, 0.95), pos.clone().add(V3(0, 3.2, 0)), V3(0, 1, 0), 0.25, { grow: 2 }); await gsleep(500); cam.shake = 0;
  await tween(800, (u) => { m.position.y = LAND_H - u * 6; }); scene.remove(m);
}
async function shootAnim(shooter, target) {
  if (Q.fast) return; const a = shooter.obj.position.clone().add(V3(0, 2, 0)), b = target.obj.position.clone().add(V3(0, 1.5, 0));
  camFocus(mid2(a, b), 18, 0.4); toast(`🔫 ${shooter.name} spara a ${target.name}!`); await gsleep(500);
  gunshot(); cam.shake = 0.9; const tr = ico(0.35, 0xffe27a, 1); scene.add(tr);
  await tween(250, (u) => tr.position.copy(a).lerp(b, u)); scene.remove(tr); cam.shake = 0;
  for (let i = 0; i < 10; i++) fxSpawn(ico(0.25, 0xaa1111, 0.9), b, V3(rj(6), 3 + Math.random() * 3, rj(6)), 0.8, { grav: -12 });
  await gsleep(600);
}

/* ---------- Gonnesa: il gioco delle tre coppette con le gonne ---------- */
function shellUI(show) { const el = $("#shell"); el.hidden = !show; if (!show) el.innerHTML = ""; return el; }
async function gonnaGame(p) {   // restituisce true se indovina la gonna bella
  const g0 = gen, pi = players.indexOf(p), good = rnd(3);
  const swaps = Array.from({ length: 14 }, () => { const a = rnd(3); let b = rnd(2); if (b >= a) b++; return [a, b]; });
  const cpuPick = p.cpu ? rnd(3) : -1;
  const posOf = [0, 1, 2]; swaps.forEach(([a, b]) => { const ca = posOf.indexOf(a), cb = posOf.indexOf(b); posOf[ca] = b; posOf[cb] = a; });
  const goodSlot = posOf[good];
  log(`👗 ${p.name} arriva a Gonnesa: deve trovare la gonna bella tra tre coppette!`);
  const X = (s) => 8 + s * 31 + "%";
  let el = null;
  if (!Q.fast) {
    el = shellUI(true);
    el.innerHTML = `<h2>👗 Gonnesa: trova la gonna bella!</h2><p class="sh-msg">Solo un vero gonnesiano ha senso dello stile.</p><div class="sh-table">${[0, 1, 2].map((i) => `<div class="sh-item" data-i="${i}" style="left:${X(i)}">${i === good ? "👗<small>gonna bella</small>" : "🩲<small>gonna di merda</small>"}</div><div class="sh-cup up" data-c="${i}" style="left:${X(i)}"></div>`).join("")}</div>`;
    await gsleep(1800); if (g0 !== gen) return shellUI(false), false;
    el.querySelectorAll(".sh-cup").forEach((c) => c.classList.remove("up")); el.querySelector(".sh-msg").textContent = "Si mescola…"; await gsleep(600);
    el.querySelectorAll(".sh-item").forEach((it) => (it.style.visibility = "hidden"));
    const cupAt = [0, 1, 2];   // cupAt[slot] = coppetta in quello slot
    // ~5,5 s, 14 mescolate: parte già svelto e alla fine è velocissimo
    for (let si = 0; si < swaps.length; si++) {
      const [a, b] = swaps[si];
      if (g0 !== gen) return shellUI(false), false;
      const k = 1 - si / (swaps.length - 1), dur = Math.round(170 + 630 * k * k);
      const ca = cupAt[a], cb = cupAt[b]; cupAt[a] = cb; cupAt[b] = ca;
      const ea = el.querySelector(`[data-c="${ca}"]`), eb = el.querySelector(`[data-c="${cb}"]`), tr = `left ${Math.round(dur * 0.85)}ms ease-in-out,transform .3s`;
      ea.style.transition = tr; eb.style.transition = tr;
      ea.style.left = X(b); eb.style.left = X(a); ea.classList.add("hop"); setTimeout(() => ea.classList.remove("hop"), Math.min(420, dur * 0.8)); Sfx.tick(); await gsleep(dur);
    }
  }
  let pick;
  if (p.cpu) { if (el) el.querySelector(".sh-msg").textContent = `🤖 ${p.name} ci pensa…`; await gsleep(1500); pick = cpuPick; }
  else {
    const w = ask(pi, "choice", { k: "choice", v: "0" });
    if (el) {
      if (mine(p)) {
        el.querySelector(".sh-msg").textContent = "👉 Scegli una coppetta!"; let done = false;
        const choose = (s) => { if (done) return; done = true; submit("choice", String(s)); };
        el.querySelectorAll(".sh-cup").forEach((c) => { c.classList.add("pickable"); c.onclick = () => { const left = parseFloat(c.style.left); choose([0, 1, 2].find((s) => Math.abs(8 + s * 31 - left) < 1)); }; });
        setTimeout(() => { if (!done && g0 === gen) choose(0); }, 20000);
      } else el.querySelector(".sh-msg").textContent = `🤔 ${p.name} sta scegliendo…`;
    }
    const a = await w; pick = Math.max(0, Math.min(2, parseInt(a.v, 10) || 0));
  }
  const ok = pick === goodSlot;
  if (el && g0 === gen) {
    el.querySelectorAll(".sh-cup").forEach((c) => { c.onclick = null; c.classList.remove("pickable"); c.classList.add("up"); });
    el.querySelectorAll(".sh-item").forEach((it) => { it.style.visibility = "visible"; it.style.left = X(posOf[+it.dataset.i]); });
    el.querySelector(".sh-msg").innerHTML = ok ? "✨ <b>Gonna bella!</b> Sei un vero gonnesiano!" : "💩 <b>Gonna di merda.</b> Non hai senso dello stile: non sei un vero gonnesiano!";
    (ok ? Sfx.win : Sfx.horn)(); await gsleep(2600);
  }
  shellUI(false);
  log(ok ? `✨ ${p.name} trova la gonna bella!` : `💩 ${p.name} sceglie una gonna di merda.`);
  return ok;
}

/* ---------- morte: arriva l'ambulanza e porta la pedina all'ospedale lungo la strada ---------- */
function makeAmbulance() {
  const g = new T.Group(); box(4.6, 2.2, 2.3, 0, 1.4, 0, 0xffffff, g); box(1.5, 1.4, 2.25, 2.4, 1.0, 0, 0xffffff, g); box(1.2, 0.8, 2.3, 2.6, 1.5, 0, 0x2b3b4a, g);
  box(4.62, 0.35, 2.32, 0, 1.0, 0, 0xd62828, g); box(0.9, 0.3, 0.1, -0.6, 2.0, 1.17, 0xd62828, g); box(0.3, 0.9, 0.1, -0.6, 2.0, 1.17, 0xd62828, g);
  const siren = box(0.6, 0.3, 0.6, 0.6, 2.7, 0, 0x2f6fff, g, false); g.userData.siren = siren;
  [[-1.5, 1.2], [1.6, 1.2], [-1.5, -1.2], [1.6, -1.2]].forEach(([x, z]) => { const w = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.4, 10), LM({ color: 0x151515 })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); });
  return g;
}
async function deathRide(t, h) {
  const g0 = gen;
  if (Q.fast) { t.pos = h; placePawns(); return; }
  t.animating = true; const p0 = t.obj.position.clone(), tilt = t.obj.rotation.z;
  camFocus(p0.clone(), 16, 0.4);
  await tween(700, (u) => { t.obj.rotation.z = tilt + u * 1.5; t.obj.position.y = PAWN_Y - u * 0.6; });   // cade
  const amb = makeAmbulance(); amb.scale.setScalar(0.85); scene.add(amb);
  const from = t.pos >= CARL0 ? t.pos : t.pos, path = [];
  if (from <= FINISH) { const step = h <= from ? -1 : 1; for (let n = from; step < 0 ? n >= h : n <= h; n += step) path.push(V3(SQ[n].x, LAND_H, SQ[n].z)); }
  else path.push(V3(SQ[from].x, LAND_H, SQ[from].z), V3(SQ[h].x, LAND_H, SQ[h].z));
  if (path.length < 2) path.push(path[0].clone());
  const start = path[0].clone().add(V3(10, 0, 6)); amb.position.copy(start);
  Sfx.horn(); toast("🚑 Arriva l'ambulanza…");
  await tween(1300, (u) => { amb.position.lerpVectors(start, path[0], u); amb.rotation.y = Math.atan2(-(path[0].z - start.z), path[0].x - start.x); amb.userData.siren.material.color.setHex(Math.floor(u * 8) % 2 ? 0xff2020 : 0x2f6fff); });
  t.obj.visible = false; t.obj.rotation.z = tilt; if (g0 !== gen) { scene.remove(amb); return; }
  const cf = path[0].clone(); camFocus(cf, 30, 0.5); toast(`🚑 ${t.name} viene portato all'ospedale (casella ${h})`);
  const ms = Math.max(1600, Math.min(5000, path.length * 160));
  await tween(ms, (u) => { const f = u * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), a = path[i], b = path[i + 1] || a; amb.position.copy(a).lerp(b, f - i); amb.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x); cf.copy(amb.position); amb.userData.siren.material.color.setHex(Math.floor(u * 30) % 2 ? 0xff2020 : 0x2f6fff); });
  t.pos = h; t.obj.visible = true; t.animating = false; placePawns(); scene.remove(amb); Sfx.heal();
  await gsleep(500); camBack();
}

/* ---------- edifici di Sant'Antioco ---------- */
function makeLiceo() {   // Liceo Emilio Lussu: lungo edificio scolastico di due piani con finestre a nastro
  const g = new T.Group();
  box(18, 6, 6, 0, 3, 0, 0xe8d8c0, g); box(18.3, 0.5, 6.3, 0, 6.2, 0, 0x9a8f80, g);
  for (const y of [1.8, 4.3]) for (let i = 0; i < 7; i++) box(1.7, 1.2, 0.1, -7.4 + i * 2.45, y, 3.02, 0x7fb3d5, g);
  box(2.2, 2.6, 0.1, 0, 1.3, 3.03, 0x5a3a22, g); box(0.15, 5, 0.15, 7.6, 8.7, 2.4, 0xbbbbbb, g); box(1.6, 1, 0.05, 8.4, 10.6, 2.4, 0x2e7d32, g, false);
  box(1.6, 0.34, 0.05, 8.4, 10.27, 2.4, 0xffffff, g, false); box(1.6, 0.33, 0.05, 8.4, 9.93, 2.4, 0xd62828, g, false);          // tricolore
  box(5, 0.3, 2, 0, 0.15, 4, 0xbbbbbb, g); box(4, 0.3, 1.4, 0, 0.45, 3.8, 0xcccccc, g);                                          // scalinata
  for (let i = 0; i < 6; i++) box(0.2, 1.2, 0.2, -8 + i * 0.6, 0.6, 6.5, 0x555555, g); box(3.4, 0.15, 0.15, -6.5, 1.1, 6.5, 0x555555, g);   // cancellata
  const s = labelSprite("🏫 LICEO EMILIO LUSSU", 44, "rgba(30,30,30,.88)", "#fff", 1.6); s.position.set(0, 8, 3.2); g.add(s);
  return g;
}
function makeShopBld(name, wall, accent, oven) {   // negozietto con insegna (pizzeria, burrificio, Boccadillos)
  const g = new T.Group();
  box(8, 4.4, 6, 0, 2.2, 0, wall, g); box(8.3, 0.4, 6.3, 0, 4.6, 0, 0x9c4a32, g);
  box(8.1, 1, 0.15, 0, 3.6, 3.06, accent, g); box(1.6, 2.4, 0.1, -2, 1.2, 3.05, 0x5a3a22, g); box(3.2, 1.8, 0.1, 1.8, 1.6, 3.05, 0x9fd3f0, g);
  for (let i = 0; i < 6; i++) box(1.35, 0.25, 1.6, -3.4 + i * 1.36, 3.0, 3.8, i % 2 ? 0xffffff : accent, g);
  if (oven) { box(0.9, 2.6, 0.9, 2.8, 5.8, -1.8, 0x8a4a32, g); box(1.1, 0.2, 1.1, 2.8, 7.1, -1.8, 0x5a2a1a, g); }
  box(3.4, 0.15, 0.3, 1.8, 0.62, 3.15, 0xdddddd, g); box(1.8, 0.12, 0.25, -2, 2.45, 3.12, 0xdddddd, g);          // davanzale e architrave
  box(2.6, 0.2, 1.2, -2, 0.1, 3.6, 0xbbbbbb, g);                                                                 // gradino
  [-3.6, 3.6].forEach((x) => { const v = new T.Mesh(new T.CylinderGeometry(0.4, 0.3, 0.6, 8), LM({ color: 0xa0522d })); v.position.set(x, 0.3, 3.6); g.add(v); const pl = new T.Mesh(new T.IcosahedronGeometry(0.5, 0), LM({ color: 0x3f8f3a })); pl.position.set(x, 0.95, 3.6); g.add(pl); });
  const s = labelSprite(name, 42, "rgba(25,15,8,.88)", "#fff", 1.5); s.position.set(0, 6.4, 3.2); g.add(s);
  return g;
}

/* ---------- il Rockettaro ti insegue fino a casa e poi sparisce con un tuono ---------- */
async function simoneChase(p, sim, home) {
  const g0 = gen, LOST_MS = 14000, t0 = performance.now(); Music.hold(true); const song = Sfx.play("sfx/simone-lost.mp3");
  const from = p.pos, step = home < from ? -1 : 1, n = Math.max(1, Math.abs(from - home)), per = Math.max(260, Math.min(1100, (LOST_MS - 2600) / n));
  toast("😡 Il Rockettaro ti insegue fino a casa!");
  for (let k = from + step; step < 0 ? k >= home : k <= home; k += step) {
    if (g0 !== gen) return;
    const target = p.obj.position.clone(), sFrom = sim.position.clone();
    if (!Q.fast) camFocus(p.obj.position, 22, 0.42);
    await Promise.all([hop(p, k, per * 0.85, 2.2, true), tween(per * 0.85, (t) => { sim.position.lerpVectors(sFrom, target, t); sim.position.y = LAND_H + Math.abs(Math.sin(t * 20)) * 0.35; swingLegs(sim.userData.legs, t * 2, 0.8); faceTo(sim, sim.position, p.obj.position); })]);
    Sfx.step();
  }
  const rest = LOST_MS - (performance.now() - t0); if (rest > 0 && !Q.fast) {   // aspetta sotto casa finché non finisce la musica
    const sp = sim.position.clone(); await tween(rest, (t) => { sim.position.x = sp.x + Math.sin(t * 40) * 0.2; sim.userData.arms[0].rotation.x = -1.2 + Math.sin(t * 30) * 0.5; });
  }
  if (g0 !== gen) return;
  // il tuono del dio: fulmine dal cielo, lampo bianco, il Rockettaro sparisce
  if (!Q.fast) {
    const bolt = new T.Mesh(new T.CylinderGeometry(0.35, 0.9, 60, 5), fxBasic(0xfff9c4, 0.95)); bolt.position.copy(sim.position).add(V3(0, 30, 0)); scene.add(bolt);
    const fl = document.createElement("div"); fl.className = "thunderFlash"; document.body.appendChild(fl);
    Sfx.noise(1.6, "lowpass", 900, 60, 0.7); Sfx.rumble(); cam.shake = 1.4; toast("⚡ IL TUONO DEL DIO!");
    for (let i = 0; i < 14; i++) fxSpawn(ico(0.45, 0xfff59d, 0.9), sim.position.clone().add(V3(0, 2, 0)), V3(rj(10), 4 + Math.random() * 6, rj(10)), 1, { grav: -10 });
    await gsleep(250); scene.remove(sim); await gsleep(450); scene.remove(bolt); cam.shake = 0; fl.remove();
  } else scene.remove(sim);
  song.stop(); Music.hold(false);
}

/* ---------- Nuxis: il principe ragno con la faccia umana ---------- */
let faceTex = null;
function makePrincipe() {
  const g = new T.Group(), BODY = 0x2a2026, LEG = 0x1c1418;
  const abd = new T.Mesh(new T.SphereGeometry(2.2, 10, 8), LM({ color: BODY })); abd.scale.set(1, 0.8, 1.25); abd.position.set(0, 2.6, -2.4); g.add(abd);
  for (let i = 0; i < 4; i++) { const st = box(0.25, 0.08, 1.6, 0, 3.7 + 0.1, -2.4 + (i - 1.5) * 0.9, 0xb02020, g); st.rotation.x = 0.2; }   // strisce rosse sull'addome
  const ceph = new T.Mesh(new T.SphereGeometry(1.4, 10, 8), LM({ color: BODY })); ceph.position.set(0, 2.4, 0.2); g.add(ceph);
  faceTex ||= new T.TextureLoader().load("images/principe_nuxis.png");
  const face = new T.Mesh(new T.PlaneGeometry(2.4, 1.95), new T.MeshBasicMaterial({ map: faceTex })); face.position.set(0, 2.7, 1.45); g.add(face);   // la faccia umana
  const legs = [];
  for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
    const lg = new T.Group(); lg.position.set(s * 1.1, 2.4, 0.6 - i * 0.55); lg.rotation.y = s * (0.5 - i * 0.33); g.add(lg);
    const up = box(0.22, 0.22, 2.6, s * 1.2, 0.7, 0, LEG, lg); up.rotation.set(0, Math.PI / 2, s * -0.5);
    const lo = box(0.18, 2.6, 0.18, s * 2.5, -0.6, 0, LEG, lg); lo.rotation.z = s * 0.25;
    legs.push(lg);
  }
  const crown = new T.Group(); box(1.2, 0.3, 1.2, 0, 0, 0, 0xffd23f, crown); [-0.45, 0, 0.45].forEach((x) => box(0.2, 0.4, 0.2, x, 0.3, 0.45, 0xffd23f, crown)); crown.position.set(0, 3.9, 0.4); g.add(crown);   // è un principe
  g.userData.legs = legs; return g;
}
function makeWebNest() {   // la tana: una grande ragnatela tra due pali
  const g = new T.Group(); [-4, 4].forEach((x) => box(0.4, 9, 0.4, x, 4.5, 0, 0x4a3a2a, g));
  const m = fxBasic(0xf2f2f2, 0.75);
  for (let r = 1; r <= 4; r++) { const ring = new T.Mesh(new T.TorusGeometry(r * 0.95, 0.04, 3, 10), m); ring.position.set(0, 5, 0); g.add(ring); }
  for (let k = 0; k < 10; k++) { const s = new T.Mesh(new T.BoxGeometry(0.05, 8, 0.05), m); s.position.set(0, 5, 0); s.rotation.z = (k / 10) * Math.PI; g.add(s); }
  return g;
}
async function nuxisIntro(p) {
  const spot = p.obj.position.clone(), d = roadDir(p.pos), pr = makePrincipe(); pr.scale.setScalar(0.55);
  const start = NUXIS_HOME ? NUXIS_HOME.clone() : V3(spot.x - d.sx * 20, LAND_H, spot.z - d.sz * 20), near = V3(spot.x - d.sx * 5, LAND_H, spot.z - d.sz * 5);
  Music.hold(true); const song = Sfx.play("sfx/nuxis.mp3"); toast("🕷️ Arriva il principe di Nuxis…"); log(`🕷️ ${p.name} incontra il principe di Nuxis.`);
  if (!Q.fast) { pr.position.copy(start); scene.add(pr); pr.rotation.y = yawTo(start, spot); camFocus(mid2(spot, near).add(V3(0, 2, 0)), 14, 0.3, d.yaw - 0.9); }
  const face = V3(0, 0, 0), fyaw = () => Math.atan2(spot.x - pr.position.x, spot.z - pr.position.z);   // telecamera incollata alla faccia del principe mentre arriva
  await tween(2200, (t) => { pr.position.lerpVectors(start, near, t); pr.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.2; pr.userData.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 40 + i) * 0.35)); if (!Q.fast) { const y = fyaw(); face.copy(pr.position).add(V3(Math.sin(y) * 0.8, 1.5, Math.cos(y) * 0.8)); camFocus(face, 5.5, 0.1, y); } });
  pr.rotation.y = yawTo(near, spot); if (!Q.fast) { const y = fyaw(); face.copy(pr.position).add(V3(Math.sin(y) * 0.8, 1.5, Math.cos(y) * 0.8)); camFocus(face, 5, 0.1, y); await gsleep(1800); camFocus(mid2(spot, near).add(V3(0, 2, 0)), 14, 0.3, d.yaw - 0.9); } toast("🕷️ «Benvenuto a Nuxis. Il principe offre i suoi servizi da ragno.»");
  return { done: () => { scene.remove(pr); song.stop(); Music.hold(false); camBack(); }, pr };
}
async function webAll(p, pr) {   // il principe va su ogni avversario e lo lega nella ragnatela
  const targets = players.filter((q) => q !== p && !q.finished && q.pos <= FINISH);
  for (const q of targets) {
    if (!Q.fast && pr) {
      const a = pr.position.clone(), b = q.obj.position.clone().setY(LAND_H), cf = a.clone(); camFocus(cf, 18, 0.4);
      await tween(Math.max(900, Math.min(3000, a.distanceTo(b) * 12)), (t) => { pr.position.lerpVectors(a, b, t); pr.position.y = LAND_H + Math.sin(t * Math.PI) * 6; cf.copy(pr.position); pr.userData.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 50 + i) * 0.4)); });
      const web = new T.Mesh(new T.IcosahedronGeometry(1.7, 1), new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.85 })); web.position.copy(q.obj.position).add(V3(0, 1.2, 0)); scene.add(web);
      Sfx.whoosh(); await tween(700, (t) => { web.rotation.y = t * 6; web.scale.setScalar(0.3 + t * 0.7); });
      q.obj.userData.web = web;
    }
    q.skip = Math.max(q.skip, 2); log(`🕸️ ${q.name} è legato nella ragnatela: congelato per 2 turni.`); toast(`🕸️ ${q.name} congelato per 2 turni!`);
  }
}

/* ---------- Giba: il gregge di pecore attraversa la strada ---------- */
function makeSheep() {
  const g = new T.Group(), wool = LM({ color: 0xf2f0e6 }), dark = LM({ color: 0x222222 });
  const b = new T.Mesh(new T.BoxGeometry(1.6, 1.1, 2.2), wool); b.position.y = 1.3; g.add(b);
  const tuft = new T.Mesh(new T.BoxGeometry(1.2, 0.5, 1.6), wool); tuft.position.y = 2; g.add(tuft);
  const h = new T.Mesh(new T.BoxGeometry(0.7, 0.75, 0.8), dark); h.position.set(0, 1.7, 1.35); g.add(h);
  [-0.4, 0.4].forEach((x) => { const e = new T.Mesh(new T.BoxGeometry(0.4, 0.15, 0.2), dark); e.position.set(x * 1.3, 1.95, 1.25); g.add(e); });
  const legs = []; [[-0.5, 0.7], [0.5, 0.7], [-0.5, -0.7], [0.5, -0.7]].forEach(([x, z]) => { const l = new T.Group(); l.position.set(x, 0.8, z); const m = new T.Mesh(new T.BoxGeometry(0.25, 0.8, 0.25), dark); m.position.y = -0.4; l.add(m); g.add(l); legs.push(l); });
  g.userData.legs = legs; return g;
}
const makePastore = () => makeHuman({ skin: 0xc98f6a, shoe: 0x3a2a1a, pants: 0x4a3a2a, top: 0x6b5a3a, mouth: 0x6a3b2b,
  hair: (head) => { box(1.5, 0.15, 1.5, 0, 0.7, 0, 0x3a2a1a, head); box(1, 0.4, 1, 0, 0.9, 0, 0x3a2a1a, head); } });
async function eventPecore(p) {
  const g0 = gen, pi = players.indexOf(p), spot = p.obj.position.clone(), d = roadDir(p.pos), V = V3;
  log(`🐑 Un gregge di pecore blocca la strada a ${p.name}, a Giba.`); toast("🐑 Un gregge di pecore attraversa la strada!");
  const flock = [], N = 7;
  for (let i = 0; i < N; i++) { const s = makeSheep(); s.scale.setScalar(0.75); const off = (i - N / 2) * 2.2; s.userData.a = V(spot.x + d.sx * (18 + i * 2.5) + d.fx * off * 0.6, LAND_H, spot.z + d.sz * (18 + i * 2.5) + d.fz * off * 0.6); s.userData.b = V(spot.x - d.sx * (6 + i * 2.5) + d.fx * off * 0.6, LAND_H, spot.z - d.sz * (6 + i * 2.5) + d.fz * off * 0.6); flock.push(s); }
  const past = makePastore(); past.scale.setScalar(0.72); const pa = V(spot.x + d.sx * 34, LAND_H, spot.z + d.sz * 34), pb = V(spot.x + d.sx * 7 + d.fx * 3, LAND_H, spot.z + d.sz * 7 + d.fz * 3);
  if (!Q.fast) { flock.forEach((s) => { s.position.copy(s.userData.a); faceTo(s, s.userData.a, s.userData.b); scene.add(s); }); past.position.copy(pa); faceTo(past, pa, pb); scene.add(past); camFocus(spot.clone(), 20, 0.42, d.yaw + 0.9); }
  let bleat = 0;
  await tween(2600, (t) => { flock.forEach((s, i) => { const k = Math.min(1, t * 0.6); s.position.lerpVectors(s.userData.a, s.userData.b, k * 0.55); s.position.y = LAND_H + Math.abs(Math.sin(t * 30 + i)) * 0.25; s.userData.legs.forEach((l, j) => (l.rotation.x = Math.sin(t * 40 + j * 1.6) * 0.5)); }); past.position.lerpVectors(pa, pb, t); swingLegs(past.userData.legs, t, 0.5); if (t > bleat) { bleat += 0.3; Sfx.tick(); } });
  if (g0 !== gen) return;
  swingLegs(past.userData.legs, 0, 0); faceTo(past, pb, spot);
  let pay = false;
  if (p.money < 1) { await syncModal(p, `<h2>🐑 Gregge di pecore</h2><p class="help">Il pastore vuole <b>1€</b> per far spostare le pecore, ma <b>${esc(p.name)}</b> non ce l'ha.<br>Aspetti che passino: <b>salti il prossimo turno</b>.</p>`, "Beeeh…", 3200); }
  else if (p.cpu) { await gsleep(Q.fast ? 0 : 1500); pay = true; }
  else {
    const w = ask(pi, "choice", { k: "choice", v: "n" }); let a;
    if (mine(p)) a = await ownerPrompt(w, "choice", `<h2>🐑 Gregge di pecore</h2><p class="help">Un gregge ti blocca la strada a Giba.<br>Il pastore: «Dammi <b>1€</b> e le sposto subito.»<br>Altrimenti aspetti che passino e <b>salti il prossimo turno</b>.</p><div class="pick"><button class="primary" data-v="y">💶 Pago 1€</button><button data-v="n">⏳ Aspetto</button></div>`, "", 30000, (v) => (v === "y" ? "y" : "n"));
    else { toast(`🐑 ${p.name} sta trattando col pastore…`); a = await w; }
    pay = a.v === "y";
  }
  if (g0 !== gen) return;
  if (pay) { p.money -= 1; Sfx.coin(); log(`💶 ${p.name} paga 1€ al pastore e passa.`); toast("💶 Il pastore sposta le pecore: passi!"); }
  else { p.skip = Math.max(p.skip, 1); log(`⏳ ${p.name} aspetta che passino le pecore: salta il prossimo turno.`); toast("⏳ Aspetti le pecore: salti il prossimo turno."); }
  redraw();
  await tween(pay ? 1200 : 2400, (t) => { flock.forEach((s, i) => { const k = 0.55 + 0.45 * t; s.position.lerpVectors(s.userData.a, s.userData.b, k); s.position.y = LAND_H + Math.abs(Math.sin(t * 30 + i)) * 0.25; s.userData.legs.forEach((l, j) => (l.rotation.x = Math.sin(t * 40 + j * 1.6) * 0.5)); }); });
  flock.forEach((s) => scene.remove(s)); scene.remove(past); camBack(); redraw();
}

/* ---------- temporale: tutti tornano indietro di 1 casella ---------- */
async function temporale() {
  log("⛈️ TEMPORALE! Tutti tornano indietro di 1 casella."); toast("⛈️ TEMPORALE! Tutti indietro di 1!");
  if (!Q.fast) { document.body.classList.add("storm"); Sfx.rumble(); const fl = document.createElement("div"); fl.className = "thunderFlash"; document.body.appendChild(fl); setTimeout(() => fl.remove(), 800); }
  await gsleep(Q.fast ? 0 : 1200);
  const who = players.filter((q) => !q.finished && !q.carl && q.pos > 1 && q.pos <= FINISH);
  await Promise.all(who.map((q) => { const to = inExile(q) ? Math.min(FINISH, q.pos + 1) : Math.max(1, q.pos - 1); return hop(q, to, 700, 2, true).then(() => { q.zone = SQ[q.pos].zone; }); }));
  await gsleep(Q.fast ? 0 : 900); document.body.classList.remove("storm"); redraw();
}

/* ---------- Calasetta: il pescatore e il minigioco della pesca ---------- */
async function eventPesca(p) {
  const g0 = gen, pi = players.indexOf(p), big = rnd(10) === 0, zone = 15 + rnd(55), cpuHit = sr() < 0.55;
  log(`🎣 Il pescatore di Calasetta presta la canna a ${p.name}.`); toast("🎣 Il pescatore di Calasetta ti presta la canna!");
  const el = Q.fast ? null : shellUI(true);
  let raf = 0, pos = 0;
  if (el) {
    el.innerHTML = `<h2>🎣 Il pescatore di Calasetta</h2><p class="sh-msg">${mine(p) && !p.cpu ? "Premi <b>Tira su!</b> quando l'amo è sul pesce 🐟" : `${esc(p.name)} sta pescando…`}</p><div class="fish-sea"><div class="fish-zone" style="left:${zone}%"><span>🐟</span></div><div class="fish-hook">🪝</div></div>${mine(p) && !p.cpu ? `<div class="pick"><button class="primary" id="fishBtn">🎣 Tira su!</button></div>` : ""}`;
    const hook = el.querySelector(".fish-hook"), t0 = performance.now();
    const loop = (now) => { const t = (now - t0) / 1000, sp = 0.45 + t * 0.06; pos = Math.abs(((t * sp) % 2) - 1) * 94; hook.style.left = pos + "%"; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
  let hit;
  if (p.cpu) { await gsleep(Q.fast ? 0 : 2600); hit = cpuHit; }
  else {
    const w = ask(pi, "choice", { k: "choice", v: "n" });
    if (el && mine(p)) {
      let done = false; const go = (v) => { if (done) return; done = true; submit("choice", v); };
      el.querySelector("#fishBtn").onclick = () => go(pos + 3 >= zone && pos + 3 <= zone + 18 ? "y" : "n");
      setTimeout(() => { if (!done && g0 === gen) go("n"); }, 15000);
    }
    hit = (await w).v === "y";
  }
  cancelAnimationFrame(raf); if (g0 !== gen) return shellUI(false);
  if (el) { el.querySelector(".sh-msg").innerHTML = hit ? (big ? "🐟🐟 <b>UN TONNO!</b> Che colpo!" : "🐟 <b>Preso!</b> Lo vendi al porto.") : "💨 <b>Scappato…</b> il pesce ti ha fregato."; const b = el.querySelector(".pick"); if (b) b.remove(); (hit ? Sfx.win : Sfx.horn)(); await gsleep(2200); }
  shellUI(false);
  if (hit && big && giveAction(p, azById("tonno"))) { log(`🐟 ${p.name} pesca un tonno: carta Tonno!`); toast("🐟 Hai pescato un tonno: carta Tonno!"); }
  else if (hit) { const got = addMoney(p, 4); Sfx.coin(); log(`🐟 ${p.name} pesca un pesce e lo vende: +${got}€.`); toast(`🐟 Pesce venduto: +${got}€`); }
  else { log(`💨 A ${p.name} scappa il pesce.`); toast("💨 Il pesce è scappato."); }
  redraw(); await gsleep(Q.fast ? 0 : 600);
}

/* ---------- Cussorgia: Mattia ti vuole far giocare a Roblox ---------- */
const makeMattia = () => { const m = makeHuman({ skin: 0xf0c8a0, shoe: 0xffffff, shorts: 0x2a4a8a, top: 0xe23b3b, mouth: 0x8a3b3b,
  hair: (head) => { box(1.25, 0.45, 1.2, 0, 0.55, 0, 0x6b4a2a, head); box(1.5, 0.2, 0.3, 0, 0.1, 0, 0x111111, head); } });   // cuffie da gamer
  const ph = new T.Group(); box(0.5, 0.9, 0.1, 0, 0, 0, 0x111111, ph); const scr = new T.Mesh(new T.PlaneGeometry(0.42, 0.78), new T.MeshBasicMaterial({ color: 0x4fc3ff })); scr.position.z = 0.06; ph.add(scr);
  ph.position.set(0, -1.7, 0.45); ph.rotation.x = 1.2; m.userData.arms[1].add(ph); m.userData.phone = ph; return m; };   // il telefono in mano
async function eventMattia(p) {   // Mattia ti ferma: dado da 8, con più di 4 (50%) gli dici di no. Restituisce true se te ne liberi.
  const g0 = gen, spot = p.obj.position.clone(), d = roadDir(p.pos), V = V3;
  log(`🎮 Mattia ferma ${p.name}: «Gioca con me a Roblox!»`); toast("🎮 Mattia ti ferma: «Gioca con me a Roblox!»");
  const kid = MATTIA || makeMattia(), home = MATTIA ? MATTIA.userData.home.clone() : V(spot.x + d.sx * 4.5, LAND_H, spot.z + d.sz * 4.5), dest = V(spot.x + d.sx * 2.6 + d.fx * 1, LAND_H, spot.z + d.sz * 2.6 + d.fz * 1);
  if (!MATTIA) { kid.scale.setScalar(0.5); kid.position.copy(home); if (!Q.fast) scene.add(kid); }
  if (!Q.fast) camFocus(spot.clone(), 13, 0.34, d.yaw + 0.9);
  faceTo(kid, home, dest); await tween(700, (t) => { kid.position.lerpVectors(home, dest, t); kid.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.4; swingLegs(kid.userData.legs, t, 0.8); });
  if (g0 !== gen) return false; swingLegs(kid.userData.legs, 0, 0); faceTo(kid, dest, spot); kid.userData.arms[1].rotation.x = -1.8;   // ti mette il telefono in faccia
  await syncModal(p, `<h2>🎮 Mattia</h2><p class="help">Un bambino col telefono in mano ti blocca: «Ehi! <b>Gioca con me a Roblox!</b>»<br><b>${esc(p.name)}</b> tira il dado da 8: con <b>più di 4</b> gli dice di no e prosegue, altrimenti è costretto a giocare e <b>salta un turno</b>.</p>`, "Tira il dado", 3500);
  if (g0 !== gen) return false;
  const r = 1 + rnd(8);
  if (!Q.fast) { const tD = performance.now(); Sfx.tick(); await throwDice(p, [r]); { const left = DICE_MS - (performance.now() - tD); if (left > 0) await gsleep(left); } const m = diceObjs[0].mesh.position; camFocus(V(m.x, m.y - 2.6, m.z), 9, 1.2); await gsleep(1000); camFocus(spot.clone(), 13, 0.34, d.yaw + 0.9); clearDice(); }
  if (g0 !== gen) return false;
  const won = r > 4;
  if (won) { log(`🎲 ${p.name} fa ${r}: «No, kiddo di merda!»`); toast(`🎲 ${r}: «No, kiddo di merda!»`); Sfx.horn(); await tween(900, (t) => { kid.rotation.z = Math.sin(t * 30) * 0.2; }); kid.rotation.z = 0; }
  else { p.skip = Math.max(p.skip, 1); log(`🎲 ${p.name} fa ${r}: costretto a giocare a Roblox con Mattia, salta un turno.`); toast(`🎲 ${r}: giochi a Roblox con Mattia… salti un turno`); Sfx.chime(); await tween(1400, (t) => { kid.position.y = LAND_H + Math.abs(Math.sin(t * 20)) * 0.8; }); }
  redraw();
  faceTo(kid, dest, home); await tween(700, (t) => { kid.position.lerpVectors(dest, home, t); kid.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.4; swingLegs(kid.userData.legs, t, 0.8); });
  swingLegs(kid.userData.legs, 0, 0); kid.position.copy(home); kid.userData.arms[1].rotation.x = -1.1; if (MATTIA) faceTo(kid, home, SQ[PERC.verdi.mattia[0]]); else scene.remove(kid); camBack();
  return won;
}

/* ---------- Giba: lo spaccio del mafioso (stesso shop di Narcao) ---------- */
async function gibaIntro(p) {
  const spot = p.obj.position.clone(), d = roadDir(p.pos), maf = makeMafioso(); maf.scale.setScalar(0.72);
  const start = V3(spot.x + d.sx * 22, LAND_H, spot.z + d.sz * 22), near = V3(spot.x + d.sx * 4, LAND_H, spot.z + d.sz * 4);
  if (!Q.fast) { maf.position.copy(start); scene.add(maf); faceTo(maf, start, spot); camFocus(mid2(spot, near).add(V3(0, 2, 0)), 16, 0.32, d.yaw + 0.9); }
  Music.hold(true); const song = Sfx.play("sfx/narcao.mp3");
  await tween(1800, (t) => { maf.position.lerpVectors(start, near, t); maf.position.y = LAND_H + Math.abs(Math.sin(t * 26)) * 0.3; swingLegs(maf.userData.legs, t, 0.6); });
  faceTo(maf, near, spot); toast("💼 «Psst… anche a Giba si trova di tutto. Roba di Narcao.»"); log(`💊 ${p.name} incontra il mafioso dello spaccio di Giba.`);
  await tween(1400, (t) => { maf.userData.arms[0].rotation.z = 0.3 + Math.sin(t * 10) * 0.4; });
  return () => { scene.remove(maf); song.stop(); Music.hold(false); camBack(); };
}
