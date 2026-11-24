"use strict";
/* ===== Modelli low poly ed effetti delle carte (solo grafica/audio: nessuna logica di gioco) ===== */
const V3 = (x, y, z) => new T.Vector3(x, y, z);
const fxObjs = []; let fxRun = false, fxLast = 0;
const fxBasic = (color, op = 1) => ps1(new T.MeshBasicMaterial({ color, transparent: op < 1, opacity: op, side: T.DoubleSide }));
function fxClear() { fxObjs.forEach((o) => scene.remove(o.m)); fxObjs.length = 0; }
function fxLoop(now) {
  const dt = Math.min(0.05, (now - fxLast) / 1000); fxLast = now;
  for (let i = fxObjs.length - 1; i >= 0; i--) {
    const o = fxObjs[i]; o.age += dt; o.vel.y += o.grav * dt; o.m.position.addScaledVector(o.vel, dt); o.m.rotation.x += o.spin * dt; o.m.rotation.y += o.spin * dt;
    if (o.grow) o.m.scale.setScalar(o.s0 * (1 + o.age * o.grow)); if (o.m.material.transparent) o.m.material.opacity = Math.max(0, o.op * (1 - o.age / o.life));
    if (o.age >= o.life) { scene.remove(o.m); fxObjs.splice(i, 1); }
  }
  if (fxObjs.length) requestAnimationFrame(fxLoop); else fxRun = false;
}
function fxSpawn(mesh, pos, vel, life, o = {}) {   // particella generica
  if (Q.fast) return null; mesh.position.copy(pos); scene.add(mesh);
  const p = { m: mesh, vel: vel.clone(), life, age: 0, grav: o.grav || 0, grow: o.grow || 0, s0: o.s || 1, spin: o.spin || 0, op: o.op ?? 0.8 }; mesh.scale.setScalar(p.s0); fxObjs.push(p);
  if (!fxRun) { fxRun = true; fxLast = performance.now(); requestAnimationFrame(fxLoop); } return p;
}
const ico = (r, color, op) => new T.Mesh(new T.IcosahedronGeometry(r, 0), fxBasic(color, op));
const box = (w, h, d, x, y, z, color, parent, lambert = true) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), lambert ? LM({ color }) : fxBasic(color)); m.position.set(x, y, z); parent.add(m); return m; };
const rj = (a) => (Math.random() - 0.5) * a;
function camFocus(v, dist, pitch, yaw) { if (Q.fast) return; lastInput = performance.now(); cam.focus = v; cam.goalDist = dist; if (pitch !== undefined) cam.pitch = pitch; if (yaw !== undefined) cam.yaw = yaw; }
function camBack() { cam.focus = null; cam.goalDist = FOLLOW_DIST; cam.pitch = FOLLOW_PITCH; lastInput = -1e9; }
const pp = (p) => p.obj.position.clone().add(V3(0, 1.5, 0));
const mid2 = (a, b) => a.clone().add(b).multiplyScalar(0.5);
function swingLegs(legs, t, amp) { legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 38 + (i % 2) * Math.PI) * amp)); }

