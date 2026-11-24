"use strict";
/* ===== Eventi di casella/zona: Marilena, McDonald, il Rockettaro, Carloforte (barca, bar genovese, Paolo Vallebona) =====
   Ogni funzione contiene sia l'animazione sia i cambi di stato (che avvengono in modo identico su tutti i client). */

function roadDir(pos) {
  const a = SQ[Math.max(1, pos - 1)], b = SQ[Math.min(FINISH, pos + 1)]; let fx = b.x - a.x, fz = b.z - a.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
  return { fx, fz, sx: -fz, sz: fx, yaw: Math.atan2(-fx, -fz), head: Math.atan2(-fz, fx) };
}
const faceTo = (obj, from, to) => (obj.rotation.y = Math.atan2(to.x - from.x, to.z - from.z));   // gli omini guardano verso +Z

/* ---------- Marilena (True Lands): lava le caselle, arriva da te e ti spinge indietro di 4 caselle ---------- */
const alongPath = (path, f) => { const i = Math.max(0, Math.min(path.length - 2, Math.floor(f))); return path[i].clone().lerp(path[i + 1], Math.max(0, Math.min(1, f - i))); };
async function eventAngelica(p) {
  const g0 = gen; log(`🧹 ${p.name} becca Marilena: deve pulire il pavimento!`); toast("🧹 ARRIVA ANGELICA!");
  Music.hold(true, "angelica"); const audio = Sfx.play("sfx/lavare.mp3"); audio.then(() => { if (Music.owner === "angelica") Music.hold(false); });   // la canzone va fino in fondo, anche dopo che lei se n'è andata
  // tutti quelli nel suo raggio (4 caselle avanti e indietro) vengono spinti indietro di 4 caselle
  const V = V3, pos0 = p.pos, d = roadDir(pos0);
  const victims = players.filter((q) => q === p || (!q.finished && q.pos < CARL0 && Math.abs(q.pos - pos0) <= 4));
  const tos = victims.map((q) => Math.max(1, q.pos - 4)), startSq = Math.min(FINISH, Math.max(pos0 + 4, ...victims.map((q) => q.pos + 2))), endSq = Math.min(...tos);
  if (victims.length > 1) log(`🧹 Marilena spazza via anche: ${victims.filter((q) => q !== p).map((q) => q.name).join(", ")}!`);
  const path = []; for (let n = startSq; n >= endSq; n--) path.push(V(SQ[n].x, LAND_H, SQ[n].z));
  if (path.length < 2) path.push(path[0].clone().addScaledVector(V(-d.fx, 0, -d.fz), 10));
  const info = victims.map((q, k) => ({ q, from: q.pos, i: startSq - q.pos, t: startSq - tos[k] }));    // indice di partenza e di arrivo lungo il percorso
  const iPl = Math.min(...info.map((x) => x.i)), last = path.length - 1;
  const ang = makeAngelica(); ang.scale.setScalar(0.72); const { legs, arms, head } = ang.userData, mop = ang.userData.mop, snot = head.getObjectByName("snot");
  const place = (f, bob) => { const q = alongPath(path, f), q2 = alongPath(path, f + 0.25); ang.position.copy(q); ang.position.y = LAND_H + (bob || 0); ang.rotation.y = Math.atan2(q2.x - q.x, q2.z - q.z); return q; };
  const cf = path[0].clone(); if (!Q.fast) { scene.add(ang); camFocus(cf, 22, 0.45, d.yaw + 0.7); }
  // 1) entra in scena sul tratto di strada davanti a te
  const entry = path[0].clone().addScaledVector(V(d.sx, 0, d.sz), 24); ang.position.copy(entry); ang.rotation.y = Math.atan2(path[0].x - entry.x, path[0].z - entry.z);
  await tween(900, (t) => { ang.position.lerpVectors(entry, path[0], t); ang.position.y = LAND_H + Math.abs(Math.sin(t * 34)) * 0.4; swingLegs(legs, t, 0.7); cf.copy(ang.position); });
  // 2) lava le caselle una dopo l'altra verso di te
  let foam = 0;
  const mopStep = (t, k) => { mop.rotation.z = Math.sin(t * 30 + k) * 0.6; if (snot) snot.scale.y = 1 + Math.sin(t * 22) * 0.5; };
  if (iPl > 0) {
    toast("🧹 Lava le caselle…"); Sfx.sizzle();
    await tween(iPl * 450, (t) => { const q = place(t * iPl, Math.abs(Math.sin(t * iPl * 12)) * 0.15); mopStep(t * iPl, 0); swingLegs(legs, t * iPl, 0.4); cf.copy(q); if (++foam % 5 === 0) fxSpawn(ico(0.45, 0xbfe9ff, 0.6), q.clone().add(V(rj(3), 0.5, rj(3))), V(rj(1), 1.5, rj(1)), 1.5, { grow: 0.8, op: 0.6 }); });
  }
  // 3) arriva da te e ti spinge indietro, casella dopo casella (la pedina scivola, non salta)
  toast("😤 «Devo pulire per terra! Spostati!»"); Sfx.horn();
  info.forEach((x, k) => { x.q.pos = tos[k]; x.q.dir = 1; x.q.animating = true; }); const fp = iPl;
  await tween(Math.max(1, last - iPl) * 550, (t) => {
    const f = fp + t * (last - fp), q = place(f, Math.abs(Math.sin(t * 16)) * 0.12); mopStep(t * 4, 1); swingLegs(legs, t * 4, 0.5); cf.copy(q);
    info.forEach((x) => { const idx = f >= x.i - 0.9 ? Math.min(x.t, f + 0.9) : x.i, pw = alongPath(path, Math.min(last, idx)); x.q.obj.position.set(pw.x, PAWN_Y, pw.z); });
    if (++foam % 4 === 0) fxSpawn(ico(0.5, 0xffffff, 0.7), q.clone().add(V(rj(3), 0.5, rj(3))), V(rj(2), 2, rj(2)), 1.4, { grow: 1, op: 0.7 });
  });
  info.forEach((x) => (x.q.animating = false)); placePawns(); redraw();
  // 4) continua a lavare il pavimento finché non finisce la traccia audio
  const rest = path[last].clone(); let k = 0;
  for (let lap = 0; lap < 5 && g0 === gen; lap++) {   // +3 s rispetto a prima   // lava ancora un attimo (la canzone continua anche dopo)
    await tween(900, (t) => { const s2 = Math.sin(t * Math.PI * 2); mop.rotation.z = s2 * 0.6; ang.position.x = rest.x + d.fx * s2 * 3; ang.position.z = rest.z + d.fz * s2 * 3; swingLegs(legs, t, 0.25); if (snot) snot.scale.y = 1 + Math.sin(t * 20) * 0.5; cf.copy(ang.position); });
    if ((k++ & 1) === 0) { Sfx.sizzle(); for (let i = 0; i < 6; i++) fxSpawn(ico(0.45, 0xbfe9ff, 0.6), rest.clone().add(V(rj(6), 0.5, rj(6))), V(rj(1), 1.5, rj(1)), 1.6, { grow: 0.8, op: 0.6 }); }
    if (Q.fast) break;
  }
  if (g0 !== gen) return;
  // 5) se ne va tornando indietro da dove è venuta: ripercorre la strada fino al punto d'ingresso e poi esce di scena
  ang.position.copy(path[last]); const back = (f) => { const q = alongPath(path, f), q2 = alongPath(path, f - 0.25); ang.position.copy(q); ang.rotation.y = Math.atan2(q2.x - q.x, q2.z - q.z); return q; };
  mop.rotation.z = 0; toast("🧹 Marilena torna da dove è venuta…");
  await tween(Math.max(1, last) * 300 + 300, (t) => { const q = back(last * (1 - t)); ang.position.y = LAND_H + Math.abs(Math.sin(t * last * 8)) * 0.3; swingLegs(legs, t * last, 0.6); cf.copy(q); });
  const from2 = path[0].clone(); faceTo(ang, from2, entry);
  await tween(800, (t) => { ang.position.lerpVectors(from2, entry, t); ang.position.y = LAND_H + Math.abs(Math.sin(t * 34)) * 0.4; swingLegs(legs, t, 0.7); cf.copy(ang.position); });
  scene.remove(ang); camBack();
}

/* ---------- McDonald (Mid Poorlands): la mamma di Giorgia ti spinge dentro il McDonald a lavorare ---------- */
async function eventMcDonald(p) {
  const g0 = gen, MC_MS = 15600, t0 = performance.now();   // durata dell'audio: la scena è costruita per finire insieme alla musica
  log(`🍟 ${p.name}: la mamma di Giorgia l'ha assunto al McDonald! Salta il prossimo turno.`); toast("🍟 Arriva la mamma di Giorgia!");
  p.skip = Math.max(p.skip, 1); Music.hold(true); const audio = Sfx.play("sfx/mcdonalds.mp3");
  const V = V3, spot = p.obj.position.clone(), d = roadDir(p.pos);
  const bpos = V(spot.x + d.sx * 19, LAND_H, spot.z + d.sz * 19), door = bpos.clone().add(V(-d.sx * 4.1, 0, -d.sz * 4.1)), inside = bpos.clone().add(V(-d.sx * 0.5, 0, -d.sz * 0.5));
  const bld = makeMcBuilding(); bld.rotation.y = Math.atan2(-d.sx, -d.sz); const mom = makeMamma(); mom.scale.setScalar(0.72); const { legs, arms, head } = mom.userData;
  const cf = spot.clone(); if (!Q.fast) { bld.position.copy(bpos); bld.scale.set(1, 0.001, 1); scene.add(bld); camFocus(cf, 30, 0.42, d.yaw + 0.8); }
  // 1) il McDonald spunta accanto alla strada e la mamma arriva di corsa
  const start = spot.clone().addScaledVector(V(d.sx, 0, d.sz), 40).addScaledVector(V(d.fx, 0, d.fz), -14), meet = spot.clone().addScaledVector(V(d.sx, 0, d.sz), 3.5);
  mom.position.copy(start); if (!Q.fast) scene.add(mom); faceTo(mom, start, meet); Sfx.horn();
  await tween(3200, (t) => { bld.scale.y = Math.min(1, t * 1.6) || 0.001; bld.userData.arches.rotation.y = t * 6; mom.position.lerpVectors(start, meet, t); mom.position.y = LAND_H + Math.abs(Math.sin(t * 40)) * 0.4; swingLegs(legs, t, 0.7); cf.lerpVectors(spot, bpos, t * 0.5); });
  swingLegs(legs, 0, 0); faceTo(mom, mom.position, spot); toast("😠 «Muoviti! Hai un turno al McDonald!»"); Sfx.whoosh(); await gsleep(1100);
  // 2) lo prende e lo spinge dentro il locale
  p.animating = true; const from = spot.clone(), sc0 = p.obj.scale.x;
  await tween(3600, (t) => {
    const pp2 = from.clone().lerp(door, t); p.obj.position.set(pp2.x, PAWN_Y, pp2.z);
    mom.position.copy(pp2).addScaledVector(V(d.sx, 0, d.sz), 2.6); mom.position.y = LAND_H + Math.abs(Math.sin(t * 22)) * 0.3; faceTo(mom, mom.position, door); arms[0].rotation.x = arms[1].rotation.x = -1.3; swingLegs(legs, t, 0.5); cf.copy(pp2);
    if (Math.random() < 0.2) fxSpawn(ico(0.35, 0xdddddd, 0.5), pp2.clone().add(V(0, 0.5, 0)), V(rj(1), 1, rj(1)), 0.8, { grow: 1, op: 0.5 });
  });
  await tween(1000, (t) => { const pp2 = door.clone().lerp(inside, t); p.obj.position.set(pp2.x, PAWN_Y, pp2.z); p.obj.scale.setScalar(sc0 * (1 - t)); });
  p.obj.visible = false; p.obj.scale.setScalar(sc0); arms[0].rotation.x = arms[1].rotation.x = 0; faceTo(mom, mom.position, bpos);
  // 3) lavora dentro: patatine che volano, archi che girano; si esce poco prima della fine della traccia
  let k = 0;
  while (g0 === gen && performance.now() - t0 < MC_MS - 4200) {
    await tween(900, (t) => { bld.userData.arches.rotation.y += 0.03; bld.userData.arches2.rotation.y += 0.05; bld.position.y = LAND_H + Math.abs(Math.sin(t * Math.PI * 2)) * 0.1; head.rotation.x = Math.sin(t * 16) * 0.1; cf.copy(bpos).setY(LAND_H + 2); });
    if (!Q.fast) for (let i = 0; i < 3; i++) fxSpawn(box(0.25, 1.4, 0.25, 0, 0, 0, 0xffd33f, scene, false), bpos.clone().add(V(rj(3), 4, rj(3))), V(rj(5), 7 + Math.random() * 3, rj(5)), 1.8, { grav: -10, op: 0.95, spin: 3 });
    if ((k++ % 3) === 0) Sfx.coinRain();
    if (Q.fast) break;
  }
  if (g0 !== gen) return;
  // 4) esce con il cappellino rosso, la mamma se ne va e il locale scompare, tutto a tempo con la fine della musica
  const cap = new T.Group(); box(1.3, 0.3, 1.3, 0, 0, 0, 0xd62828, cap); box(0.9, 0.5, 0.9, 0, 0.4, 0, 0xd62828, cap); cap.position.set(0, 3.4, 0); if (!Q.fast) p.obj.add(cap);
  p.obj.visible = true; p.obj.position.set(inside.x, PAWN_Y, inside.z);
  await tween(1300, (t) => { const pp2 = inside.clone().lerp(from, t); p.obj.position.set(pp2.x, PAWN_Y, pp2.z); p.obj.scale.setScalar(sc0 * Math.max(0.05, t)); cf.copy(pp2); });
  p.obj.scale.setScalar(sc0); p.animating = false; placePawns(); const end = mom.position.clone().addScaledVector(V(d.sx, 0, d.sz), 36), mf = mom.position.clone(); faceTo(mom, mf, end);
  await tween(2000, (t) => { mom.position.lerpVectors(mf, end, t); mom.position.y = LAND_H + Math.abs(Math.sin(t * 40)) * 0.4; swingLegs(legs, t, 0.7); bld.scale.y = Math.max(0.001, 1 - t * 1.3); });
  scene.remove(mom); scene.remove(bld); p.obj.remove(cap); camBack(); await audio; Music.hold(false);
}