/* ---------- modelli ---------- */
function makeHuman(o) {   // omino low poly parametrico (Marilena, il Rockettaro, ladro, mafiosi…): più dettagliato ma sempre "PS1"
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const darker = (c, k = 0.72) => { const cc = new T.Color(c); cc.multiplyScalar(k); return cc.getHex(); };
  const pants = o.pants || o.shorts, legs = [];
  [-0.4, 0.4].forEach((x) => {
    const lg = new T.Group(); lg.position.set(x, 2.3, 0); g.add(lg);
    box(0.58, 0.95, 0.62, 0, -0.45, 0, pants, lg);                       // coscia (pantaloncini)
    box(0.5, 1.1, 0.54, 0, -1.4, 0, o.skin, lg);                         // polpaccio
    box(0.52, 0.12, 0.56, 0, -0.95, 0.0, darker(pants), lg);             // orlo
    box(0.7, 0.32, 1.1, 0, -2.0, 0.15, o.shoe, lg); box(0.72, 0.1, 1.14, 0, -2.17, 0.15, 0xe8e8e8, lg);   // scarpa + suola
    legs.push(lg);
  });
  box(1.5, 0.95, 0.95, 0, 2.5, 0, pants, body); box(1.54, 0.16, 0.98, 0, 2.95, 0, 0x2a2018, body); box(0.24, 0.18, 0.06, 0, 2.95, 0.5, 0xc9a227, body);   // pantaloni, cintura, fibbia
  box(1.45, 1.9, 0.9, 0, 3.8, 0, o.top, body); box(1.47, 0.14, 0.92, 0, 2.95 + 0.1, 0, darker(o.top, 0.85), body);                                       // maglia
  box(0.7, 0.16, 0.5, 0, 4.72, 0.22, darker(o.top, 0.8), body);                                                                                            // colletto
  const arms = []; [-1, 1].forEach((sd) => {
    const ar = new T.Group(); ar.position.set(sd * 1.0, 4.3, 0); body.add(ar);
    box(0.46, 0.7, 0.46, 0, -0.3, 0, o.top, ar);                         // manica
    box(0.38, 1.0, 0.38, 0, -1.0, 0, o.skin, ar);                        // avambraccio
    box(0.36, 0.34, 0.3, 0, -1.62, 0.02, darker(o.skin, 0.92), ar);      // mano
    if (o.sleeve) { const sp = new T.Mesh(new T.IcosahedronGeometry(0.46, 0), LM({ color: o.top })); ar.add(sp); }
    arms.push(ar);
  });
  box(0.45, 0.35, 0.45, 0, 4.85, 0, o.skin, body);                       // collo
  const head = new T.Group(); head.position.set(0, 5.6, 0); body.add(head);
  box(1.1, 1.2, 1.05, 0, 0, 0, o.skin, head); box(1.0, 0.25, 0.95, 0, -0.62, 0.02, darker(o.skin, 0.95), head);   // testa e mascella
  [-0.58, 0.58].forEach((x) => box(0.12, 0.32, 0.22, x, 0.02, 0, darker(o.skin, 0.9), head));                    // orecchie
  box(0.18, 0.28, 0.2, 0, -0.08, 0.6, darker(o.skin, 0.9), head);                                                  // naso
  if (o.hair) o.hair(head);
  [-0.27, 0.27].forEach((x) => { box(0.2, 0.15, 0.06, x, 0.12, 0.53, 0xffffff, head); box(0.1, 0.12, 0.1, x, 0.11, 0.55, 0x2a1a12, head); box(0.26, 0.06, 0.08, x, 0.3, 0.54, 0x3a2a1c, head); });   // occhi e sopracciglia
  box(0.4, 0.07, 0.1, 0, -0.32, 0.53, o.mouth || 0xb34a4a, head);
  Object.assign(g.userData, { body, legs, arms, head }); if (o.extra) o.extra(head, body, arms, g);
  return g;
}
function makeAngelica() {
  return makeHuman({ skin: 0xf0c9a8, shoe: 0xf2f2f2, shorts: 0x3b3f8a, top: 0xd6337a, sleeve: true, mouth: 0xd9406a,
    hair: (head) => { box(1.3, 0.45, 1.25, 0, 0.62, -0.02, 0xe3c35a, head); box(1.28, 0.9, 0.3, 0, 0.25, -0.55, 0xe3c35a, head); box(0.75, 0.7, 0.7, 0, 0.75, -0.75, 0xd4b04a, head); [-0.6, 0.6].forEach((x) => box(0.16, 0.6, 0.5, x, 0.25, -0.1, 0xe3c35a, head)); },   // bionda con lo chignon
    extra: (head, body, arms, g) => {
      box(1.5, 2.2, 0.08, 0, 3.0, 0.5, 0xffffff, body); box(0.12, 1.2, 0.06, -0.5, 4.5, 0.48, 0xffffff, body); box(0.12, 1.2, 0.06, 0.5, 4.5, 0.48, 0xffffff, body);   // grembiule bianco
      [-0.62, 0.62].forEach((x) => box(0.1, 0.3, 0.1, x, -0.2, 0.1, 0xd4af37, head));                        // orecchini
      const snot = box(0.09, 0.4, 0.07, 0.1, -0.24, 0.57, 0xd2edf7, head); snot.name = "snot";   // moccio: un filo chiaro sotto il naso
      const mop = new T.Group(); mop.position.set(0.1, -1.3, 0.2); arms[1].add(mop); arms[1].rotation.x = -0.9;
      box(0.14, 6.2, 0.14, 0, 0, 0, 0x8a6a3a, mop); const mh = box(1.6, 0.55, 1.1, 0, -3.2, 0, 0x9aa3ad, mop); mh.name = "mophead"; mop.name = "mop";
      g.userData.mop = mop;
    } });
}
function makeSimone() {   // il Rockettaro: capelli lunghi neri, bandana rossa, occhiali da sole, maglietta nera col teschio, chitarra elettrica rossa
  const skin = 0xc68e66, skinD = 0xb07a55, hairG = 0x0d0d0d, hairD = 0x0d0d0d, hairS = 0x0d0d0d, beard = 0x1a1a1a;
  return makeHuman({ skin, shoe: 0x111111, shorts: 0x2c4a7a, top: 0x151515, mouth: 0x7a3b3b,
    hair: (head) => {
      box(1.2, 0.3, 1.1, 0, 0.66, -0.05, hairG, head); box(1.24, 0.22, 1.14, 0, 0.5, 0, 0xc81e1e, head);                                   // bandana rossa
      [-1, 1].forEach((sd) => box(0.16, 1.9, 0.9, sd * 0.62, -0.45, -0.2, hairG, head));                                                     // capelli lunghi neri
      box(1.2, 2.2, 0.25, 0, -0.5, -0.6, hairG, head);
      box(1.05, 0.22, 0.08, 0, 0.18, 0.6, 0x050505, head);                                                                                   // occhiali da sole
    },
    extra: (head, body, arms, g) => {
      const V = V3;
      const bl = box(0.36, 0.07, 0.07, -0.26, 0.3, 0.545, 0x3f3830, head); bl.rotation.z = 0.05; const br = box(0.36, 0.07, 0.07, 0.26, 0.3, 0.545, 0x3f3830, head); br.rotation.z = -0.05;   // sopracciglia
      [-0.26, 0.26].forEach((x) => box(0.28, 0.06, 0.05, x, 0.2, 0.55, skinD, head));                                                          // palpebre
      box(0.2, 0.5, 0.2, 0, -0.02, 0.6, skin, head); box(0.32, 0.18, 0.24, 0, -0.22, 0.64, skinD, head); [-0.08, 0.08].forEach((x) => box(0.06, 0.04, 0.05, x, -0.31, 0.72, 0x7a4a3a, head));    // naso
      [-1, 1].forEach((sd) => { box(0.12, 0.38, 0.22, sd * 0.62, 0.0, 0.0, skinD, head); box(0.1, 0.4, 0.5, sd * 0.57, -0.1, 0.08, beard, head); });                                          // orecchie e basette corte
      box(0.4, 0.3, 0.1, 0, -0.55, 0.56, beard, head); box(0.12, 0.12, 0.1, 0, -0.52, 0.5, beard, head);   // pizzetto box(0.5, 0.1, 0.1, 0, -0.29, 0.57, beard, head); box(0.28, 0.06, 0.06, 0, -0.39, 0.62, 0x9a5f50, head);   // barba corta, baffi, labbra
      [[0.3, -0.3, 0.58]].forEach(([x, y, z]) => box(0.06, 0.06, 0.04, x, y, z, 0xd4af37, head));   // piercing                              // un paio di peli grigi
      box(0.9, 0.9, 0.05, 0, 3.9, 0.48, 0xffffff, body); box(0.5, 0.5, 0.06, 0, 3.9, 0.5, 0xc81e1e, body);   // teschio stampato sulla maglietta // colletto e bottoni
      const G = V(0.1, 3.3, 0.62), gt = new T.Group(); gt.position.copy(G); body.add(gt); gt.rotation.z = 0.35;                                                                         // chitarra bianca
      box(2.2, 1.7, 0.35, -0.6, 0, 0, 0xd01818, gt); box(0.5, 0.3, 0.37, -0.9, 0.2, 0.02, 0x111111, gt); box(3.6, 0.28, 0.25, 2.3, 0.15, 0, 0x111111, gt); box(0.7, 0.4, 0.22, 4.4, 0.15, 0, 0xd01818, gt);
      [0.5, 1.2, 1.9, 2.6, 3.3].forEach((x) => box(0.04, 0.3, 0.27, x, 0.15, 0.0, 0xc9c9c9, gt));
      box(0.12, 4.5, 0.06, 0, 1.6, 0.35, 0x15110f, body).rotation.z = -0.5; g.userData.guitar = gt;
      const skinM = LM({ color: skin }), mk = () => { const m = new T.Mesh(new T.BoxGeometry(0.4, 1, 0.4), skinM); m.visible = false; body.add(m); return m; };
      const limbL = mk(), limbR = mk(), handL = box(0.5, 0.5, 0.45, 0, 0, 0, skin, body), handR = box(0.5, 0.5, 0.45, 0, 0, 0, skin, body), fingers = [0, 1, 2].map(() => box(0.12, 0.12, 0.32, 0, 0, 0, skin, body));
      const all = [limbL, limbR, handL, handR, ...fingers]; all.forEach((m) => (m.visible = false));
      g.userData.pose = (t, on) => {
        arms.forEach((a) => (a.visible = !on)); all.forEach((m) => (m.visible = on)); if (!on) return;
        const c = Math.cos(0.35), s = Math.sin(0.35), toBody = (x, y, z) => V(G.x + x * c - y * s, G.y + x * s + y * c, G.z + z);
        const hl = toBody(2.5 + Math.sin(t * 2.6) * 1.1, 0.1, 0.32), hr = toBody(-0.5, -0.2 + Math.sin(t * 20) * 0.35, 0.3);
        handL.position.copy(hl); handR.position.copy(hr);
        [[limbL, V(1.0, 4.3, 0), hl], [limbR, V(-1.0, 4.3, 0), hr]].forEach(([m, a2, b]) => { const dd = b.clone().sub(a2), L = dd.length(); m.position.copy(a2).addScaledVector(dd, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(V(0, 1, 0), dd.normalize()); });
        fingers.forEach((fg, i) => fg.position.copy(hl).add(V(0.22 + i * 0.2, 0.12 * Math.sin(t * 9 + i * 1.7), 0.28)));
      };
      arms[0].rotation.z = 0.3; arms[1].rotation.x = -1.2;
    } });
}
function makeMamma() {   // la mamma di Giorgia: bionda, divisa McDonald blu, cappellino nero e head set
  return makeHuman({ skin: 0xe8b99a, shoe: 0x141414, shorts: 0x1b2a44, top: 0x1f4fa3, mouth: 0xc0504d,
    hair: (head) => { box(1.2, 0.35, 1.15, 0, 0.5, -0.02, 0xf1d27a, head); box(1.25, 1.2, 0.3, 0, 0.0, -0.55, 0xf1d27a, head); box(0.5, 1.6, 0.3, 0, -0.9, -0.62, 0xf1d27a, head); box(0.2, 0.7, 0.2, 0.62, 0.2, 0.0, 0xf1d27a, head); box(0.2, 0.7, 0.2, -0.62, 0.2, 0.0, 0xf1d27a, head); },
    extra: (head, body, arms) => {
      box(1.32, 0.3, 1.25, 0, 0.78, 0, 0x121212, head); box(1.0, 0.08, 0.35, 0, 0.7, 0.7, 0x121212, head);          // cappellino nero con visiera
      box(0.1, 0.1, 1.15, 0, 0.98, 0, 0x121212, head); [-0.64, 0.64].forEach((x) => box(0.2, 0.42, 0.34, x, 0.02, 0.02, 0x121212, head)); // head set: archetto e cuffie
      box(1.5, 0.22, 0.96, 0, 4.55, 0, 0xffc72c, body); box(0.5, 0.35, 0.05, 0.3, 4.0, 0.48, 0xffc72c, body);                                       // colletto e targhetta gialli
      arms[0].rotation.z = 0.2; arms[1].rotation.z = -0.2;
    } });
}
function makeMcBuilding() {   // ristorante McDonald's: volume chiaro, fascia rossa, vetrate, porta, pensilina, drive-thru, archi dorati sul tetto e su un pilone
  const g = new T.Group(), RED = 0xd62828, YEL = 0xffc72c, GLASS = 0x27465f;
  box(10, 4.2, 6.4, 0, 2.1, 0, 0xe9e4da, g); box(10.02, 1.0, 6.42, 0, 0.5, 0, 0x6b3a22, g);                          // volume principale + zoccolo marrone
  box(10.4, 0.8, 6.8, 0, 4.4, 0, RED, g); box(10.7, 0.25, 7.1, 0, 4.9, 0, 0x3a3a3a, g);                              // fascia rossa e bordo del tetto
  box(3.4, 2.0, 0.12, -2.9, 2.2, 3.22, GLASS, g); box(3.4, 2.0, 0.12, 2.9, 2.2, 3.22, GLASS, g);                     // vetrate ai lati
  [-4.4, -3.2, -2.0, 2.0, 3.2, 4.4].forEach((x) => box(0.1, 2.0, 0.15, x, 2.2, 3.25, 0xeeeeee, g));                  // montanti
  box(1.9, 2.8, 0.14, 0, 1.4, 3.24, GLASS, g); box(0.1, 2.8, 0.18, 0, 1.4, 3.3, 0xeeeeee, g); box(2.6, 0.3, 1.4, 0, 3.15, 3.85, RED, g);   // porta a vetri e pensilina rossa
  box(5.02, 1.2, 0.5, 5.2, 2.0, 0.5, GLASS, g).scale.set(0.05, 1, 1); box(0.9, 2.0, 0.25, 6.4, 1.4, 1.9, 0x2b2b2b, g); box(0.7, 1.3, 0.06, 6.4, 1.6, 2.05, YEL, g); box(0.5, 0.3, 0.06, 6.4, 1.0, 2.05, RED, g);   // finestrino e tabellone del drive-thru
  const ar = makeArches(); ar.scale.setScalar(2.3); ar.position.set(0, 7.1, 0); g.add(ar); g.userData.arches = ar;                        // archi dorati sul tetto
  box(0.5, 9, 0.5, -6.6, 4.5, 4.0, 0x6a6a6a, g); const ar2 = makeArches(); ar2.scale.setScalar(1.6); ar2.position.set(-6.6, 10.4, 4.0); g.add(ar2); g.userData.arches2 = ar2;   // pilone con i suoi archi
  const lab = labelSprite("McDonald's", 64, "rgba(214,40,40,.95)", "#ffc72c", 1.15); lab.position.set(0, 4.4, 3.6); g.add(lab);              // scritta sulla fascia
  box(10, 0.3, 1.2, 0, 0.15, 4.4, 0x9a9a9a, g); [-3.5, 3.5].forEach((x) => { const sh = new T.Mesh(new T.IcosahedronGeometry(0.9, 0), LM({ color: 0x3f7d3a })); sh.position.set(x, 0.9, 3.9); g.add(sh); });   // marciapiede e siepi
  return g;
}
function makeVecchio() {   // il vecchio di Cussorgia: capelli bianchi, baffi, coppola nera, gilet scuro, bastone
  return makeHuman({ skin: 0xd9a98a, shoe: 0x2a2018, shorts: 0x3b3a36, top: 0x2a2a2a, mouth: 0x9c6a5a,
    hair: (head) => { box(1.2, 0.3, 0.9, 0, 0.55, -0.1, 0xe8e6e0, head); [-1, 1].forEach((sd) => box(0.12, 0.4, 0.7, sd * 0.58, 0.15, -0.1, 0xe8e6e0, head)); },
    extra: (head, body, arms, g) => {
      box(1.4, 0.28, 1.3, 0, 0.82, 0.02, 0x15110f, head); box(1.0, 0.18, 0.85, 0.1, 1.0, -0.05, 0x15110f, head); box(1.1, 0.1, 0.45, 0, 0.7, 0.85, 0x15110f, head);   // coppola sarda
      box(0.7, 0.14, 0.12, 0, -0.22, 0.56, 0xe8e6e0, head); [-0.27, 0.27].forEach((x) => box(0.3, 0.07, 0.07, x, 0.3, 0.55, 0xcfcac2, head));                   // baffi e sopracciglia bianchi
      box(1.5, 1.9, 0.1, 0, 3.8, 0.47, 0xf1efe6, body);                                                                                                       // camicia chiara sotto il gilet
      const cane = new T.Group(); cane.position.set(0.2, -1.4, 0.3); arms[1].add(cane); box(0.12, 3.4, 0.12, 0, -1.4, 0, 0x6b4a2b, cane); box(0.5, 0.14, 0.14, -0.2, 0.3, 0, 0x6b4a2b, cane); g.userData.cane = cane;   // bastone
      arms[1].rotation.x = -0.4;
    } });
}
function makeChef() {   // cuoco giapponese del Ponzu Sushi: divisa bianca, fascia rossa in testa
  return makeHuman({ skin: 0xe2b394, shoe: 0x1a1a1a, shorts: 0x23304a, top: 0xf6f6f6, mouth: 0x9c5b4b,
    hair: (head) => { box(1.2, 0.35, 1.1, 0, 0.55, -0.02, 0x15110f, head); box(1.15, 1.0, 0.25, 0, 0.1, -0.55, 0x15110f, head); },
    extra: (head, body, arms) => { box(1.3, 0.16, 1.2, 0, 0.4, 0, 0xd62828, head); box(0.3, 0.1, 0.5, 0.75, 0.38, -0.5, 0xd62828, head); box(1.5, 0.5, 0.96, 0, 3.2, 0, 0x23304a, body); arms[0].rotation.x = arms[1].rotation.x = -1.1; } });
}
function makePoke() {   // ciotola di poke: riso, cubetti di salmone, avocado, edamame e alga
  const g = new T.Group(); const bowl = new T.Mesh(new T.CylinderGeometry(1.5, 1.0, 1.0, 10), LM({ color: 0xf4f1ea })); bowl.position.y = 0.5; g.add(bowl);
  const rice = new T.Mesh(new T.CylinderGeometry(1.35, 1.35, 0.15, 10), LM({ color: 0xfafaf2 })); rice.position.y = 1.0; g.add(rice);
  [[-0.5, 0.2], [0.1, -0.5], [0.6, 0.3], [-0.1, 0.55]].forEach(([x, z], i) => { const c = box(0.5, 0.35, 0.5, x, 1.25, z, 0xf2784b, g); c.rotation.y = i; });
  [[-0.85, -0.3], [0.9, -0.2]].forEach(([x, z]) => box(0.7, 0.2, 0.35, x, 1.15, z, 0x7aa83a, g)); [[0.3, 0.9], [-0.3, -0.9], [0.0, 0.0]].forEach(([x, z]) => { const s = new T.Mesh(new T.IcosahedronGeometry(0.22, 0), LM({ color: 0x4f9a3a })); s.position.set(x, 1.3, z); g.add(s); });
  box(0.9, 0.05, 0.5, 0.2, 1.4, -0.1, 0x1b2a1f, g); return g;
}
function makePonzu() {   // ristorante giapponese: facciata scura, tetto a falda rosso, tende noren, lanterne e insegna
  const g = new T.Group(), RED = 0xb0262b;
  box(9, 4, 5.6, 0, 2, 0, 0x3a2a22, g); box(9.6, 0.5, 6.2, 0, 4.2, 0, RED, g); box(8.2, 0.5, 5.2, 0, 4.7, 0, RED, g); box(6.6, 0.5, 4.4, 0, 5.2, 0, RED, g);   // tetto a gradoni
  box(7.4, 1.8, 0.12, 0, 2.4, 2.84, 0xe8d8b0, g); [-3.4, -1.7, 0, 1.7, 3.4].forEach((x) => box(0.1, 1.8, 0.14, x, 2.4, 2.88, 0x3a2a22, g));                  // vetrata a pannelli
  [-1.2, -0.4, 0.4, 1.2].forEach((x, i) => box(0.7, 1.9, 0.06, x, 1.2, 2.9, i % 2 ? 0xf4f1ea : 0x1f2f5a, g));                                              // tenda noren all'ingresso
  [-4.4, 4.4].forEach((x) => { const l = new T.Mesh(new T.IcosahedronGeometry(0.55, 0), fxBasic(0xff3b30)); l.position.set(x, 3.2, 3.2); g.add(l); box(0.06, 0.6, 0.06, x, 3.9, 3.2, 0x222222, g); });   // lanterne
  const sign = labelSprite("PONZU SUSHI", 60, "rgba(176,38,43,.95)", "#ffffff", 1.2); sign.position.set(0, 5.6, 3.2); g.add(sign);
  box(0.4, 3.2, 0.4, 6.0, 1.6, 3.6, 0xb0262b, g); box(2.4, 0.4, 0.5, 6.0, 3.3, 3.6, 0xb0262b, g); box(2.8, 0.3, 0.6, 6.0, 3.7, 3.6, 0x222222, g);          // piccolo torii davanti
  return g;
}
function makeThief() { return makeHuman({ skin: 0xd9a98a, shoe: 0x111111, shorts: 0x111111, top: 0x111111, hair: (h) => { box(1.2, 0.5, 1.15, 0, 0.55, 0, 0x111111, h); box(1.15, 0.3, 0.1, 0, 0.1, 0.56, 0x111111, h); } }); }
function makeBoat() {
  const g = new T.Group(); box(7, 1.0, 2.6, 0, 0.5, 0, 0x7a4a2a, g); box(2.4, 0.9, 2.2, 4.1, 0.55, 0, 0x7a4a2a, g).rotation.z = 0; const bow = new T.Mesh(new T.ConeGeometry(1.3, 2.4, 4), LM({ color: 0x7a4a2a })); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.position.set(4.3, 0.55, 0); g.add(bow);
  box(6.4, 0.2, 2.0, 0, 1.05, 0, 0xc9a26b, g); box(0.2, 7, 0.2, 0.5, 4.5, 0, 0x5a3a1c, g);
  const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute([0, 1.4, 0, 0, 7.6, 0, 3.6, 1.4, 0], 3)); sg.computeVertexNormals(); const sail = new T.Mesh(sg, ps1(new T.MeshLambertMaterial({ color: 0xf6f1e4, side: T.DoubleSide }))); sail.position.set(0.6, 0, 0); g.add(sail);
  box(0.9, 0.5, 0.05, 0.5, 8.1, 0, 0xd62828, g); return g;
}
function makeVespa() {
  const g = new T.Group(), c = 0x7fd1c7; box(2.6, 0.9, 0.9, 0, 1.4, 0, c, g); box(0.5, 2.0, 0.9, 1.3, 2.1, 0, c, g); box(0.15, 0.15, 1.8, 1.2, 3.2, 0, 0x222222, g); box(1.2, 0.35, 0.8, -0.5, 2.0, 0, 0x151515, g); box(0.8, 0.3, 0.8, -1.3, 1.9, 0, c, g);
  [1.5, -1.5].forEach((x) => { const w = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.3, 8), LM({ color: 0x151515 })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.55, 0); g.add(w); }); g.scale.setScalar(1.3); return g;
}
function makeTuna() { const g = new T.Group(); const b = new T.Mesh(new T.IcosahedronGeometry(1, 0), LM({ color: 0x5a7aa6 })); b.scale.set(2.2, 1, 0.8); g.add(b); const t = new T.Mesh(new T.ConeGeometry(0.9, 1.4, 4), LM({ color: 0x3c5a85 })); t.rotation.z = Math.PI / 2; t.position.x = -2.4; g.add(t); box(0.3, 0.5, 0.3, 1.2, 0.2, 0.55, 0xffffff, g); return g; }
function makePot() { const g = new T.Group(); const p = new T.Mesh(new T.CylinderGeometry(1.5, 1.2, 1.5, 8), LM({ color: 0x8a8f98 })); g.add(p); const s = new T.Mesh(new T.CylinderGeometry(1.35, 1.35, 0.1, 8), LM({ color: 0xe8742a })); s.position.y = 0.7; g.add(s); box(0.6, 0.2, 0.2, 1.7, 0.3, 0, 0x555a62, g); box(0.6, 0.2, 0.2, -1.7, 0.3, 0, 0x555a62, g); return g; }
function makeRock() { const m = new T.Mesh(new T.DodecahedronGeometry(1.3 + Math.random() * 0.8, 0), LM({ color: 0x8c857b })); return m; }
function makeShield() { const g = new T.Group(); const s = new T.Mesh(new T.IcosahedronGeometry(3.8, 1), fxBasic(0xffd54a, 0.35)); g.add(s); const c = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 1.2, 6), LM({ color: 0xf6f1e4 })); c.position.y = 5.2; g.add(c); const f = new T.Mesh(new T.ConeGeometry(0.22, 0.7, 5), fxBasic(0xffa31a)); f.position.y = 6.1; g.add(f); g.userData.s = s; return g; }
function makeArches() { const g = new T.Group(); [-1.1, 1.1].forEach((x) => { const t = new T.Mesh(new T.TorusGeometry(1.1, 0.35, 5, 10, Math.PI), LM({ color: 0xffc72c })); t.position.x = x; g.add(t); }); return g; }