/* ---------- Il vecchio di Cussorgia (casella di Cussorgia, 36): ti parla di Cussorgia ---------- */
async function eventVecchio(p) {
  const g0 = gen; log(`👴 ${p.name} incontra il vecchio di Cussorgia, che gli parla di Cussorgia.`); toast("👴 Il vecchio di Cussorgia vuole parlarti…");
  Music.hold(true); const audio = Sfx.play("sfx/vecchio-cussorgia.mp3"); let done = false; audio.then(() => (done = true)); const t0 = performance.now();
  const V = V3, spot = p.obj.position.clone(), d = roadDir(p.pos), old = makeVecchio(); old.scale.setScalar(0.72);
  const start = V(spot.x + d.sx * 26 - d.fx * 6, LAND_H, spot.z + d.sz * 26 - d.fz * 6), dest = V(spot.x + d.sx * 4.5 + d.fx * 1.5, LAND_H, spot.z + d.sz * 4.5 + d.fz * 1.5);
  const cf = spot.clone(); if (!Q.fast) { old.position.copy(start); scene.add(old); faceTo(old, start, dest); camFocus(cf, 22, 0.4, d.yaw + 0.8); }
  const { legs, arms, head } = old.userData;
  await tween(3200, (t) => { old.position.lerpVectors(start, dest, t); old.position.y = LAND_H + Math.abs(Math.sin(t * 22)) * 0.2; swingLegs(legs, t * 0.5, 0.45); cf.lerpVectors(spot, dest, t * 0.5); });   // arriva piano piano, col bastone
  swingLegs(legs, 0, 0); faceTo(old, dest, spot);
  const lines = ["Cussorgia… una volta qui si faceva il pane, adesso si fa solo la fila.", "Ai miei tempi da Cussorgia a Sant'Antioco si andava a piedi, sotto il sole!", "Il maestrale qui ti pettina senza chiedere il permesso.", "Mio nonno diceva: chi passa da Cussorgia non ha mai fretta.", "Ti racconto di quando il bar chiuse alle otto… e riaprì alle nove.", "Sei giovane, ascolta: Cussorgia è il centro del mondo. O quasi."];
  for (let i = 0; g0 === gen; i++) {
    toast("👴 " + lines[i % lines.length]);
    await tween(2300, (t) => { head.rotation.x = Math.sin(t * 18) * 0.1; arms[0].rotation.z = 0.2 + Math.sin(t * 7) * 0.4; old.userData.cane.rotation.z = Math.sin(t * 5) * 0.1; cf.copy(dest).setY(LAND_H + 2); });
    if (Q.fast || (done && performance.now() - t0 > 10000)) break;
  }
  if (g0 !== gen) return;
  const end = dest.clone().addScaledVector(V(d.sx, 0, d.sz), 32); faceTo(old, dest, end);
  // prima di andarsene ti regala la sua bici di merda
  { const bici = azById("bici"), ok = giveAction(p, bici); log(ok ? `🚲 Il vecchio regala a ${p.name} la sua bici di merda.` : `🚲 Il vecchio vuole regalare la bici a ${p.name}, ma ha la mano piena.`);
    await syncModal(p, { me: `<h2>🚲 Un regalo dal vecchio</h2><div class="cardshow">${cardHTML(bici, { flip: true })}</div><p style="text-align:center">${ok ? "«Tieni, a me non serve più.» Finisce nella tua mano." : "Mano piena: la bici resta al vecchio."}</p>`, others: `<h2>🚲 Il vecchio regala la sua bici di merda a ${esc(p.name)}</h2>` }, "Grazie nonno", 3000);
    if (g0 !== gen) return; redraw(); }
  await tween(2600, (t) => { old.position.lerpVectors(dest, end, t); old.position.y = LAND_H + Math.abs(Math.sin(t * 22)) * 0.2; swingLegs(legs, t * 0.5, 0.45); cf.copy(old.position); });
  scene.remove(old); camBack(); Music.hold(false);
}

/* ---------- Ponzu Sushi (caselle verdi): un ristorante nuovo ti fa spendere tutti i soldi per una pokè ---------- */
async function eventPonzu(p) {
  const g0 = gen, had = p.money; p.money = 0; Music.hold(true); const song = Sfx.play("sfx/ponzu.mp3"); log(`🍣 ${p.name} entra al Ponzu Sushi e spende tutti i soldi (${had}€) per una pokè.`); toast("🍣 Ponzu Sushi: ristorante nuovo!");
  const V = V3, spot = p.obj.position.clone(), d = roadDir(p.pos), bpos = PONZU_BLD ? PONZU_BLD.position.clone() : V(spot.x + d.sx * 18, LAND_H, spot.z + d.sz * 18), toP = V(spot.x - bpos.x, 0, spot.z - bpos.z).normalize(), door = bpos.clone().add(toP.multiplyScalar(3.6));
  const fixed = !!PONZU_BLD, bld = PONZU_BLD || makePonzu(); if (!fixed) bld.rotation.y = Math.atan2(-d.sx, -d.sz); const chef = makeChef(); chef.scale.setScalar(0.72); const { legs, arms } = chef.userData, poke = makePoke(); poke.scale.setScalar(0.55);
  const cf = spot.clone(); if (!Q.fast) { if (!fixed) { bld.position.copy(bpos); bld.scale.set(1, 0.001, 1); scene.add(bld); } camFocus(cf, 28, 0.42, d.yaw + 0.8); }
  await tween(fixed ? 1200 : 2200, (t) => { if (!fixed) bld.scale.y = Math.max(0.001, Math.min(1, t * 1.5)); cf.lerpVectors(spot, bpos, t * 0.4); });                // il locale spunta
  chef.position.copy(door); if (!Q.fast) { scene.add(chef); chef.add(poke); poke.position.set(0, 3.4, 1.3); } faceTo(chef, door, spot); Sfx.chime();
  const meet = spot.clone().addScaledVector(V(d.sx, 0, d.sz), 3.2);
  await tween(2000, (t) => { chef.position.lerpVectors(door, meet, t); chef.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.35; swingLegs(legs, t, 0.7); cf.lerpVectors(bpos, spot, t); });
  swingLegs(legs, 0, 0); faceTo(chef, meet, spot);
  toast(had ? "🍣 «Una pokè per te! Fanno… tutto quello che hai.»" : "🍣 «Una pokè? Senza soldi? Niente pokè.»");
  if (had > 0) {   // i soldi volano dal giocatore al cuoco
    Sfx.coinRain(); const coins = []; for (let i = 0; i < Math.max(3, had); i++) { const cn = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.12, 8), LM({ color: 0xffd54a })); cn.rotation.x = Math.PI / 2; scene.add(cn); coins.push(cn); }
    await tween(1600, (t) => coins.forEach((cn, i) => { const f = Math.max(0, Math.min(1, t * 1.4 - i * 0.05)); cn.position.copy(spot).add(V(0, 2, 0)).lerp(chef.position.clone().add(V(0, 3, 0)), f).add(V(0, Math.sin(f * Math.PI) * 3, 0)); cn.rotation.y = t * 18; }));
    coins.forEach((cn) => scene.remove(cn));
    // la pokè passa al giocatore, che la mangia
    chef.remove(poke); poke.scale.setScalar(0.7); scene.add(poke); Sfx.chime();
    await tween(2400, (t) => { poke.position.copy(spot).add(V(0, 5.2 - Math.sin(t * Math.PI * 6) * 0.35, 0)); poke.rotation.y = t * 4; p.obj.position.y = PAWN_Y + Math.abs(Math.sin(t * Math.PI * 6)) * 0.8; if (Math.random() < 0.25) fxSpawn(ico(0.25, 0xf2784b, 0.9), poke.position.clone(), V(rj(2), 2, rj(2)), 0.8, { grav: -6 }); });
    scene.remove(poke); placePawns();
  } else { await tween(1400, (t) => { chef.userData.head.rotation.y = Math.sin(t * 14) * 0.5; }); }
  // il cuoco resta a ballare finché non finisce la canzone (+4 s)
  await tween(4000, (t) => { chef.rotation.y += 0.03; chef.position.y = LAND_H + Math.abs(Math.sin(t * Math.PI * 10)) * 0.5; chef.userData.arms[0].rotation.z = 0.5 + Math.sin(t * 40) * 0.6; chef.userData.arms[1].rotation.z = -0.5 - Math.sin(t * 40) * 0.6; }); faceTo(chef, meet, spot);
  // il cuoco rientra e il locale sparisce
  faceTo(chef, meet, door);
  await tween(1500, (t) => { chef.position.lerpVectors(meet, door, t); chef.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.35; swingLegs(legs, t, 0.7); cf.lerpVectors(spot, bpos, t); if (!fixed) bld.scale.y = Math.max(0.001, 1 - Math.max(0, t - 0.5) * 2); });
  scene.remove(chef); if (!fixed) scene.remove(bld); camBack(); song.stop(); Music.hold(false);
  if (g0 !== gen) return; redraw();
  const healed = had > 0 && p.hp < START_HP; if (healed) { p.hp++; Sfx.heal(); log(`🍣 La pokè ridà 1 ❤️ a ${p.name}.`); redraw(); }
  await syncModal(p, had ? `<h2>🍣 Ponzu Sushi</h2><p class="help"><small>Il Ponzu prima era a Sant'Antioco, ma lì si lamentavano tutti: «il pesce crudo non è roba nostra», «troppa roba strana», «chissà cosa ci mettono»… Così si sono trasferiti a Santadi, dove non ci abita quasi nessuno e quindi non disturbano nessuno.</small><br><br>Ristorante nuovo, pokè buonissima…<br><b>Hai speso tutti i tuoi soldi (${had}€)</b> per una pokè${healed ? ",<br>ma almeno ti ridà <b>1 ❤️</b>" : ""}.</p>` : `<h2>🍣 Ponzu Sushi</h2><p class="help"><small>Cacciati da Sant'Antioco perché «il pesce crudo non è roba nostra», ora stanno a Santadi dove non disturbano nessuno.</small><br><br>Ristorante nuovo, ma <b>non hai un euro</b>: niente pokè per te.</p>`, "Che pokè", 3000);
}