/* ---------- carte: animazioni ---------- */
async function fxShield(target, text) {   // scudo dorato di Santa Barbara (chi si protegge)
  if (Q.fast) return; const sh = makeShield(); sh.position.copy(target.obj.position).add(V3(0, 2.2, 0)); scene.add(sh); Sfx.chime();
  camFocus(target.obj.position, 14, 0.35);
  await tween(1500, (t) => { sh.scale.setScalar(0.3 + Math.min(1, t * 3) * 0.8 + Math.sin(t * 12) * 0.05); sh.userData.s.material.opacity = 0.35 * (1 - t * 0.5); sh.rotation.y = t * 6; });
  scene.remove(sh);
}
function followCam(cf, getter) {   // la camera segue l'oggetto in movimento aggiornando il punto di mira a ogni frame
  let on = true; (function loop() { if (!on) return; try { cf.copy(getter()); } catch (e) {} requestAnimationFrame(loop); })(); return () => (on = false);
}
async function fxCard(id, c, t, blocked) {   // c = chi gioca, t = bersaglio
  if (Q.fast) return; const g0 = gen; let stopCam = () => {};
  try {
    if (id === "maestrale") {
      Sfx.whoosh(); const a = pp(c), b = pp(t), parts = [], cf = a.clone(); camFocus(cf, 22, 0.45); stopCam = followCam(cf, () => (parts[0] ? parts[0].position : a));
      for (let i = 0; i < 18; i++) parts.push(box(0.25, 0.25, 1.8, 0, 0, 0, 0xe6f2ff, scene, false));
      await tween(1500, (u) => parts.forEach((m, i) => { const f = Math.max(0, Math.min(1, u * 1.2 - i * 0.02)), ang = u * 14 + i, r = 1.6 * (1 - f * 0.3); m.position.copy(a).lerp(b, f).add(V3(Math.cos(ang) * r, Math.sin(ang) * r, Math.sin(ang * 0.7) * r)); m.rotation.set(ang, ang * 0.5, 0); }));
      parts.forEach((m) => scene.remove(m)); stopCam();
      if (blocked) { await fxShield(t); return; }
      const cone = new T.Mesh(new T.ConeGeometry(2.6, 9, 8, 1, true), fxBasic(0xdfe9f2, 0.55)); cone.rotation.x = Math.PI; cone.position.copy(t.obj.position).add(V3(0, 4.5, 0)); scene.add(cone); camFocus(t.obj.position, 16, 0.35); Sfx.whoosh();
      const y0 = t.obj.position.y; t.animating = true;
      await tween(1500, (u) => { cone.rotation.y = u * 30; t.obj.position.y = y0 + Math.sin(u * Math.PI) * 4; t.obj.rotation.y += 0.5; });
      t.animating = false; scene.remove(cone); placePawns(); Sfx.hit();
    } else if (id === "tonno") {
      const a = pp(c), b = pp(t), fish = makeTuna(), cf = a.clone(); fish.scale.setScalar(2.2); scene.add(fish); camFocus(cf, 15, 0.32); stopCam = followCam(cf, () => fish.position); Sfx.whoosh();
      const flyMs = Math.max(2800, Math.min(6500, 2000 + a.distanceTo(b) * 25));   // più è lontano il bersaglio, più dura il volo: si vede tutto
      await tween(flyMs, (u) => { fish.position.copy(a).lerp(b, u).add(V3(0, Math.sin(u * Math.PI) * 6, 0)); fish.rotation.set(u * 14, Math.atan2(-(b.z - a.z), b.x - a.x), 0); });
      if (blocked) { scene.remove(fish); await fxShield(t); return; }
      stopCam(); Sfx.slap(); camFocus(t.obj.position, 13, 0.35);
      for (let i = 0; i < 14; i++) fxSpawn(ico(0.3, 0xa9c4e6, 0.9), b, V3(rj(10), 3 + Math.random() * 5, rj(10)), 0.9, { grav: -14, op: 0.9 });
      await tween(1200, (u) => { const k = Math.sin(u * Math.PI); t.obj.scale.set(0.95 * (1 + k * 0.4), 0.95 * (1 - k * 0.5), 0.95 * (1 + k * 0.4)); fish.position.y += 0.1; }); t.obj.scale.setScalar(0.95); scene.remove(fish);
    } else if (id === "furto") {
      const th = makeThief(); th.scale.setScalar(0.55); th.position.copy(c.obj.position).setY(LAND_H); scene.add(th); const a = c.obj.position.clone(), b = t.obj.position.clone().add(V3(2, 0, 2)), cf = a.clone(); camFocus(cf, 20, 0.45); stopCam = followCam(cf, () => th.position);
      th.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      const runMs = Math.max(2800, Math.min(6500, 1800 + a.distanceTo(b) * 25));
      await tween(runMs, (u) => { th.position.lerpVectors(a, b, u); th.position.y = LAND_H + Math.abs(Math.sin(u * 50)) * 0.4; swingLegs(th.userData.legs, u * 2, 0.8); });
      if (blocked) { Sfx.chime(); await tween(600, (u) => { th.position.add(V3(rj(0.1) - 0.3, u * 0.5, 0)); th.rotation.z = u * 1.4; }); scene.remove(th); await fxShield(t); return; }
      Sfx.coinRain(); const coins = []; for (let i = 0; i < 6; i++) { const cn = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.12, 8), LM({ color: 0xffd54a })); cn.rotation.x = Math.PI / 2; scene.add(cn); coins.push(cn); }
      await tween(2000, (u) => coins.forEach((cn, i) => { const f = Math.max(0, Math.min(1, u * 1.3 - i * 0.05)); cn.position.copy(t.obj.position).add(V3(0, 2, 0)).lerp(th.position.clone().add(V3(0, 3, 0)), f).add(V3(0, Math.sin(f * Math.PI) * 3, 0)); cn.rotation.y = u * 20; }));
      th.rotation.y += Math.PI;
      await tween(runMs * 0.9, (u) => { th.position.lerpVectors(b, a, u); th.position.y = LAND_H + Math.abs(Math.sin(u * 50)) * 0.4; swingLegs(th.userData.legs, u * 2, 0.8); coins.forEach((cn, i) => cn.position.copy(th.position).add(V3(0, 3 + i * 0.2, 0))); });
      Sfx.coinRain(); coins.forEach((cn) => scene.remove(cn)); scene.remove(th);
    } else if (id === "frana") {
      Sfx.rumble(); const rocks = [], cf = t.obj.position.clone(); camFocus(cf, 20, 0.5); stopCam = followCam(cf, () => V3(t.obj.position.x, rocks.length ? Math.max(t.obj.position.y, Math.min(...rocks.map((r2) => r2.position.y))) : t.obj.position.y, t.obj.position.z)); for (let i = 0; i < 8; i++) { const r = makeRock(); r.position.copy(t.obj.position).add(V3(rj(5), 20 + i * 3, rj(5))); scene.add(r); rocks.push(r); }
      const y0 = t.obj.position.y;
      await tween(1500, (u) => rocks.forEach((r, i) => { const f = Math.max(0, Math.min(1, u * 1.4 - i * 0.06)); r.position.y = (y0 + 22 + i * 3) * (1 - f) + (blocked ? y0 + 5 + Math.sin(f * 9) * (1 - f) * 2 : y0 + 0.8) * f; r.rotation.x += 0.1; }));
      if (blocked) { rocks.forEach((r) => scene.remove(r)); await fxShield(t); return; }
      for (let i = 0; i < 12; i++) fxSpawn(ico(0.7, 0xb9ad98, 0.7), t.obj.position.clone().add(V3(rj(4), 0.5, rj(4))), V3(rj(5), 1.5, rj(5)), 1.4, { grow: 1.2, op: 0.7 });
      tintPawn(t, 0x8c857b); await tween(700, (u) => (t.obj.scale.y = 0.95 * (1 - 0.5 * Math.sin(Math.min(1, u * 3) * Math.PI / 2)))); await gsleep(500); tintPawn(t, null); t.obj.scale.setScalar(0.95); rocks.forEach((r) => scene.remove(r));
    } else if (id === "cassola") {
      const pot = makePot(); pot.position.copy(c.obj.position).add(V3(0, 14, 0)); scene.add(pot); const cf = c.obj.position.clone(); camFocus(cf, 15, 0.4); stopCam = followCam(cf, () => (pot.position.y > c.obj.position.y + 3 ? pot.position : c.obj.position)); Sfx.sizzle();
      await tween(900, (u) => (pot.position.y = c.obj.position.y + 14 - u * 11));
      Sfx.heal(); tintPawn(c, 0x6fe08a);
      for (let i = 0; i < 16; i++) setTimeout(() => { if (g0 === gen) fxSpawn(box(0.5, 0.5, 0.5, 0, 0, 0, 0xe8445a, scene, false), c.obj.position.clone().add(V3(rj(2), 3, rj(2))), V3(rj(2), 3 + Math.random() * 2, rj(2)), 1.8, { op: 0.9, spin: 3 }); }, i * 90);
      for (let i = 0; i < 12; i++) setTimeout(() => { if (g0 === gen) fxSpawn(ico(0.4, 0xffffff, 0.5), pot.position.clone().add(V3(rj(1), 1, rj(1))), V3(rj(1), 2.5, rj(1)), 1.5, { grow: 1, op: 0.5 }); }, i * 100);
      await gsleep(1600); tintPawn(c, null); await tween(500, (u) => (pot.position.y += 0.4)); scene.remove(pot);
    } else if (id === "vespa") {
      const v = makeVespa(); scene.add(v); const cf = c.obj.position.clone(); camFocus(cf, 22, 0.5); stopCam = followCam(cf, () => v.position); Sfx.engine(2.2); const o = c.obj.position.clone();
      await tween(2200, (u) => { const ang = u * Math.PI * 4; v.position.set(o.x + Math.cos(ang) * 6, LAND_H, o.z + Math.sin(ang) * 6); v.rotation.y = -ang - Math.PI / 2; if (Math.random() < 0.5) fxSpawn(ico(0.35, 0xdddddd, 0.5), v.position.clone().add(V3(0, 1, 0)), V3(rj(1), 1, rj(1)), 0.8, { grow: 1.5, op: 0.5 }); });
      Sfx.horn(); scene.remove(v); const y0 = c.obj.position.y; c.animating = true; await tween(500, (u) => (c.obj.position.y = y0 + Math.sin(u * Math.PI) * 3)); c.animating = false; placePawns();
    }
  } finally { stopCam(); if (g0 === gen) camBack(); }
}