/* ---------- Marilena e il Negroni sbagliato (caselle verdi 6–8) ---------- */
async function eventNegroni(p) {
  const g0 = gen, pi = players.indexOf(p), V = V3; log(`🍸 Marilena offre un Negroni sbagliato a ${p.name}.`); toast("🍸 Arriva Marilena con un Negroni sbagliato…");
  const spot = p.obj.position.clone(), d = roadDir(p.pos), ang = makeAngelica(); ang.scale.setScalar(0.72);
  const start = V(spot.x + d.sx * 24, LAND_H, spot.z + d.sz * 24), dest = V(spot.x + d.sx * 5 + d.fx * 2, LAND_H, spot.z + d.sz * 5 + d.fz * 2);
  const glass = new T.Group(); { const c = new T.Mesh(new T.ConeGeometry(0.35, 0.5, 8, 1, true), LM({ color: 0xd0402a, side: T.DoubleSide })); c.rotation.x = Math.PI; c.position.y = 0.45; glass.add(c); const st = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.4, 6), LM({ color: 0xffffff })); st.position.y = 0.05; glass.add(st); const o = new T.Mesh(new T.BoxGeometry(0.25, 0.08, 0.08), LM({ color: 0xff9a1f })); o.position.set(0.25, 0.6, 0); glass.add(o); }
  if (!Q.fast) { ang.position.copy(start); scene.add(ang); faceTo(ang, start, dest); camFocus(spot.clone(), 18, 0.36, d.yaw + 0.9); const hand = ang.userData.arms && ang.userData.arms[1]; if (hand) { glass.position.set(0, -1.4, 0.4); hand.add(glass); } }
  await tween(1500, (t) => { ang.position.lerpVectors(start, dest, t); ang.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.3; if (ang.userData.legs) swingLegs(ang.userData.legs, t, 0.6); });
  if (g0 !== gen) return; if (ang.userData.legs) swingLegs(ang.userData.legs, 0, 0); faceTo(ang, dest, spot); ang.position.y = LAND_H; camFocus(mid2(spot, dest).add(V(0, 1, 0)), 13, 0.3, d.yaw + 0.9);
  if (ang.userData.arms) ang.userData.arms[1].rotation.x = -1.3;
  const PREZZO = 2; let yes = false;
  if (p.money < PREZZO) { await syncModal(p, `<h2>🍸 Marilena</h2><p class="help">«Ti va un <b>Negroni sbagliato</b>? Però te lo paghi tu: <b>2€</b>.»<br><b>${esc(p.name)}</b> non ha nemmeno 2€. Marilena se ne va schifata.</p>`, "Che figura…", 3000); if (g0 !== gen) return; }
  else {
    if (p.cpu) { await gsleep(Q.fast ? 0 : 1800); yes = sr() < 0.5; }
    else {
      const w = ask(pi, "choice", { k: "choice", v: "n" }); let a;
      if (mine(p)) a = await ownerPrompt(w, "choice", `<h2>🍸 Marilena</h2><p class="help">«Ti va un <b>Negroni sbagliato</b>? Però te lo paghi tu.»<br>Costa <b>2€</b>.<br>50%: ti carica, <b>+2</b> al prossimo tiro.<br>50%: sei ubriaco, <b>−2</b> al prossimo tiro.</p><div class="pick"><button class="primary" data-v="y">🍸 Sì, dammelo (2€)</button><button data-v="n">No, grazie</button></div>`, "", 30000, (v) => (v === "y" ? "y" : "n"));
      else { toast(`🍸 ${p.name} sta decidendo se bersi il Negroni…`); a = await w; }
      yes = a.v === "y";
    }
    if (g0 !== gen) return;
    if (yes) { p.money -= PREZZO; p.negroni = 1; Sfx.coin(); log(`🍸 ${p.name} paga 2€ e si beve il Negroni sbagliato: al prossimo tiro +2 o −2.`); toast("🍸 Bevuto! Al prossimo tiro +2 o −2…"); if (!Q.fast && glass.parent) { glass.parent.remove(glass); } redraw(); }
    else { log(`🍸 ${p.name} rifiuta il Negroni di Marilena.`); toast("🙅 Niente Negroni."); }
    await gsleep(Q.fast ? 0 : 1200); if (g0 !== gen) return;
  }
  faceTo(ang, dest, start); await tween(1200, (t) => { ang.position.lerpVectors(dest, start, t); ang.position.y = LAND_H + Math.abs(Math.sin(t * 30)) * 0.3; if (ang.userData.legs) swingLegs(ang.userData.legs, t, 0.6); });
  scene.remove(ang); camBack(); redraw();
}

/* ---------- il Rockettaro (caselle verdi, vedi percorso.json) ---------- */
function noteFx(pos) { if (Q.fast) return; const s = labelSprite(["♪", "♫", "♬"][(Math.random() * 3) | 0], 60, null, "#ffe27a", 2.2); fxSpawn(s, pos.clone().add(V3(rj(4), 4, rj(4))), V3(rj(3), 3 + Math.random() * 2, rj(3)), 2.2, { op: 1 }); }
async function eventSimone(p) {
  const g0 = gen; log(`🎸 ${p.name} incontra il Rockettaro!`); toast("🎸 Hai incontrato il Rockettaro!"); Music.hold(true);
  const spot = p.obj.position.clone(), d = roadDir(p.pos), V = V3, sim = makeSimone(); sim.scale.setScalar(0.72);
  const start = V(spot.x + d.sx * 26, LAND_H, spot.z + d.sz * 26), dest = V(spot.x + d.sx * 5 + d.fx * 2, LAND_H, spot.z + d.sz * 5 + d.fz * 2);
  if (!Q.fast) { sim.position.copy(start); scene.add(sim); faceTo(sim, start, dest); camFocus(spot.clone(), 20, 0.4, d.yaw + 0.9); }
  const { legs, arms, head } = sim.userData, pi = players.indexOf(p);
  // 1) l'audio dell'incontro parte nell'istante in cui compare e il menu è già lì: si ferma quando rispondi
  const enc = Sfx.play("sfx/simone-encounter.mp3");
  const decide = (async () => {
    if (p.cpu) { await gsleep(2500); return sr() < 0.6; }
    const w = ask(pi, "choice", { k: "choice", v: "n" }); let a;
    if (mine(p)) a = await ownerPrompt(w, "choice", `<h2>🎸 Il Rockettaro</h2><p class="help">Ti vuole suonare una canzone rock'n'roll.<br><b>Accetti?</b><br><small>Se gli dici di no… ne pagherai le conseguenze.</small></p><div class="pick"><button class="primary" data-v="y">🤘 Sì, voglio sentirti!</button><button data-v="n">No, grazie</button></div>`, "", 30000, (v) => (v === "y" ? "y" : "n"));
    else { toast(`🎸 ${p.name} sta decidendo se accettare...`); a = await w; }
    return a.v === "y";
  })();
  let decided = false; decide.then(() => (decided = true));
  await tween(1500, (t) => { sim.position.lerpVectors(start, dest, t); sim.position.y = LAND_H + Math.abs(Math.sin(t * 34)) * 0.35; swingLegs(legs, t, 0.7); });
  swingLegs(legs, 0, 0); faceTo(sim, dest, spot); sim.position.y = LAND_H; camFocus(mid2(spot, dest).add(V(0, 1, 0)), 14, 0.3, d.yaw + 0.9);
  while (!decided && g0 === gen) { await tween(500, (t) => { head.rotation.x = Math.sin(t * Math.PI * 4) * 0.12; arms[0].rotation.z = 0.3 + Math.sin(t * Math.PI * 2) * 0.1; }); if (Q.fast) break; }
  const accept = await decide; enc.stop(); if (g0 !== gen) return;
  let ok = false;
  if (accept) {
    // 2) ci vuole coraggio: tutti leggono il testo per 5 secondi, poi tiro del dado da 8: serve più di 4
    await modal(`<h2>😰 Trova il coraggio…</h2><p class="help"><b>${esc(p.name)}</b> deve trovare il coraggio di dirgli di sì.<br>Tira il dado da 8: serve <b>più di 4</b>.</p>`, "", 5000);
    const r = 1 + rnd(8);
    if (!Q.fast) { const tD = performance.now(); Sfx.tick(); await throwDice(p, [r]); { const left = DICE_MS - (performance.now() - tD); if (left > 0) await gsleep(left); } const m = diceObjs[0].mesh.position; camFocus(V(m.x, m.y - 2.6, m.z), 9, 1.2); await gsleep(1000); camFocus(mid2(spot, dest).add(V(0, 1, 0)), 14, 0.3, d.yaw + 0.9); clearDice(); }
    ok = r > 4; log(`🎲 ${p.name} tira ${r} per trovare il coraggio: ${ok ? "ce l'ha fatta!" : "niente da fare."}`);
  }
  if (ok) {
    // 3) la canzone: primo piano sulle mani che si muovono sulla chitarra
    toast("🎶 Il Rockettaro suona per te!"); const song = Sfx.play("sfx/simone-song.mp3"); let sd = false; song.then(() => (sd = true)); const gt = sim.userData.guitar, cf = V(0, 0, 0), gp = V(0, 0, 0);
    const toSpot = new T.Vector3(spot.x - dest.x, 0, spot.z - dest.z).normalize(), yawF = Math.atan2(toSpot.x, toSpot.z);
    if (!Q.fast) { gt.getWorldPosition(cf); camFocus(cf, 10, 0.22, yawF + 0.5); }
    while (!sd && g0 === gen) {
      await tween(450, (t) => {
        sim.userData.pose(performance.now() / 1000, true); head.rotation.x = 0.35 + Math.sin(t * Math.PI * 2) * 0.1; sim.position.y = LAND_H + Math.abs(Math.sin(t * Math.PI * 2)) * 0.15; p.obj.position.y = PAWN_Y + Math.abs(Math.sin(t * Math.PI * 2)) * 1.0;
        gt.getWorldPosition(gp); cf.lerp(gp, 0.2);
      });
      noteFx(sim.position); noteFx(p.obj.position); if (Q.fast) break;
    }
    sim.userData.pose(0, false);
    if (g0 !== gen) return; placePawns(); scene.remove(sim); camBack(); Music.hold(false);
    log(`🤘 ${p.name} ha applaudito il Rockettaro: avanza di 5 caselle!`); toast("🤘 Avanti di 5 caselle!");
    return moveBy(p, 5);
  }
  // 4) rifiuto o niente coraggio: «vai a casa» → casella della casa e un turno saltato
  Sfx.horn(); toast("😡 «Vai a casa!»"); log(`😡 Il Rockettaro manda ${p.name} a casa (casella ${HOME}) e gli fa saltare un turno.`);
  await tween(900, (t) => (sim.position.x += Math.sin(t * 80) * 0.15));
  p.skip = Math.max(p.skip, 1); p.dir = 1; await simoneChase(p, sim, HOME); if (g0 !== gen) return; p.zone = SQ[p.pos].zone; redraw();
  camBack();
  return nextTurn();
}

/* ---------- Carloforte (caselle verdi 29–31): mini mappa di 4 caselle sull'isola di San Pietro ---------- */
async function boatTrip(p, from, to) {
  const g0 = gen, boat = makeBoat(), a = V3(from.x, 1.3, from.z), b = V3(to.x, 1.3, to.z); Sfx.horn();
  if (!Q.fast) { scene.add(boat); boat.position.copy(a); boat.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x); camFocus(a.clone(), 26, 0.42, cam.yaw); }
  const bf = cam.focus; p.animating = true; await tween(600, (t) => { boat.position.y = 1.3 + Math.sin(t * 8) * 0.2; p.obj.position.set(a.x, 1.3 + 1.6 + t * 0, a.z); });
  await tween(3600, (t) => { const e = t * t * (3 - 2 * t); boat.position.set(a.x + (b.x - a.x) * e, 1.3 + Math.sin(t * 14) * 0.35, a.z + (b.z - a.z) * e); boat.rotation.z = Math.sin(t * 12) * 0.08; if (bf) bf.copy(boat.position);   // la camera segue la barca
      p.obj.position.set(boat.position.x - Math.cos(boat.rotation.y) * 0 , boat.position.y + 1.7, boat.position.z); if (Math.random() < 0.4) fxSpawn(ico(0.5, 0xffffff, 0.6), boat.position.clone().add(V3(-3, 0, 0)), V3(rj(1), 0.5, rj(1)), 1.2, { grow: 0.8, op: 0.6 }); });
  Sfx.splat(); await tween(500, (t) => { p.obj.position.set(boat.position.x + (to.x - boat.position.x) * t, boat.position.y + 1.7 + Math.sin(t * Math.PI) * 3 + (LAND_H + 0.9 - boat.position.y - 1.7) * t, boat.position.z + (to.z - boat.position.z) * t); });
  scene.remove(boat); p.animating = false; placePawns(); if (g0 === gen) camBack();
}
async function eventCarloforte(p, entry) {   // arrivi al porto (casella 1 di 3); poi si va avanti e indietro finché non esci sul porto
  log(`⛵ ${p.name} prende la barca per Carloforte!`); toast("⛵ Traghetto per Carloforte!"); p.carl = entry; p.dir = 1; p.cdir = 1;
  p.pos = CARL0; await boatTrip(p, SQ[entry], SQ[CARL0]); redraw(); toast("⚓ Sei arrivato al porto di Carloforte");
}
async function eventBar(p) {   // bar genovese: caffè da 10€
  const had = p.money; p.money = Math.max(0, p.money - 10); Sfx.coin(); log(`☕ ${p.name} paga un caffè 10€ nel bar genovese${had ? ` (perde ${had}€)` : ""}.`); redraw();
  await syncModal(p, `<h2>☕ Bar genovese</h2><p class="help">Sei a Carloforte, in un bar genovese: ti fanno pagare <b>10€ un caffè</b>.<br>${had ? `Ti restano ${p.money}€.` : "Per fortuna non avevi un euro."}</p>`, "Che furto", 3000);
}
async function carloforteMove(p, steps) {   // Carloforte: 4 caselle (porto, porto, Paolo Vallebona, bar genovese): si rimbalza finché non finisci sul porto
  const g0 = gen; let idx = p.pos - CARL0 + 1, d = p.cdir || 1;
  for (let i = 0; i < steps; i++) {
    if (g0 !== gen) return;
    if (d === 1 && idx >= NCARL) d = -1; else if (d === -1 && idx <= 1) d = 1;
    showSteps(steps - i); idx += d; await hop(p, CARL0 + idx - 1);
  }
  showSteps(0); p.cdir = d; if (g0 !== gen) return;
  if (idx === 3) { await eventPaolo(p); return nextTurn(); }
  if (idx === 4) { await eventBar(p); return nextTurn(); }
  // idx 1 o 2: sei sul porto: barca di ritorno a Calasetta, nella casella da cui eri partito
  const entry = p.carl || 30; toast("⛵ Barca di ritorno a Calasetta!"); log(`⛵ ${p.name} torna in barca alla casella ${entry}.`);
  const fromSq = SQ[p.pos]; p.pos = entry; p.carl = null; await boatTrip(p, fromSq, SQ[entry]); redraw(); return nextTurn();
}
async function eventPaolo(p) {
  const g0 = gen; log(`🗣️ ${p.name} incontra Paolo Vallebona e perde un turno.`); p.skip = Math.max(p.skip, 1);
  Music.hold(true); const audio = Sfx.play("sfx/paolovallebona.mp3"); let done = false; audio.then(() => (done = true)); const t0 = performance.now();
  const pao = makeHuman({ skin: 0xe2b394, shoe: 0x6b4a32, shorts: 0x2d6fa6, top: 0xe8742a, mouth: 0x9c5b4b, extra: (head) => { box(1.1, 0.12, 0.1, 0, 0.25, 0.55, 0xe2b394, head); } });   // pelato, camicia hawaiana
  pao.scale.setScalar(0.72); const spot = p.obj.position.clone(), meet = spot.clone().add(V3(3.5, 0, 1.5)).setY(LAND_H), door = PAOLO_DOOR ? PAOLO_DOOR.clone().setY(LAND_H) : meet.clone().add(V3(8, 0, 0));
  pao.position.copy(door); if (!Q.fast) { scene.add(pao); faceTo(pao, door, meet); camFocus(mid2(spot, door), 18, 0.38, cam.yaw); }
  toast("🚪 Paolo Vallebona esce di casa…"); await tween(1800, (t) => { pao.position.lerpVectors(door, meet, t); pao.position.y = LAND_H + Math.abs(Math.sin(t * 24)) * 0.25; swingLegs(pao.userData.legs, t, 0.6); });
  faceTo(pao, meet, spot); if (!Q.fast) camFocus(spot.clone(), 14, 0.35, cam.yaw);
  const bubbles = ["Genova fa cagare per il lavoro…", "Qui sono in vacanza, ma a Genova…", "…e non ti dico gli affitti!", "Il focaccino costa più dello stipendio…", "Io me ne sono scappato a Carloforte!", "Mi ascolti? Ti racconto anche di quella volta…"];
  // il dialogo dura finché non finisce la traccia audio (minimo ~9 secondi se manca il file)
  for (let i = 0; g0 === gen; i++) {
    toast("🗣️ " + bubbles[i % bubbles.length]);
    await tween(1800, (t) => { pao.userData.head.rotation.x = Math.sin(t * 24) * 0.12; pao.userData.arms[1].rotation.z = Math.sin(t * 12) * 0.5; pao.userData.arms[0].rotation.z = -Math.sin(t * 9) * 0.3; });
    if (Q.fast || (done && performance.now() - t0 > 9000)) break;
  }
  if (g0 !== gen) return; faceTo(pao, meet, door);
  await tween(1500, (t) => { pao.position.lerpVectors(meet, door, t); pao.position.y = LAND_H + Math.abs(Math.sin(t * 24)) * 0.25; swingLegs(pao.userData.legs, t, 0.6); });   // e torna in casa
  scene.remove(pao); camBack(); Music.hold(false);
  await syncModal(p, `<h2>🗣️ Paolo Vallebona</h2><p class="help">Ti farà perdere un sacco di tempo a parlare di Genova…<br><b>Perderai 1 turno perché starai ancora parlando con lui.</b></p>`, "Che pesantezza", 3000);
}
