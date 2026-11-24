"use strict";
/* ===== Menu, lobby online e regole di gioco =====
   Online il gioco è "lockstep": ogni browser simula la stessa partita (stesso seed) e il server
   inoltra soltanto le azioni dei giocatori umani. Per questo ogni scelta "di gioco" usa sr()/rnd()
   (casualità condivisa) e ogni decisione umana passa da ask()/submit(). */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const Net = { online: false, lobby: null, since: 0, token: 0, cid: (() => { let c = sessionStorage.getItem("cid"); if (!c) { c = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("cid", c); } return c; })() };
let gen = 0;                                   // cambia a ogni partita: i vecchi flussi si fermano
const gsleep = (ms) => { const g = gen; return new Promise((res) => setTimeout(() => { if (g === gen) res(); }, Q.fast ? 0 : ms)); };
async function api(path, body) {
  if (!Net.online) return {};   // versione mobile: nessun server
  try { const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cid: Net.cid, ...body }) }); return await r.json(); }
  catch (e) { return { error: "Server non raggiungibile" }; }
}
const myName = () => $("#myName").value.trim() || "Giocatore";
$("#myName").value = localStorage.getItem("sulcis_name") || "";
$("#myName").onchange = () => localStorage.setItem("sulcis_name", $("#myName").value.trim());

/* ================= Azioni sincronizzate ================= */
let timerLeft = 30, deadline = 0, tickIv = null, lastSec = -1, idleOpen = false;
const actionQ = []; let qWake = null, pending = null, gameSeen = new Set();
const mine = (p) => (Net.online ? p.owner === Net.cid : !p.cpu);
const me = () => (Net.online ? players.find((p) => p.owner === Net.cid) : players[cur] && !players[cur].cpu ? players[cur] : players.find((p) => !p.cpu) || players[cur]);
const canAct = () => !!pending && pending.kind === "turn" && !pending.sent && pending.pi === cur && players[cur] && mine(players[cur]) && inGame;
const redraw = () => { if (players.length && inGame) renderSide(); };
function deliver(a) { actionQ.push(a); if (qWake) { const w = qWake; qWake = null; w(); } }
const rawSleep = (ms) => new Promise((r) => setTimeout(r, ms));
function snapCam() { if (players[cur]) { cam.target.copy(players[cur].obj.position); cam.dist = FOLLOW_DIST; } redraw(); }
let lastActT = 0;
// allinea l'inizio di un'animazione tra tutti i client: parte a (istante dell'azione sul server + ms)
async function syncStart(ms = 900) {
  if (Q.fast || !lastActT || Net.off === undefined) return;
  const wait = (lastActT + ms / 1000) - (Date.now() / 1000 + Net.off);
  if (wait > 0 && wait < ms / 1000 + 0.5) await gsleep(wait * 1000);
}
const KIND_OK = { turn: ["roll", "card"], ack: ["ack"], choice: ["choice"] };
/* ---- Stato ufficiale: il server decide il turno. A fine turno un client invia lo stato, il server lo rende ufficiale
   e lo manda a tutti: chi si era sfasato viene riallineato a ogni turno. ---- */
let turnNo = 0, initState = null, admN = -1;   // admN: ultimo comando admin applicato (numero evento del server)
const PSTATE = ["pos", "hp", "money", "counter", "skip", "dir", "back", "carl", "cdir", "finished", "lastRoll", "lowStreak", "extraRoll", "bonusMove", "autoCount", "zone", "forceRoll", "forceEvent", "gun", "pizzo", "coke", "dmax", "beer", "chips", "spider", "negroni", "wind", "sameStreak", "simoneDone", "bike"];
let walls = [], firstDeath = false, angCool = 0;   // angCool: tiri che mancano prima che Marilena possa ricomparire
   // muri di Bacu Abis: { pos, owner, left }
function exportState() {
  return { cur, rng: _s, admN, firstDeath, angCool, walls: walls.map((w) => ({ ...w })), players: players.map((p) => { const o = { hold: p.hold.slice() }; PSTATE.forEach((k) => (o[k] = p[k] === undefined ? null : p[k])); return o; }) };
}
function importState(st) {
  if (!st || !Array.isArray(st.players)) return;
  if (typeof st.rng === "number") _s = st.rng;
  admN = typeof st.admN === "number" ? st.admN : -1;
  firstDeath = !!st.firstDeath; angCool = st.angCool | 0;
  walls = Array.isArray(st.walls) ? st.walls.map((w) => ({ ...w })) : [];
  st.players.forEach((o, i) => { const p = players[i]; if (!p) return; PSTATE.forEach((k) => (p[k] = o[k] === null ? (k === "dir" ? 1 : k === "zone" ? p.zone : k === "forceEvent" ? "" : 0) : o[k])); p.hold = (o.hold || []).slice(); p.counter = o.counter || null; p.carl = o.carl || null; });
}
function applyTurn(a) {   // arriva il turno ufficiale dal server: si abbandona qualunque cosa e si riparte da lì
  if (!inGame || !players.length) return;
  gen++; Music.hold(false); fxClear(); showSteps(0); clearDice(); if (dog) { scene.remove(dog); dog = null; }
  stopTimer(); pending = null; modalDone = null; $("#modal").hidden = true; $("#zoneBanner").hidden = true; idleOpen = false;
  cam.focus = null; cam.shake = 0; cam.goalDist = FOLLOW_DIST; cam.pitch = FOLLOW_PITCH; lastInput = -1e9;
  importState(a.state || initState);
  if (Array.isArray(a.owners)) a.owners.forEach((o, i) => { if (players[i]) players[i].owner = o; });
  if (Array.isArray(a.cpus)) a.cpus.forEach((c, i) => { if (players[i]) players[i].cpu = c; });
  cur = Math.max(0, Math.min(players.length - 1, a.cur | 0)); turnNo = a.tn;
  (a.adm || []).forEach((c) => { if (c.n > admN) { applyAdmin(c.cmd); admN = c.n; } });   // comandi admin arrivati dopo lo stato inviato
  players.forEach((q) => { q.animating = false; q.obj.visible = true; q.obj.scale.setScalar(0.95); q.obj.rotation.set(0, q.obj.rotation.y, 0); }); placePawns();
  if (a.skip) { log(`⏭️ Il server ha saltato il turno: tocca a ${players[cur].name}.`); if (!Q.fast) toast(`⏭️ Turno saltato: tocca a ${players[cur].name}`); }
  if (!Q.fast) { cam.target.copy(players[cur].obj.position); }
  redraw(); turnStart();
}
async function ask(pi, kind, def) {
  const g = gen; pending = { pi, kind, sent: false }; redraw();
  for (;;) {
    if (!actionQ.length && Q.fast && Q.live) { Q.fast = false; snapCam(); }   // log esaurito: fine del riavvolgimento
    while (!actionQ.length) { await new Promise((r) => (qWake = r)); if (g !== gen) return new Promise(() => {}); }
    if (g !== gen) return new Promise(() => {});
    const a = actionQ.shift();
    if (a.k === "own") {   // un altro dispositivo ha preso il posto di un giocatore (forza rientro)
      const q = players[a.pi]; if (q) { const was = q.owner; q.owner = a.owner; q.cpu = false; if (was === Net.cid && a.owner !== Net.cid && Net.online && !Q.fast) setTimeout(() => leaveToMenu("Un altro dispositivo ha preso il tuo posto."), 200); log(`🔁 ${q.name} è rientrato in partita da un altro dispositivo.`); redraw(); }
      continue;
    }
    if (a.k === "turn") { applyTurn(a); return new Promise(() => {}); }   // turno ufficiale dal server: il flusso corrente viene abbandonato
    if (a.k === "wd") continue;                                            // vecchio formato: ignorato
    if (a.k === "adm") { if (a.n == null || a.n > admN) { applyAdmin(a.cmd); if (a.n != null) admN = a.n; } continue; }
    if (a.k === "cpu") {
      const q = players[a.pi];
      if (q) {
        const wasMine = q.owner === Net.cid; q.cpu = true;
        if (Net.online && !Q.fast && wasMine) {
          if (a.why === "kick") setTimeout(() => leaveToMenu("Sei stato rimosso dalla partita."), 600);
          else setTimeout(() => { if (players[a.pi] && players[a.pi].cpu && Net.lobby) api("/api/takeover", { id: Net.lobby.id, name: players[a.pi].name, pi: a.pi }); }, 300);   // disconnessione momentanea: ci si riprende il posto da soli
        }
      }
      if (a.pi === pi) { pending = null; redraw(); return def; } continue; }   // leave solo dal vivo (non nel riavvolgimento) e solo se non ha ripreso il posto
    if (a.pi !== pi || !(KIND_OK[kind] || []).includes(a.k) || (a.tn != null && a.tn !== turnNo)) continue;   // azione in ritardo/doppia di un altro momento: scartata (uguale su tutti i client)
    pending = null; lastActT = a.t || 0; redraw(); return a;
  }
}
let actSeq = 0;
async function sendAct(body) {   // se la rete cade riprova (il server scarta i doppioni grazie ad aid)
  for (let i = 0; i < 6; i++) {
    const r = await api("/api/act", body);
    if (!r.error || r.error !== "Server non raggiungibile") return;
    await rawSleep(1000);
  }
}
function submit(k, v) {
  if (Q.fast || !pending || pending.sent) return; pending.sent = true;
  const a = { pi: pending.pi, k, v };
  if (Net.online) sendAct({ id: Net.lobby.id, aid: Net.cid + "-" + ++actSeq, tn: turnNo, ...a }); else deliver(a);
  redraw();
}
/* ---- comandi admin (finestra di debug): iniettati nello stream, applicati da tutti negli stessi punti ---- */
function applyAdmin(c) {
  const p = players[c.pi], num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));
  try {
    switch (c.type) {
      case "say": toast("📣 " + c.text); log("📣 [admin] " + c.text); break;
      case "hp": if (p) { p.hp = num(c.v, 1, START_HP); log(`🛠 [admin] ${p.name}: cuori = ${p.hp}`); } break;
      case "money": if (p) { p.money = num(c.v, 0, MAX_MONEY); log(`🛠 [admin] ${p.name}: monete = ${p.money}`); } break;
      case "skip": if (p) { p.skip = num(c.v, 0, 9); log(`🛠 [admin] ${p.name}: turni da saltare = ${p.skip}`); } break;
      case "force": if (p) { p.forceRoll = num(c.v, 1, 16); log(`🛠 [admin] ${p.name}: prossimo tiro = ${p.forceRoll}`); } break;
      case "tp": if (p) { p.dir = 1; p.back = false; p.carl = null; p.pos = num(c.v, 1, FINISH); p.zone = SQ[p.pos].zone; placePawns(); log(`🛠 [admin] ${p.name} teletrasportato alla casella ${p.pos}`); } break;
      case "kill": if (p) { p.dir = 1; p.back = false; p.carl = null; p.pos = [...HOSP].reverse().find((x) => x <= p.pos) || 1; p.hp = 50; p.money = Math.floor(p.money * 0.75); p.skip = 0; placePawns(); log(`🛠 [admin] ${p.name} è morto (ospedale ${p.pos})`); } break;
      case "cpu": if (p) { p.cpu = true; log(`🛠 [admin] ${p.name} ora è una CPU`); } break;
      case "give": { const a = azById(c.card); if (p && a) { if (a.tipo === "Passiva") giveAction(p, a); else if (a.tipo === "Contro") p.counter = a.id; else { if (p.hold.length >= MAX_HOLD) p.hold.shift(); p.hold.push(a.id); } log(`🛠 [admin] ${p.name} riceve ${a.nome}`); toast(`🎁 ${p.name} riceve ${a.nome}`); } break; }
      case "event": if (p) { p.forceEvent = String(c.name || ""); log(`🛠 [admin] ${p.name}: al prossimo arrivo succede «${p.forceEvent || "niente"}»`); toast(`🛠 Evento forzato per ${p.name}: ${p.forceEvent || "annullato"}`); } break;
      case "clearcards": if (p) { p.hold = []; p.counter = null; log(`🛠 [admin] carte di ${p.name} rimosse`); } break;
    }
  } catch (e) { console.error(e); }
  redraw();
}
/* ---- snapshot dello stato per la finestra di debug ---- */
let lastSnap = "";
function pushSnap() {
  if (!Net.online || !Net.lobby || !inGame || Q.fast) return;
  const snap = { cur, turn: turnNo, mode: mode.nome, finish: FINISH, pending: pending ? { pi: pending.pi, kind: pending.kind } : null, timerLeft,
    players: players.map((p, i) => ({ i, name: p.name, color: p.color, pawn: p.pawn.emoji, cpu: p.cpu, owner: p.owner ? p.owner.slice(0, 4) : null, pos: p.pos, zone: p.zone, hp: p.hp, money: p.money, hold: p.hold, counter: p.counter, got: p.got, skip: p.skip, auto: p.autoCount || 0, low: p.lowStreak || 0, force: p.forceRoll || 0, ev: p.forceEvent || "" })),
    route: SQ.slice(1, FINISH + 1).map((q) => [Math.round(q.x), Math.round(q.z), q.zone]), dir: players.map((p) => p.dir), back: players.map((p) => p.back),
    log: logLines.slice(-80) };
  const j = JSON.stringify(snap); if (j === lastSnap) return; lastSnap = j;
  api("/api/state", { id: Net.lobby.id, snap });
}
let snapIv = null;

// Mostra un prompt al proprietario (con timeout) a meno che la risposta sia già nel log (riavvolgimento dopo reload)
async function ownerPrompt(w, kind, html, btn, auto, toVal) {
  let settled = false; w.then(() => (settled = true));
  await rawSleep(0);
  if (settled) return w;
  const mp = modal(html, btn, auto);
  const first = await Promise.race([w.then((a) => ({ a })), mp.then((v) => ({ v }))]);
  if (first.a) { closeModal(); return first.a; }
  submit(kind, toVal(first.v)); return w;
}
// modale che blocca tutti finché il proprietario conferma (CPU: chiusura automatica)
async function syncModal(p, htmlIn, btn = "OK", autoMs = 2200, minMs = 0) {   // htmlIn può essere {me, others}: contenuto riservato a chi lo ottiene
  const html0 = typeof htmlIn === "object" ? (mine(p) ? htmlIn.me : htmlIn.others) : htmlIn;
  const ACK_MS = 10000, t0 = Date.now(), html = p.cpu ? html0 : html0 + `<p class="cdn">⏱ si chiude tra <b class="cdnN">10</b> s</p>`;   // avvisi: al massimo 10 secondi, così nessuno aspetta
  const cdIv = p.cpu ? null : setInterval(() => { const el = document.querySelector("#modalInner .cdnN"); if (!el) return; el.textContent = Math.max(0, Math.ceil((ACK_MS - (Date.now() - t0)) / 1000)); }, 250);   // minMs: tempo minimo di visione per chi guarda (es. la carta pescata da un altro)
  if (p.cpu) { await modal(html, "", autoMs); return; }
  const pi = players.indexOf(p), w = ask(pi, "ack", { k: "ack" });
  if (mine(p)) { await ownerPrompt(w, "ack", html, btn, ACK_MS, () => undefined); clearInterval(cdIv); }
  else { const t0 = performance.now(); modal(html, ""); await w; const left = minMs - (performance.now() - t0); if (left > 0 && !Q.fast) await gsleep(left); clearInterval(cdIv); closeModal(); }
}

/* ================= Menu ================= */
let setupPlayers = [{ name: "Giocatore 1", cpu: false, pawn: "random" }, { name: "Giocatore 2", cpu: true, pawn: "random" }], lobbyTimer = null;
const MENUS = ["menuHome", "menuAvatar", "menuLocal", "menuLobbies", "menuRoom"];
let myAvatar = localStorage.getItem("sulcis_avatar") || "random";
function showMenu(id) {
  MENUS.forEach((m) => ($("#" + m).hidden = m !== id)); clearInterval(lobbyTimer);
  $("#setup").classList.toggle("big", id !== "menuHome" && id !== "menuLocal");
  if (id === "menuAvatar") renderAvatars();
  if (id === "menuLobbies") { refreshLobbies(); lobbyTimer = setInterval(refreshLobbies, 2000); }
}
document.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => showMenu("menuHome")));
$("#goOnline").onclick = () => { renderSetup(); showMenu("menuLocal"); };
$("#avatarOk").onclick = () => showMenu("menuLobbies");
function renderAvatars() {
  $("#avatarGrid").innerHTML = [{ id: "random", emoji: "🎲", nome: "Casuale" }, ...PAWNS].map((w) => `<button data-av="${w.id}" class="${myAvatar === w.id ? "sel" : ""}"><b>${w.emoji}</b>${w.nome}</button>`).join("");
  $("#avatarGrid").querySelectorAll("[data-av]").forEach((b) => (b.onclick = () => { myAvatar = b.dataset.av; localStorage.setItem("sulcis_avatar", myAvatar); renderAvatars(); }));
}

let diffSel = localStorage.getItem("sulcis_diff") || "normale";
let botCount = Math.max(1, Math.min(5, +(localStorage.getItem("sulcis_bots") || 3)));
const BOT_NAMES = ["Bot Efisio", "Bot Tziu Gigi", "Bot Bonaria", "Bot Ignazio", "Bot Peppineddu"];
function renderSetup() {   // versione mobile: tu contro da 1 a 5 bot
  const opts = `<option value="random">🎲 Casuale</option>${PAWNS.map((w) => `<option value="${w.id}" ${myAvatar === w.id ? "selected" : ""}>${w.emoji} ${w.nome}</option>`).join("")}`;
  $("#players").innerHTML = `<div class="prow"><span class="dot" style="background:${COLORS[0]}"></span><b>La tua pedina</b><select id="soloPawn">${opts}</select></div>
    <div class="prow"><b>🧠 Difficoltà</b><span class="botsel">${Object.entries(DIFFS).map(([k, v]) => `<button data-diff="${k}" class="${k === diffSel ? "primary" : ""}">${v}</button>`).join("")}</span></div>
    <p class="muted" style="font-size:.75em;margin:2px 0 6px">${{ facile: "I bot tirano numeri bassi e restano indietro.", normale: "Tutto normale.", difficile: "I bot fanno un sacco di numeri alti.", demon: "I bot sono computer: calcolano il tiro perfetto per ogni mossa." }[diffSel]}</p>
    <div class="prow"><b>🤖 Bot avversari</b><span class="botsel">${[1, 2, 3, 4, 5].map((n) => `<button data-bots="${n}" class="${n === botCount ? "primary" : ""}">${n}</button>`).join("")}</span></div>`;
  $("#soloPawn").onchange = (e) => { myAvatar = e.target.value; localStorage.setItem("sulcis_avatar", myAvatar); };
  $("#players").querySelectorAll("[data-diff]").forEach((b) => (b.onclick = () => { diffSel = b.dataset.diff; localStorage.setItem("sulcis_diff", diffSel); renderSetup(); }));
  $("#players").querySelectorAll("[data-bots]").forEach((b) => (b.onclick = () => { botCount = +b.dataset.bots; localStorage.setItem("sulcis_bots", botCount); renderSetup(); }));
}
$("#start").onclick = () => {
  const free = PAWNS.filter((w) => w.id !== myAvatar).sort(() => Math.random() - 0.5);
  const meP = { name: myName(), cpu: false, owner: null, pawn: myAvatar === "random" ? (free.pop() || pickOne(PAWNS)).id : myAvatar };
  const bots = BOT_NAMES.slice(0, botCount).map((name) => ({ name, cpu: true, owner: null, pawn: (free.pop() || pickOne(PAWNS)).id }));
  Net.online = false;
  beginGame({ seed: 1 + Math.floor(Math.random() * 2 ** 31), mode: document.querySelector("input[name=mode]:checked").value, diff: diffSel, players: [meP, ...bots] });
};

/* ----- lobby ----- */
async function refreshLobbies() {
  try {
    const l = await (await fetch("/api/lobbies")).json();
    $("#lobbyList").innerHTML = l.length ? l.map((x) => `<div class="lobby"><span><b>${esc(x.name)}</b><br><small>👑 ${esc(x.host)} · ${x.n}/${x.max} · ${x.mode === "rapida" ? "⚡ Rapida" : "🎲 Normale"}${x.state === "playing" ? " · in corso" : ""}</small></span>${x.state === "playing" ? `<button data-take="${x.id}">↩ Rientra</button>` : `<button data-join="${x.id}" ${x.n >= x.max ? "disabled" : ""}>Entra</button>`}</div>`).join("") : '<p class="muted">Nessuna lobby: creane una!</p>';
    $("#lobbyList").querySelectorAll("[data-join]").forEach((b) => (b.onclick = () => joinLobby(b.dataset.join)));
    $("#lobbyList").querySelectorAll("[data-take]").forEach((b) => (b.onclick = () => takeoverLobby(b.dataset.take)));
  } catch (e) { $("#lobbyList").innerHTML = '<p class="muted">Server non raggiungibile.</p>'; }
}
$("#createLobby").onclick = async () => {
  const r = await api("/api/create", { pawn: myAvatar, name: myName(), lname: $("#newLobbyName").value.trim() || myName() + " – lobby", mode: $("#newLobbyMode").value });
  r.error ? ($("#lobbyMsg").textContent = r.error) : enterRoom(r.id);
};
async function takeoverLobby(id) {   // forza rientro: stesso nome del giocatore = prendi il suo posto
  const nm = (prompt("Con che nome giocavi? (scrivi esattamente il nome del giocatore)", myName() === "Giocatore" ? "" : myName()) || "").trim(); if (!nm) return;
  const r = await api("/api/takeover", { id, name: nm });
  if (r.error) { $("#lobbyMsg").textContent = r.error; return; }
  $("#lobbyMsg").textContent = ""; Q.fast = true; Q.live = false; enterRoom(id);   // la partita viene riavvolta e riprendi dal punto esatto
}
async function joinLobby(id) { const r = await api("/api/join", { id, pawn: myAvatar, name: myName() }); r.error ? ($("#lobbyMsg").textContent = r.error) : enterRoom(id); }
function enterRoom(id) { localStorage.setItem("sulcis_lobby", id); $("#btnLeave").hidden = false; Net.online = true; Net.lobby = { id, players: [], host: "" }; Net.since = 0; $("#roomMsg").textContent = ""; showMenu("menuRoom"); pollLoop(++Net.token); }
async function pollLoop(tok) {
  while (Net.online && Net.token === tok && Net.lobby) {
    try {
      const d = await (await fetch(`/api/poll?id=${Net.lobby.id}&since=${Net.since}&cid=${Net.cid}`)).json();
      if (Net.token !== tok) return;
      if (d.closed) { await leaveToMenu("La lobby è stata chiusa."); return; }
      if (d.now && d.events.length) { const o = d.now - Date.now() / 1000; Net.off = Net.off === undefined ? o : Math.min(Net.off, o); }   // scarto tra orologio server e locale (il minimo = il più preciso)
      Net.since = d.next; for (const ev of d.events) handleEvent(ev);
      if (!Q.live) { Q.live = true; if (!inGame) Q.fast = false; }
    } catch (e) { await new Promise((r) => setTimeout(r, 1200)); }
  }
}
let lastEvtAt = Date.now(), svCdUntil = 0;
const FORCE_FROM = 40, FORCE_AT = 60;   // dopo 40 s senza nulla compare il conto alla rovescia; a 60 s il server forza il turno successivo
setInterval(() => {
  const fb = $("#forceBar"), idle = (Date.now() - lastEvtAt) / 1000, on = inGame && Net.online && !Q.fast;
  const bs = $("#btnSkip"); if (bs) { bs.hidden = !inGame; const cl = Math.ceil((svCdUntil - Date.now()) / 1000); bs.textContent = cl > 0 ? `⏩ ${cl}s` : "⏩"; bs.style.opacity = cl > 0 ? 0.55 : 1; }   // sempre visibile durante la partita; con cooldown mostra i secondi
  if (!fb) return;
  if (!on || idle < FORCE_FROM) { fb.hidden = true; return; }
  fb.hidden = false; fb.textContent = `⏳ La prossima azione verrà forzata tra ${Math.max(0, Math.ceil(FORCE_AT - idle))} s`;
}, 500);
$("#btnSkip").onclick = async () => { if (!Net.online || !Net.lobby) { toast("⏩ Il voto funziona solo nelle partite online"); return; }
  const left = Math.ceil((svCdUntil - Date.now()) / 1000); if (left > 0) { toast(`⏩ Salta turno di nuovo disponibile tra ${left} s`); return; } const res = await api("/api/skipvote", { id: Net.lobby.id }); if (res.error === "cooldown") { svCdUntil = Date.now() + res.left * 1000; toast(`⏩ Salta turno di nuovo disponibile tra ${res.left} s`); return; }
  $("#btnSkip").classList.add("on"); toast("⏩ Hai chiesto di saltare il turno: aspetto gli altri"); };
function onSkipVote(ev) {
  if (ev.ph === "start") svCdUntil = Date.now() + 90000;   // cooldown di 1 min 30 per tutti
  if (Q.fast) return; const q = players[ev.by], box = $("#skipAsk"), mineP = players.some((x) => mine(x) && !x.cpu);
  if (ev.ph === "no") { box.hidden = true; $("#btnSkip").classList.remove("on"); toast(`🚫 ${q ? q.name : "?"} ha detto no: il turno non viene saltato`); return; }
  if (ev.ph === "yes") { toast(`🗳️ ${q ? q.name : "?"} vota sì (${ev.n}/${ev.need})`); if (q && mine(q)) box.hidden = true; return; }
  // ph === "start": chi ha cliccato per primo lo mostra agli altri
  if (q && mine(q)) return;
  if (!mineP) return;
  box.hidden = false; box.innerHTML = `⏩ <b>${esc(q ? q.name : "?")}</b> vuole saltare il turno.<br>Saltiamo?<br><button data-y="1" class="primary">✔ Sì</button><button data-y="0">✖ No</button>`;
  box.querySelectorAll("button").forEach((b) => (b.onclick = () => { box.hidden = true; api("/api/skipvote", { id: Net.lobby.id, yes: b.dataset.y === "1" }); }));
}
function handleEvent(ev) {
  lastEvtAt = Date.now();
  if (ev.type !== "skipvote" && ev.type !== "lobby" && ev.type !== "ready") { const sa = $("#skipAsk"); if (sa) sa.hidden = true; const bs = $("#btnSkip"); if (bs) bs.classList.remove("on"); }   // qualunque azione annulla il voto
  if (ev.type === "lobby") { Net.lobby = ev.lobby; if (!inGame) renderRoom(); }
  else if (ev.type === "start") beginGame({ seed: ev.seed, mode: ev.mode, players: ev.players });
  else if (ev.type === "act") deliver({ pi: ev.pi, k: ev.k, v: ev.v, t: ev.t, tn: ev.tn });
  else if (ev.type === "turn") {
    const it = { k: "turn", tn: ev.tn, state: ev.state, cur: ev.cur, skip: ev.skip, owners: ev.owners, cpus: ev.cpus, adm: ev.adm }; deliver(it);
    setTimeout(() => { const i = actionQ.indexOf(it); if (i >= 0 && inGame) { actionQ.splice(0, i + 1); applyTurn(it); } }, 8000);   // chi è rimasto indietro (o bloccato) dopo 8 s si riallinea comunque
  }
  else if (ev.type === "cpu") deliver({ k: "cpu", pi: ev.pi, why: ev.why });
  else if (ev.type === "adm") deliver({ k: "adm", cmd: ev.cmd, n: ev.n });
  else if (ev.type === "own") deliver({ k: "own", pi: ev.pi, owner: ev.owner });
  else if (ev.type === "skipvote") onSkipVote(ev);
  else if (ev.type === "ready") { if (barrier && barrier.seq === ev.seq) barrier.res(); }
  else if (ev.type === "wd") { /* vecchio salto turno: ora lo fa il server con un evento "turn" */ }
  else if (ev.type === "closed") leaveToMenu("La lobby è stata chiusa.");
}
function renderRoom() {
  const L = Net.lobby, mi = L.players.find((p) => p.cid === Net.cid), host = L.host === Net.cid;
  $("#roomTitle").textContent = `🌐 ${L.name} · codice ${L.id} · ${L.mode === "rapida" ? "⚡ Rapida" : "🎲 Normale"}`;
  $("#roomPlayers").innerHTML = L.players.map((p, i) => {
    const own = p.cid === Net.cid, takenBy = (w) => L.players.some((q, k) => k !== i && q.pawn === w);
    const pawn = own ? `<select data-pawn>${`<option value="random">🎲 Casuale</option>` + PAWNS.map((w) => `<option value="${w.id}" ${p.pawn === w.id ? "selected" : ""} ${takenBy(w.id) ? "disabled" : ""}>${w.emoji} ${w.nome}</option>`).join("")}</select>` : `<span>${p.pawn === "random" ? "🎲" : PAWNS.find((w) => w.id === p.pawn)?.emoji || ""}</span>`;
    return `<div class="rp"><span class="dot" style="background:${COLORS[i]}"></span><span class="pbig">${p.pawn === "random" ? "🎲" : PAWNS.find((w) => w.id === p.pawn)?.emoji || ""}</span><span class="nm">${p.cid === L.host ? "👑 " : ""}${esc(p.name)}${p.cpu ? " 🤖" : ""}${own ? " (tu)" : ""}</span>${pawn}<span class="${p.ready || p.cpu ? "ok" : "no"}">${p.ready || p.cpu ? "✔" : "⏳"}</span>${host && p.cpu ? `<button data-rmcpu="${i}">✕</button>` : ""}</div>`;
  }).join("");
  const sel = $("#roomPlayers").querySelector("[data-pawn]"); if (sel) sel.onchange = () => api("/api/update", { id: L.id, pawn: sel.value });
  $("#roomPlayers").querySelectorAll("[data-rmcpu]").forEach((b) => (b.onclick = () => api("/api/update", { id: L.id, removecpu: +b.dataset.rmcpu })));
  $("#roomHost").hidden = !host; $("#roomMode").value = L.mode;
  $("#roomReady").hidden = host; $("#roomReady").textContent = mi && mi.ready ? "⏳ Non pronto" : "✔ Pronto";
  const allReady = L.players.every((p) => p.ready || p.cpu || p.cid === L.host);
  $("#roomStart").disabled = L.players.length < 2 || !allReady; $("#roomAddCpu").disabled = L.players.length >= MAX_PLAYERS;
  $("#roomMsg").textContent = host ? (L.players.length < 2 ? "Servono almeno 2 giocatori (aggiungi una CPU o aspetta qualcuno)." : allReady ? "Tutti pronti: puoi iniziare!" : "In attesa che tutti siano pronti…") : "In attesa che l'host inizi la partita…";
}
$("#roomMode").onchange = () => api("/api/update", { id: Net.lobby.id, mode: $("#roomMode").value });
$("#roomAddCpu").onclick = () => api("/api/update", { id: Net.lobby.id, addcpu: true });
$("#roomReady").onclick = () => { const mi = Net.lobby.players.find((p) => p.cid === Net.cid); api("/api/update", { id: Net.lobby.id, ready: !(mi && mi.ready) }); };
$("#roomStart").onclick = async () => { const r = await api("/api/start", { id: Net.lobby.id }); if (r.error) $("#roomMsg").textContent = r.error; };
$("#roomLeave").onclick = () => leaveToMenu();
async function leaveToMenu(msg) {
  const id = Net.lobby && Net.lobby.id; localStorage.removeItem("sulcis_lobby"); $("#btnLeave").hidden = true; Q.fast = false; Q.live = false; Net.token++; const was = Net.online; Net.online = false; Net.lobby = null;
  if (was && id) api("/api/leave", { id });
  endToMenu(); showMenu(was ? "menuLobbies" : "menuHome"); if (msg) $("#lobbyMsg").textContent = msg;
}
// (niente leave su pagehide: un ricaricamento deve poter rientrare; i disconnessi vengono tolti dal server dopo 30 s)

const TURN_MS = () => window.TURN_MS || 30000;
function startTimer() { deadline = Date.now() + TURN_MS(); timerLeft = Math.ceil(TURN_MS() / 1000); lastSec = -1; clearInterval(tickIv); tickIv = setInterval(timerTick, 200); }
function stopTimer() { clearInterval(tickIv); tickIv = null; const b = $("#banner"); b.classList.remove("timing", "urgent"); $("#bigCount").hidden = true; }
function timerTick() {
  if (!inGame || Q.fast || !pending || pending.kind !== "turn") return;
  const ms = deadline - Date.now(), left = Math.max(0, Math.ceil(ms / 1000)), b = $("#banner");
  timerLeft = left; b.classList.add("timing"); b.classList.toggle("urgent", left <= 10);
  $("#tb").style.width = Math.max(0, Math.min(100, (ms / TURN_MS()) * 100)) + "%"; $("#tb").style.background = left <= 5 ? "#ff3b3b" : left <= 10 ? "#ffb02e" : "#4cd964";
  $("#bt").textContent = $("#bt").textContent.replace(/ · ⏱ .*$/, "") + ` · ⏱ ${left}s`;
  if (left <= 10 && left > 0) { const bc = $("#bigCount"); bc.hidden = false; if (bc.textContent !== String(left)) { bc.textContent = left; } } else $("#bigCount").hidden = true;
  if (left !== lastSec) {
    lastSec = left;
    if (canAct()) { if (left === 10) Sfx.warn(); else if (left <= 5 && left >= 1) Sfx.clock(); }   // avviso a 10 s e ticchettio da 5 a 1
  }
  if (left <= 0 && canAct()) submit("roll", "auto");   // tempo scaduto: tira da solo
}
/* ================= HUD ================= */
$("#btnSide").onclick = () => $("#side").classList.toggle("open");
$("#btnView").onclick = () => { cam.focus = null; cam.goalDist = FOLLOW_DIST; cam.pitch = FOLLOW_PITCH; lastInput = -1e9; };
$("#quit").onclick = () => { if (confirm("Abbandonare la partita?")) leaveToMenu(); };
$("#btnLeave").onclick = () => { if (confirm("Lasciare la partita e tornare al menu?")) leaveToMenu(); };
function endToMenu() {
  gen++; Music.hold(false); fxClear(); showSteps(0); inGame = false; clearInterval(snapIv); stopTimer(); clearDice(); $("#progress").textContent = ""; pending = null; actionQ.length = 0; modalDone = null; $("#modal").hidden = true;
  players.forEach((p) => scene.remove(p.obj)); players = []; if (dog) { scene.remove(dog); dog = null; }
  $("#game").hidden = true; $("#setup").hidden = false; cam.mode = "menu"; cam.focus = null; $("#zoneBanner").hidden = true;
}
const logLines = [];
const log = (m) => { const d = document.createElement("div"); d.textContent = m; $("#log").prepend(d); logLines.push(new Date().toLocaleTimeString() + "  " + m); if (logLines.length > 150) logLines.shift(); };
const score = (p) => p.money;

const hearts = (n) => "❤️".repeat(Math.max(0, n)) + "🖤".repeat(Math.max(0, START_HP - n));
const statusIcons = (q) => `${q.spider ? "🕷️" : ""}${q.skip >= 2 ? "🕸️" : ""}${q.beer ? "🍺" : ""}${q.negroni ? "🍸" : ""}${q.wind ? "🌬️" : ""}${q.bike ? "🚲" : ""}${q.chips ? "🍟" : ""}${q.gun ? "🔫" : ""}${q.pizzo ? "💼" : ""}${q.coke ? "❄️" : ""}${q.dmax ? "👊" : ""}${q.counter ? "🛡️" : ""}`;
const ZONE_EVENTS = {
  fake: "💩 A ogni tiro hai il 20% di cagarti addosso e tornare indietro di 1 casella.",
  true: "🧹 A ogni tiro hai il 20% che arrivi Marilena a lavare per terra: ti spinge indietro di 4 caselle (e chi ti sta vicino). Dopo che è passata, per 5 tiri non torna.",
  mid: "😶 Ti senti molto solo: a ogni tiro hai il 10% che uno sconosciuto ti accoltelli alle spalle: perdi 1 ❤️ (a 0 muori e torni all'ospedale precedente).",
  job: "🍟 A ogni tiro hai il 20% che la mamma di Giorgia ti assuma al McDonald: guadagni 3€ ma salti il prossimo turno.",
  out: "🏙️ Qui non c'è niente: torna indietro verso Gonnesa!" };
function zoneInfo() {
  const m = me() || players[cur]; if (!m || !$("#modal").hidden) return;
  const zk = SQ[Math.min(m.pos, FINISH)] ? (m.pos >= CARL0 ? "true" : SQ[m.pos].zone) : "fake", z = PERC.zone[zk];
  const sp = []; for (let n = 1; n <= FINISH; n++) { const q = SQ[n]; if (q.zone === zk && (q.kind === "green" || q.kind === "hosp" || q.kind === "shop" || q.kind === "goal" || q.event || q.heart)) sp.push(`<li><b>${n}</b>: ${squareDesc(n).replace(/ · [^·]*$/, "")}</li>`); }
  modal(`<h2 style="color:${z.colore}">ℹ️ ${z.nome}</h2><p class="help">${z.desc}</p><p class="help"><b>Cosa può succedere:</b> ${ZONE_EVENTS[zk] || ""}${p_pizzo(m)}</p><h3>Caselle speciali della zona</h3><ul class="help" style="max-height:38vh;overflow:auto;margin:0;padding-left:18px">${sp.join("")}</ul>`, "Chiudi");
}
const p_pizzo = (m) => (m.pizzo ? "<br>💼 Paghi il pizzo: il mafioso ti difende dagli eventi di zona." : "");
$("#zoneInfoBtn").onclick = zoneInfo;
function renderSide() {
  const p = players[cur], m = me() || p, act = canAct();
  $("#progress").textContent = m.pos >= CARL0 ? "📍 Carloforte" : m.pos > WIN1 ? "📍 Oltre Gonnesa" : `📍 ${Math.min(m.pos, WIN1)}/${WIN1}`;
  $("#bt").textContent = `${act ? "👉 Tocca a te" : "È il turno di: " + esc(p.name)}${p.cpu ? " 🤖" : ""} · ${mode.nome}${pending && pending.kind === "turn" ? " · ⏱ " + Math.max(0, timerLeft) + "s" : ""}`; $("#banner").style.borderColor = p.color;
  $("#stats").innerHTML = `<b style="color:${m.color}">${m.pawn.emoji} ${esc(m.name)}</b> · casella ${m.pos}<br>${hearts(m.hp)} · 💶 ${m.money}/${MAX_MONEY}€ ${statusIcons(m)}<br><small>${zoneOf(m.pos).nome}</small>`;
  $("#plist").innerHTML = players.map((q, i) => `<div class="pp ${i === cur ? "on" : ""} ${q.hp <= 0 ? "dead" : ""}" style="--c:${q.color}">${q.pawn.emoji} <b>${esc(q.name)}</b> ${hearts(q.hp)}${q.finished ? ` 🏁${q.finished}º` : ""} ${statusIcons(q)}</div>`).join("");
  { const pl = $("#plist").getBoundingClientRect(); $("#zoneInfoBtn").style.top = Math.round(pl.bottom + 4) + "px"; }
  $("#scores").innerHTML = players.map((q, i) => `<div class="pl ${i === cur ? "on" : ""}"><span class="dot" style="background:${q.color}"></span><b>${q.pawn.emoji} ${esc(q.name)}</b>${q.cpu ? " 🤖" : ""}${q.finished ? ` 🏁${q.finished}º` : ""} · #${q.pos} · ❤️${q.hp} 💶${q.money}€${q.skip ? ` ⏸${q.skip}` : ""}${q.counter ? " 🛡️" : ""}
    <div class="hand">${q.hold.map((id) => `<span class="chip" title="${azById(id).nome}">${azById(id).emoji}</span>`).join("")}${q.counter ? `<span class="chip" title="${azById(q.counter).nome}">${azById(q.counter).emoji}</span>` : ""}</div></div>`).join("");
  $("#scores").querySelectorAll(".chip").forEach((c) => (c.onclick = () => { if ($("#modal").hidden) modal(`<div class="cardshow">${cardHTML(cardById(+c.dataset.id))}</div>`, "Chiudi"); }));
  [0, 1].forEach((i) => { const b = $("#slot" + i), a = m.hold[i] ? azById(m.hold[i]) : null; b.className = "slot" + (a ? " full" : ""); b.innerHTML = a ? `<b>${a.emoji}</b>${a.nome}` : "<b>·</b>vuoto"; b.disabled = !a || !act || m !== p; });
  const c = m.counter ? azById(m.counter) : null; $("#slotC").className = "slot counter" + (c ? " full" : ""); $("#slotC").innerHTML = c ? `<b>${c.emoji}</b>${c.nome}` : "<b>🛡️</b>slot salvezza"; $("#slotC").disabled = !c;
  $("#roll").disabled = !act; $("#d2").style.display = mode.dice > 1 ? "" : "none";
}
$("#slot0").onclick = () => useSlotUI(0); $("#slot1").onclick = () => useSlotUI(1);
$("#slotC").onclick = () => { const m = me(); if (m && m.counter && $("#modal").hidden) modal(`<div class="cardshow">${cardHTML(azById(m.counter))}</div><p class="help">Resta nello slot: ti verrà chiesto se usarla quando qualcosa sta per colpirti.</p>`, "Chiudi"); };
$("#roll").onclick = () => { if (canAct()) submit("roll"); };
async function useSlotUI(i) {
  if (!canAct() || !$("#modal").hidden) return;
  const p = players[cur], a = azById(p.hold[i]); if (!a) return;
  const v = await modal(`<div class="cardshow">${cardHTML(a)}</div><div class="pick"><button class="primary" data-v="play">▶ Gioca</button><button data-v="no">Annulla</button></div>`, "");
  if (v !== "play" || !canAct()) return;
  let t = cur;
  if (a.bersaglio === "giocatore") {
    const others = players.filter((q) => q !== p && !q.finished); if (!others.length) return toast("Nessun bersaglio!");
    const tv = await modal(`<h2>Contro chi?</h2><div class="pick">${others.map((q) => `<button data-v="${players.indexOf(q)}"><span class="dot" style="background:${q.color}"></span> ${esc(q.name)} (#${q.pos})</button>`).join("")}<button data-v="no">Annulla</button></div>`, "");
    if (tv === "no" || tv === undefined || !canAct()) return; t = +tv;
  }
  submit("card", { i, t });
}

/* ================= Regole ================= */
const heal = (p, n) => { p.hp = Math.min(START_HP, p.hp + n); Sfx.heal(); };
async function askCounter(t) { // avviso senza spoiler
  if (!t.counter) return false;
  Sfx.warn(); let use;
  if (t.cpu) use = sr() < 0.7;
  else {
    const pi = players.indexOf(t), w = ask(pi, "choice", { k: "choice", v: "n" });
    if (mine(t)) await ownerPrompt(w, "choice", `<h2>⚠️ ${esc(t.name)}: qualcosa sta per succedere...</h2><p class="help">Non sai cosa, né se sia bello o brutto.<br>Desideri usare la tua carta salvezza <b>${azById(t.counter).emoji} ${azById(t.counter).nome}</b> per proteggerti dagli effetti?</p><div class="pick"><button class="primary" data-v="y">🛡️ Sì, proteggimi</button><button data-v="n">No, corro il rischio</button></div>`, "", 30000, (v) => (v === "y" ? "y" : "n"));
    else toast(`⚠️ ${t.name} sta decidendo...`);
    use = (await w).v === "y";
  }
  if (use) { log(`🛡️ ${t.name} usa ${azById(t.counter).nome} e si protegge!`); toast(`🛡️ ${t.name} si protegge!`); t.counter = null; redraw(); }
  return use;
}
async function damage(t, n, why) { Sfx.hit(); t.hp = Math.max(0, t.hp - n); log(`💥 ${t.name} perde ${n} ❤️ (${why})`); redraw(); if (t.hp <= 0) await kill(t); }
async function kill(t) {
  const g = gen, from = t.pos >= CARL0 ? t.carl || 30 : Math.min(t.pos, FINISH);
  t.justDied = true; t.dir = 1; t.back = false; t.carl = null;
  toast(`💀 ${t.name} è morto!`); Sfx.death(); log(`💀 ${t.name} è morto e va all'ospedale.`);
  const h = [...HOSP].reverse().find((x) => x <= from) || HOSP[0];
  await deathRide(t, h); if (g !== gen) return;
  t.hp = START_HP; t.money = 0; t.skip = 0; t.zone = SQ[h].zone; redraw(); log(`🏥 ${t.name} si risveglia all'ospedale (casella ${h}) con ${START_HP} ❤️ ma senza un euro.`);
  if (!firstDeath) {   // la prima volta che qualcuno muore lo spieghiamo a tutti
    firstDeath = true;
    await syncModal(t, `<h2>💀 ${esc(t.name)} è morto</h2><p class="help">Quando perdi i tuoi <b>2 ❤️</b> torni al <b>primo ospedale dietro di te</b>, con <b>2 ❤️</b> ma <b>perdi tutti i soldi</b>.</p>`, "Capito", 6000);
  }
}
function flashRange(center, r, col = 0x990000) {
  discs.forEach((d) => { if (Math.abs(d.userData.n - center) <= r) d.material.emissive = new T.Color(col); });
  setTimeout(() => discs.forEach((d) => (d.material.emissive = new T.Color(d.userData.em || 0))), 2200);
}
const ZARA_MS = 16100;   // durata fissa dell'evento (= traccia audio), uguale per tutti: nessuno finisce prima degli altri
async function zara(caster) {
  const g0 = gen, tZ = performance.now(); Sfx.zara(); Music.duck(0.12);
  const s0 = SQ[caster.pos], nxt = SQ[Math.min(FINISH, caster.pos + 1)], prv = SQ[Math.max(1, caster.pos - 1)];
  let fx = nxt.x - prv.x, fz = nxt.z - prv.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;      // direzione della strada
  const sx = -fz, sz = fx, V = (x, y, z) => new T.Vector3(x, y, z), heading = Math.atan2(-fz, fx), yaw0 = Math.atan2(-fx, -fz);
  const spot = V(s0.x + sx * 6, LAND_H, s0.z + sz * 6), start = V(spot.x + sx * 30 - fx * 22, LAND_H, spot.z + sz * 30 - fz * 22);
  dog = makeDog(); dog.position.copy(start); dog.rotation.y = Math.atan2(-(spot.z - start.z), spot.x - start.x); scene.add(dog);
  const { body, legs, tail, anchor } = dog.userData, focus = V(s0.x, LAND_H, s0.z), fxs = [];
  cam.focus = focus; cam.mode = "follow"; lastInput = performance.now(); cam.goalDist = 28; cam.pitch = 0.5; cam.yaw = yaw0 + 0.8;
  toast("🐕‍⬛ ZARA CANE DI MERDA!"); log(`🐕‍⬛ ${caster.name} gioca ZARA CANE DI MERDA!`);
  // particelle (puzza/vapore) aggiornate da un loop dedicato
  let alive = true, last = performance.now();
  const puff = (pos, col, rad, vel, life, op = 0.5) => { if (Q.fast) return null; const m = new T.Mesh(new T.IcosahedronGeometry(rad, 0), ps1(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op }))); m.position.copy(pos); scene.add(m); const o = { m, vel, life, age: 0, op }; fxs.push(o); return o; };
  (function loop(now) {
    if (!alive || g0 !== gen) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (let k = fxs.length - 1; k >= 0; k--) { const o = fxs[k]; o.age += dt; o.m.position.addScaledVector(o.vel, dt); o.m.rotation.y += dt; o.m.scale.setScalar(1 + o.age * 0.9); o.m.material.opacity = Math.max(0, o.op * (1 - o.age / o.life)); if (o.age >= o.life) { scene.remove(o.m); fxs.splice(k, 1); } }
    requestAnimationFrame(loop);
  })(last);
  const swing = (t, amp) => legs.forEach((lg, i) => (lg.rotation.z = Math.sin(t * 38 + (i % 2) * Math.PI) * amp));
  // 1) il cane arriva di corsa accanto al giocatore
  await tween(2300, (t) => { dog.position.lerpVectors(start, spot, t); dog.position.y = LAND_H + Math.abs(Math.sin(t * 40)) * 0.35; swing(t, 0.7); focus.set((s0.x + dog.position.x) / 2, LAND_H, (s0.z + dog.position.z) / 2); });
  swing(0, 0); dog.position.y = LAND_H;
  const rot0 = dog.rotation.y; let dr = heading - rot0; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  await tween(500, (t) => (dog.rotation.y = rot0 + dr * t));                    // si gira lungo la strada
  // 2) si accovaccia con la coda alzata; la camera passa dietro di lui
  const wp = V(0, 0, 0);
  await tween(1100, (t) => {
    body.position.y = -0.7 * t; legs[2].rotation.z = legs[3].rotation.z = -0.55 * t; tail.rotation.z = 0.3 + 0.9 * t;
    anchor.getWorldPosition(wp); focus.lerp(V(wp.x, LAND_H - 0.4, wp.z), Math.min(1, t * 1.2)); cam.goalDist = 28 - 19 * t; cam.pitch = 0.5 - 0.28 * t; cam.yaw = yaw0 + 0.8 - 0.35 * t;
  });
  // 3) la caga: si vede benissimo
  anchor.getWorldPosition(wp); const pooPos = V(wp.x, LAND_H, wp.z), poo = new T.Group(), pm = LM({ color: 0x4a2a12 }), segs = [];
  [[0.95, 0.3], [0.78, 0.75], [0.58, 1.1], [0.36, 1.4]].forEach(([r, y]) => { const sgm = new T.Mesh(new T.SphereGeometry(r, 7, 5), pm); sgm.scale.set(1, 0.65, 1); sgm.position.y = y; sgm.visible = false; poo.add(sgm); segs.push(sgm); });
  poo.position.copy(pooPos); scene.add(poo); let nextSteam = 0;
  await tween(3200, (t) => {
    body.position.x = Math.sin(t * 70) * 0.05 * (1 - t * 0.4); tail.rotation.z = 1.2 + Math.sin(t * 30) * 0.08;
    segs.forEach((sgm, i) => { const k = Math.max(0, Math.min(1, t * 4.5 - i * 0.9)); sgm.visible = k > 0; sgm.scale.set(k, 0.65 * k, k); });
    if (t * 3200 > nextSteam) { nextSteam += 110; puff(V(pooPos.x + (Math.random() - 0.5), LAND_H + 1.2, pooPos.z + (Math.random() - 0.5)), 0x93b52a, 0.35, V((Math.random() - 0.5) * 0.8, 2.2, (Math.random() - 0.5) * 0.8), 1.8, 0.45); }
  });
  Sfx.splat(); body.position.x = 0;
  // 4) la puzza parte in entrambe le direzioni (4 caselle avanti e 4 indietro)
  const lane = (dir) => { const pts = [V(s0.x, LAND_H + 2, s0.z)]; for (let k = 1; k <= 10; k++) { const q = SQ[Math.max(1, Math.min(FINISH, caster.pos + dir * k))]; pts.push(V(q.x, LAND_H + 2, q.z)); } return pts; };
  const at = (pts, f) => { const x = Math.max(0, Math.min(1, f)) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)); return pts[i].clone().lerp(pts[i + 1], x - i); };
  const lanes = [lane(1), lane(-1)], clouds = [];
  if (!Q.fast) lanes.forEach((pts) => { for (let k = 0; k < 9; k++) { const m = new T.Mesh(new T.IcosahedronGeometry(2.2, 0), ps1(new T.MeshBasicMaterial({ color: k % 2 ? 0x8fb52a : 0x6f9a1c, transparent: true, opacity: 0.5 }))); scene.add(m); clouds.push({ m, pts, delay: k * 0.07, jx: (Math.random() - 0.5) * 3.5, jz: (Math.random() - 0.5) * 3.5, ph: Math.random() * 6 }); } });
  flashRange(caster.pos, 10, 0x2f4d00); toast("💨💩 PUZZA DI MERDA!");
  const cf = V(s0.x, LAND_H, s0.z);
  await tween(3600, (t) => {
    focus.lerp(cf, 0.06); cam.goalDist = 9 + 36 * Math.min(1, t * 1.6); cam.pitch = 0.22 + 0.4 * Math.min(1, t * 1.6); cam.yaw = yaw0 + 0.45;
    clouds.forEach((c) => { const f = (t - c.delay) / 0.85, p = at(c.pts, f); c.m.position.set(p.x + c.jx, p.y + Math.sin(t * 9 + c.ph) * 0.8, p.z + c.jz); c.m.rotation.y = t * 3 + c.ph; const sc = 0.5 + Math.min(1, Math.max(0, f)) * 1.3; c.m.scale.setScalar(sc); c.m.material.opacity = f < 0 ? 0 : 0.5; });
  });
  // 5) chi è nel raggio muore (il lanciatore no)
  const victims = players.filter((q) => q !== caster && !q.finished && q.pos <= FINISH && Math.abs(q.pos - caster.pos) <= 10).sort((a, b) => Math.abs(a.pos - caster.pos) - Math.abs(b.pos - caster.pos));
  log(`💩 ${caster.name} scatena ZARA: ${victims.length ? victims.map((v) => v.name).join(", ") + " nel raggio di 10 caselle!" : "nessuno nel raggio di 10 caselle."}`);
  if (!victims.length) { toast("😮‍💨 Nessuno nel raggio... che spreco."); await gsleep(900); }
  for (const v of victims) {
    if (g0 !== gen) return;
    cam.focus = v.obj.position; cam.goalDist = 18; cam.pitch = 0.4; tintPawn(v, 0x7ea21c); toast(`🤢 ${v.name} respira la merda!`); await gsleep(900);
    if (await askCounter(v)) { tintPawn(v, null); await fxShield(v); continue; }
    await kill(v); tintPawn(v, null);
  }
  // 6) la puzza si dirada e il cane se ne va
  cam.focus = focus; focus.copy(cf); cam.goalDist = 36; cam.pitch = 0.5;
  const dog0 = dog.position.clone();
  await tween(1400, (t) => { clouds.forEach((c) => { c.m.material.opacity = 0.5 * (1 - t); c.m.scale.multiplyScalar(1 + 0.01); }); dog.position.copy(dog0).addScaledVector(V(sx, 0, sz), 36 * t); dog.position.y = LAND_H + Math.abs(Math.sin(t * 40)) * 0.35; body.position.y = -0.7 * (1 - t); tail.rotation.z = 0.3; swing(t, 0.7); poo.scale.setScalar(1 - t * 0.2); });
  alive = false; clouds.forEach((c) => scene.remove(c.m)); fxs.forEach((o) => scene.remove(o.m)); scene.remove(poo); if (dog) scene.remove(dog); dog = null;
  cam.focus = null; cam.goalDist = FOLLOW_DIST; cam.pitch = FOLLOW_PITCH; lastInput = -1e9;
  { const rest = ZARA_MS - (performance.now() - tZ); if (rest > 0 && !Q.fast) await gsleep(rest); }   // si prosegue allo scadere della durata fissa (audio incluso), uguale su ogni dispositivo
  Music.duck(0.55);
}
async function playCard(p, a, target) {
  await syncStart(900);
  log(`🃏 ${p.name} gioca ${a.nome}${a.bersaglio === "giocatore" ? " su " + target.name : ""}`);
  switch (a.id) {
    case "zara": return zara(p);
    case "maestrale": { toast(`🌪️ ${a.nome}!`); const b = await askCounter(target); await fxCard("maestrale", p, target, b); if (!b) await damage(target, 1, a.nome); return; }
    case "tonno": { toast(`🐟 ${a.nome}!`); const b = await askCounter(target); await fxCard("tonno", p, target, b); if (!b) await damage(target, 1, a.nome); return; }
    case "furto": { toast(`🕶️ ${a.nome}!`); const b = await askCounter(target); await fxCard("furto", p, target, b); if (!b) { const n = Math.min(4, target.money, MAX_MONEY - p.money); target.money -= n; p.money += n; Sfx.coin(); log(`🕶️ ${p.name} ruba ${n}€ a ${target.name}`); toast(`🕶️ Rubati ${n}€!`); } return; }
    case "frana": { toast(`🪨 ${a.nome}!`); const b = await askCounter(target); await fxCard("frana", p, target, b); if (!b) { target.skip += 1; toast(`🪨 ${target.name} salta un turno!`); } return; }
    case "cassola": await fxCard("cassola", p, p, false); heal(p, 1); toast("🍲 +1 ❤️"); return;
    case "margherita": case "panozzo": await fxCard("cassola", p, p, false); heal(p, 1); log(`${a.emoji} ${p.name} mangia: +1 ❤️.`); toast(`${a.emoji} +1 ❤️`); return;
    case "birra": p.beer = 1; Sfx.coin(); log(`🍺 ${p.name} si beve una birra di Rubiu: dado magico al prossimo tiro.`); toast("🍺 Dado magico al prossimo tiro: +5 o −5!"); await gsleep(Q.fast ? 0 : 1200); return;
    case "bici": p.bike = 3; Sfx.chime(); log(`🚲 ${p.name} sale sulla bici di merda: +2 ai prossimi 3 tiri.`); toast("🚲 Bici di merda: +2 ai prossimi 3 tiri!"); await gsleep(Q.fast ? 0 : 1200); return;
    case "vento": p.wind = 1; Sfx.whoosh ? Sfx.whoosh() : Sfx.chime(); log(`🌬️ ${p.name} ha il maestrale in poppa: al prossimo tiro il dado vale doppio.`); toast("🌬️ Maestrale in poppa: prossimo tiro doppio!"); await gsleep(Q.fast ? 0 : 1200); return;
    case "patatine": p.chips = 2; Sfx.coin(); log(`🍟 ${p.name} mangia le patatine: +2 ai prossimi 2 tiri.`); toast("🍟 +2 ai prossimi 2 tiri!"); await gsleep(Q.fast ? 0 : 1200); return;
    case "medikit": await fxCard("cassola", p, p, false); heal(p, START_HP); log(`🩹 ${p.name} usa il medikit: cuori al massimo.`); toast("🩹 Cuori al massimo!"); return;
    case "coca": { p.coke = 2; Sfx.whoosh(); log(`❄️ ${p.name} tira una sniffata: per 2 tiri il dado fa almeno 6.`); toast("❄️ Vedi tutto più colorato… dado minimo 6 per 2 tiri!"); await gsleep(Q.fast ? 0 : 1500); return; }
    case "moro": {
      const t = players.filter((q) => q !== p && !q.finished && q.pos <= FINISH).sort((x, y) => y.pos - x.pos)[0];
      if (!t || t.pos <= p.pos) { toast("🚗 Nessuno è più avanti di te: la Renault 4 torna in garage."); log(`🚗 ${p.name} usa Aldo Moro V2 ma nessuno è più avanti.`); return; }
      toast(`🚗 Aldo Moro V2: ${p.name} rapisce ${t.name}!`); const b = await askCounter(t); if (b) { await fxShield(t); return; }
      await r4Swap(p, t);
      [p.pos, t.pos] = [t.pos, p.pos]; [p.dir, t.dir] = [t.dir, p.dir]; [p.back, t.back] = [t.back, p.back]; p.zone = SQ[p.pos].zone; t.zone = SQ[t.pos].zone;
      placePawns(); redraw(); log(`🚗 ${p.name} e ${t.name} si scambiano di posto (Renault 4).`); return;
    }
    case "sicario": { toast(`🔪 Sicario su ${target.name}!`); const b = await askCounter(target); if (b) { await fxShield(target); return; } await sicarioAnim(target); await kill(target); return; }
    case "mafia": { toast(`👊 Mafia sotto casa di ${target.name}!`); const b = await askCounter(target); if (b) { await fxShield(target); return; } target.dmax = 2; Sfx.slap(); log(`👊 ${target.name}: per 2 turni il dado non farà più di 4.`); toast(`👊 ${target.name}: dado massimo 4 per 2 turni`); return; }
    case "muro": { walls = walls.filter((w) => w.pos !== p.pos); walls.push({ pos: p.pos, owner: players.indexOf(p), left: 3 }); Sfx.rumble(); log(`🧱 ${p.name} costruisce un muro sulla casella ${p.pos}.`); toast("🧱 Muro costruito!"); await gsleep(Q.fast ? 0 : 1200); return; }
    case "vespa": await fxCard("vespa", p, p, false); p.bonusMove = (p.bonusMove || 0) + 4; toast("🛵 +4 al prossimo tiro!"); return;
  }
}
function giveAction(p, a) {
  if (a.tipo === "Passiva") { if (a.id === "pistola") { if (p.gun) return false; p.gun = true; return true; } if (a.id === "pizzo") { if (p.pizzo) return false; p.pizzo = true; return true; } if (a.id === "ragno") { if (p.spider) return false; p.spider = true; return true; } return false; }
  if (a.tipo === "Servizio") return true;
  if (a.tipo === "Contro") { if (p.counter) return false; p.counter = a.id; return true; }
  if (p.hold.length >= MAX_HOLD) return false; p.hold.push(a.id); return true;
}
const canTake = (p, a) => a.tipo === "Servizio" ? true : a.tipo === "Passiva" ? !(a.id === "pistola" ? p.gun : a.id === "ragno" ? p.spider : p.pizzo) : a.tipo === "Contro" ? !p.counter : p.hold.length < MAX_HOLD;
const shopStock = (where) => AZ.filter((a) => (a.dove || "") === (where || "")).map((a) => ({ id: a.id, a, n: 1, prezzo: a.prezzo, nome: a.nome, emoji: a.emoji, testo: a.testo }));
const offer = (id, prezzo) => { const a = azById(id); return { id: id + prezzo, a, n: 1, prezzo, nome: a.nome, emoji: a.emoji, testo: a.testo }; };
function tonnoOffers() { const a = azById("tonno"); return [{ id: "tonno1", a, n: 1, prezzo: 5, nome: "1 carta Tonno", emoji: "🐟", testo: a.testo }, { id: "tonno2", a, n: 2, prezzo: 8, nome: "2 carte Tonno", emoji: "🐟🐟", testo: "Offerta eccezionale: due tonni a 8€." }]; }
const offerOk = (p, o) => o.n === 1 ? canTake(p, o.a) : p.hold.length + o.n <= MAX_HOLD;
function buyOffer(p, o) { if (p.money < o.prezzo || !offerOk(p, o)) return false; for (let k = 0; k < o.n; k++) giveAction(p, o.a); p.money -= o.prezzo; return true; }
async function shop(p, stock = shopStock(""), title = "🏪 Negozio", ms = 20000) {   // negozio generico (anche Narcao, Tonnara, Bacu Abis): 20 secondi per comprare
  if (p.cpu) {
    for (let i = 0; i < 2; i++) {
      const aff = stock.filter((o) => o.prezzo <= p.money && offerOk(p, o)); if (!aff.length || sr() < 0.25) break;
      const o = (p.hp < START_HP && aff.find((x) => x.id === "medikit")) || (!p.counter && aff.find((x) => x.a.tipo === "Contro")) || pickOne(aff);
      if (buyOffer(p, o)) { log(`🏪 ${p.name} compra una carta`); toast(`🏪 ${p.name} compra una carta`); Sfx.coin(); redraw(); if (o.act) await o.act(p); await gsleep(1300); }
    }
    return;
  }
  const pi = players.indexOf(p), deadline = Date.now() + ms;
  for (;;) {
    const w = ask(pi, "choice", { k: "choice", v: "exit" });
    let a0;
    if (mine(p)) {
      const rem = Math.max(300, deadline - Date.now()), bar = `<div class="tbar"><i style="animation-duration:${rem}ms"></i></div>`;
      const rows = stock.map((o) => { const full = !offerOk(p, o); return `<div class="shopitem"><b style="font-size:1.5rem">${o.emoji}</b><span><b>${o.nome}</b><br><small>${o.testo}</small></span><button data-v="${o.id}" ${p.money < o.prezzo || full ? "disabled" : ""}>${o.prezzo}€${full ? " (pieno)" : ""}</button></div>`; }).join("");
      const iv = setInterval(() => { const el = $("#shopSec"); if (el) el.textContent = "⏱ " + Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) + "s"; }, 250);
      a0 = await ownerPrompt(w, "choice", `${bar}<h2>${title} – hai ${p.money}€ <small id="shopSec" style="float:right;color:#ffb02e">⏱ ${Math.ceil(rem / 1000)}s</small></h2>${rows}<p style="text-align:center"><button class="primary" data-v="exit">Esci</button></p>${bar}`, "", rem, (v) => (v === undefined || v === "auto" ? "exit" : v));
      clearInterval(iv);
    } else { toast(`🏪 ${p.name} sta comprando…`); a0 = await w; }
    const v = a0.v;
    if (v === "exit" || v === undefined) return;
    const o = stock.find((x) => x.id === v);
    if (o && buyOffer(p, o)) { log(`🏪 ${p.name} compra una carta`); toast(mine(p) ? `🏪 Hai comprato ${o.emoji} ${o.nome}` : `🏪 ${p.name} compra una carta`); Sfx.coin(); redraw(); if (o.act) { await o.act(p); return; } }
  }
}
async function cpuPlan(p) {
  for (let i = 0; i < 1 && p.hold.length; i++) {   // come gli umani: una sola carta per turno
    const rivals = players.filter((q) => q !== p && !q.finished), leader = [...rivals].sort((a, b) => b.pos - a.pos)[0], has = (id) => p.hold.includes(id);
    let a = null, target = leader;
    if (p.hp < START_HP && has("medikit")) { a = "medikit"; target = p; }
    else if (p.hp < START_HP && has("cassola")) { a = "cassola"; target = p; }
    else if (p.hp < START_HP && (has("margherita") || has("panozzo"))) { a = has("margherita") ? "margherita" : "panozzo"; target = p; }
    else if (has("zara")) { const t = rivals.find((q) => q.pos <= FINISH && Math.abs(q.pos - p.pos) <= 10); if (t && sr() < 0.85) { a = "zara"; target = p; } }
    if (!a && has("moro") && leader && leader.pos > p.pos && sr() < 0.8) { a = "moro"; target = leader; }
    if (!a && has("coca") && !p.coke) { a = "coca"; target = p; }
    if (!a && has("bici") && !p.bike) { a = "bici"; target = p; }
    if (!a && has("vento") && !p.wind && sr() < 0.7) { a = "vento"; target = p; }
    if (!a && has("patatine") && !p.chips) { a = "patatine"; target = p; }
    if (!a && has("birra") && !p.beer && sr() < 0.6) { a = "birra"; target = p; }
    if (!a && has("muro") && rivals.some((q) => q.pos < p.pos && p.pos - q.pos <= 8)) { a = "muro"; target = p; }
    if (!a && has("vespa")) { a = "vespa"; target = p; }
    if (!a && sr() < 0.55) a = ["sicario", "mafia", "maestrale", "tonno", "furto", "frana"].find(has);
    if (!a) break;
    p.hold.splice(p.hold.indexOf(a), 1); redraw(); await gsleep(700);
    await playCard(p, azById(a), target); await gsleep(500);
  }
}

/* ================= Flusso di gioco ================= */
function beginGame(cfg) {
  difficulty = cfg.diff || "normale"; gen++; turnSeq = 0; barrier = null; walls = []; firstDeath = false; angCool = 0; Music.hold(false); fxClear(); seedRng(cfg.seed); mode = MODES[cfg.mode] || MODES.normale; gameSeen = new Set(); pending = null; actionQ.length = 0; modalDone = null;
  players.forEach((p) => scene.remove(p.obj));
  players = cfg.players.map((p, i) => ({ name: p.name, cpu: p.cpu, owner: p.owner, color: COLORS[i], pos: 1, skip: 0, got: [], hold: [], counter: null, gun: false, pizzo: false, coke: 0, dmax: 0, beer: 0, chips: 0, spider: false, negroni: 0, wind: 0, sameStreak: 0, simoneDone: 0, bike: 0, hp: START_HP, money: START_MONEY, zone: SQ[1].zone, bonusMove: 0, dir: 1, back: false, carl: null, lastRoll: 0, finished: 0, pawn: PAWNS.find((w) => w.id === p.pawn) || PAWNS[0], obj: makePawn(p.pawn, COLORS[i]) }));
  players.forEach((p) => scene.add(p.obj));
  cur = 0; inGame = true; placePawns(); cam.target.copy(players[0].obj.position); cam.focus = null; cam.dist = FOLLOW_DIST * 1.8;
  $("#setup").hidden = true; $("#modal").hidden = true; $("#game").hidden = false; $("#log").innerHTML = ""; $("#side").classList.remove("open");
  cam.mode = "follow"; cam.goalDist = FOLLOW_DIST; cam.pitch = FOLLOW_PITCH; lastInput = -1e9; cam.yaw = 0; $("#btnLeave").hidden = false; clearDice();
  log(`Partita ${mode.nome}: da Maladroxia a Gonnesa!`); zoneBanner(zoneOf(1));
  Music.start(); clearInterval(snapIv); snapIv = setInterval(pushSnap, 1000); lastSnap = "";
  turnNo = 0; admN = -1; initState = exportState();
  if (Net.online) ask(-1, "wait", null); else turnStart();   // online il turno lo decide il server
}
function showIdlePrompt() {
  idleOpen = true;
  modal(`<h2>⏰ Sei ancora lì?</h2><p class="help">Hai fatto tirare il dado in automatico per 3 turni di fila.<br><b>Tira i dadi</b>, altrimenti rischi di essere disconnesso.</p><div class="pick"><button class="primary" data-v="roll">🎲 Tira i dadi</button></div>`, "").then((v) => { idleOpen = false; if (v === "roll" && canAct()) submit("roll"); });
}
function closeIdlePrompt() { if (idleOpen) { idleOpen = false; closeModal(); } }
function watchdogSkip() {   // il server ha visto troppo tempo senza eventi: il turno è bloccato, si passa al prossimo
  if (!inGame || !players.length) return;
  log("⚠️ Turno bloccato: si passa al giocatore dopo."); if (!Q.fast) toast("⏭️ Turno bloccato: si passa al prossimo");
  gen++; Music.hold(false); fxClear(); showSteps(0); clearDice(); if (dog) { scene.remove(dog); dog = null; }
  stopTimer(); pending = null; modalDone = null; $("#modal").hidden = true; $("#zoneBanner").hidden = true; closeIdlePrompt && (idleOpen = false);   // la coda NON si svuota: gli eventi successivi restano validi
  cam.focus = null; cam.shake = 0; cam.goalDist = FOLLOW_DIST; cam.pitch = FOLLOW_PITCH; lastInput = -1e9;
  players.forEach((q) => { q.animating = false; q.obj.visible = true; q.obj.scale.setScalar(0.95); q.obj.rotation.set(0, q.obj.rotation.y, 0); }); placePawns();
  let k = 0; do { cur = (cur + 1) % players.length; } while (players[cur].finished && ++k < players.length);
  turnStart();
}
let turnSeq = 0, barrier = null;
async function syncBarrier() {   // prima di ogni turno aspetta che tutti abbiano finito le animazioni (al massimo 2 secondi)
  const seq = Net.online ? turnNo : ++turnSeq;
  if (Q.fast || !Net.online || !Net.lobby || players.filter((q) => !q.cpu && q.owner).length < 2) return;
  await new Promise((res) => { barrier = { seq, res }; setTimeout(res, 2000); api("/api/ready", { id: Net.lobby.id, seq }); });
  barrier = null;
}
async function turnStart() {
  if (!inGame) return; const g = gen, p = players[cur]; p.justDied = false; redraw();
  await syncBarrier(); if (g !== gen || !inGame) return;
  { const pi = players.indexOf(p), before = walls.length; walls.forEach((w) => { if (w.owner === pi) w.left--; }); walls = walls.filter((w) => w.left > 0); if (walls.length < before) { log(`🧱 Il muro di ${p.name} crolla da solo.`); toast("🧱 Un muro crolla"); } }
  if (p.pizzo && !p.finished) {
    if (p.money >= 2) { p.money -= 2; log(`💼 ${p.name} paga il pizzo (2€).`); }
    else { p.money = 0; p.pizzo = false; log(`💼 ${p.name} non può più pagare il pizzo: il mafioso se ne va.`); toast(`💼 ${p.name}: niente più pizzo`); }
    redraw();
  }
  if (p.skip <= 1 && p.obj.userData.web) { scene.remove(p.obj.userData.web); p.obj.userData.web = null; }
  if (p.skip > 0) { p.skip--; log(`${p.name} salta il turno.`); toast(`⏸ ${p.name} salta il turno`); await gsleep(1100); return nextTurn(0); }
  if (p.cpu) { await gsleep(800); await cpuPlan(p); if (g !== gen) return; if (p.justDied) return nextTurn(); await doRoll(p); return; }
  let auto = false;
  for (;;) {
    startTimer(); if ((p.autoCount || 0) >= 3 && mine(p) && !Q.fast && $("#modal").hidden) showIdlePrompt();
    const a = await ask(cur, "turn", { k: "roll" }); stopTimer(); closeIdlePrompt();
    if (g !== gen) return;
    if (p.cpu) { await cpuPlan(p); break; }
    if (a.k !== "card") { auto = a.v === "auto"; break; }
    const pl = azById(p.hold[a.v.i]); if (!pl) continue;
    p.hold.splice(a.v.i, 1); await playCard(p, pl, players[a.v.t] || p);
    if (g !== gen) return;
    if (p.justDied) return nextTurn();             // effetto bloccante (es. sei morto): il turno finisce
    break;                                         // dopo aver usato una carta il dado si tira in automatico
  }
  p.autoCount = auto ? (p.autoCount || 0) + 1 : 0;
  if (auto && p.autoCount >= 4) await voteExpel(p);
  if (g === gen) await doRoll(p);
}
async function voteExpel(p) {   // al 4° tiro automatico di fila gli altri umani votano: se sono tutti d'accordo, via
  const voters = players.filter((q) => q !== p && !q.cpu);
  log(`⚠️ ${p.name} è inattivo da 4 turni: si vota l'espulsione.`); toast(`⚠️ ${p.name} è inattivo: voto di espulsione`);
  for (const q of voters) {
    const qi = players.indexOf(q), w = ask(qi, "choice", { k: "choice", v: "n" }); let a;
    if (mine(q)) a = await ownerPrompt(w, "choice", `<h2>⚠️ ${esc(p.name)} è inattivo</h2><p class="help">Non gioca da 4 turni di fila. Vuoi espellerlo dalla partita?<br><small>Serve il voto di tutti.</small></p><div class="pick"><button class="primary" data-v="y">✔ Sì, espelli</button><button data-v="n">No, aspettiamolo</button></div>`, "", 30000, (v) => (v === "y" ? "y" : "n"));
    else { toast(`🗳️ ${q.name} sta votando...`); a = await w; }
    if (a.v !== "y") { log(`🗳️ Espulsione di ${p.name} respinta.`); toast("🗳️ Espulsione respinta"); return false; }
  }
  p.cpu = true; p.autoCount = 0; log(`🚪 ${p.name} è stato espulso per inattività.`); toast(`🚪 ${p.name} espulso`);
  if (Net.online) {
    if (mine(p)) leaveToMenu("Sei stato espulso per inattività.");
    else { const kicker = players.find((q) => !q.cpu && q.owner); if (kicker && kicker.owner === Net.cid) api("/api/kick", { id: Net.lobby.id, pi: players.indexOf(p) }); }
  }
  return true;
}
async function nextTurn(ms = 2000) {   // resta a guardare chi ha finito per 2 secondi, poi la camera passa al prossimo
  if (!inGame) return; const g = gen; const p = players[cur];
  if (p && p.extraRoll) {                // "grazia" dopo due tiri bassi di fila: si tira di nuovo
    p.extraRoll = false; p.lowStreak = 0;
    log(`🙏 ${p.name} è uno sfigato di merda: meno di 2 per 2 volte di fila, tira ancora per pietà`);
    await syncModal(p, `<h2>🙏 Pietà</h2><p class="help" style="font-size:1.15em"><b>${esc(p.name)} è uno sfigato di merda.</b><br>Ha fatto meno di 2 per 2 volte di fila,<br>quindi tirerà ancora per pietà.</p>`, "🎲 Tira di nuovo", 4200);
    if (g !== gen || !inGame) return; await doRoll(p); return;
  }
  await gsleep(ms); if (g !== gen || !inGame) return;
  let k = 0; do { cur = (cur + 1) % players.length; } while (players[cur].finished && ++k < players.length);   // salta chi è già arrivato
  if (Net.online) {   // il turno successivo lo decide il server: il primo stato che arriva diventa quello ufficiale per tutti
    api("/api/endturn", { id: Net.lobby.id, tn: turnNo, cur, state: exportState() });
    await ask(-1, "wait", null); return;
  }
  turnStart();
}
const showSteps = (n) => { const el = $("#stepsLeft"); if (Q.fast || n <= 0) { el.hidden = true; return; } el.innerHTML = `${n}<small>${n === 1 ? "passo" : "passi"}</small>`; el.hidden = false; };
const addMoney = (p, n) => { const had = p.money; p.money = Math.max(0, Math.min(MAX_MONEY, p.money + n)); return p.money - had; };
const inExile = (p) => p.back && p.pos > WIN1;   // oltre Gonnesa, sulla strada per Cagliari
async function foulSame(p, n) {   // stesso numero 3 volte di fila: fallo, resti fermo
  const g = gen; p.lastRoll = 0; p.sameStreak = 0;
  log(`🚫 FALLO! ${p.name} ha fatto 3 volte di fila lo stesso numero (${n}): è un pillone e non si muove.`); Sfx.horn(); toast("🚫 FALLO! Sei un pillone!");
  await syncModal(p, `<h2>🚫 FALLO!</h2><p class="help">Hai fatto <b>3 volte di fila lo stesso numero</b>: ${n}.<br><b>Sei un pillone…</b><br>Resti fermo: <b>non ti muovi</b>!</p>`, "Sono un pillone", 3200);
  if (g !== gen) return; redraw(); return nextTurn();
}
async function foulSlow(p, startPos) {
  const g = gen, d = inExile(p) ? p.dir || -1 : 1, to = Math.max(1, Math.min(FINISH, startPos + d));   // si sposta di 1 nella direzione di marcia
  log(`🐌 FALLO! ${p.name} ha fatto più di 20 caselle in un turno: si è spostato solo di 1.`); Sfx.horn(); toast("🐌 FALLO!");
  await syncModal(p, `<h2>🐌 FALLO!</h2><p class="help">Più di 20 caselle in un turno?<br><b>Sei una lumaca, non Husein Bolt: torna nella realtà!</b><br>Ti sei spostato solo di 1.</p>`, "Ok, lumaca", 3600);
  if (g !== gen) return; if (!inExile(p)) p.dir = 1; await hop(p, to, 1500, 24); redraw(); return landed(p, 1);
}
const DICE_MS = 4000;
/* ----- difficoltà dei bot (versione mobile) ----- */
let difficulty = "normale";
const DIFFS = { facile: "😇 Facile", normale: "🙂 Normale", difficile: "😈 Difficile", demon: "👹 Demon" };
function landScore(p, v) {   // quanto conviene a un bot finire "v" caselle più avanti (demon: calcola la mossa precisa)
  const to = p.pos + v;
  if (to >= WIN0 && to <= WIN1) return 10000;                 // si ferma a Gonnesa: minigioco per vincere
  if (to > WIN1) return -5000;                                // la supera: dritto a Cagliari
  const q = SQ[to]; let s = v * 3;
  if (walls.some((w) => w.pos > p.pos && w.pos <= to && w.owner !== players.indexOf(p))) s -= 40;
  if (q.kind === "yellow") s += 8; else if (q.kind === "blue") s += q.rich ? 9 : 6; else if (q.kind === "shop") s += p.money >= 4 ? 7 : 1;
  else if (q.kind === "hosp" || q.kind === "heart") s += p.hp < START_HP ? 12 : 1;
  else if (q.kind === "green") s += ({ simone: p.simoneDone ? 0 : 6, pesca: 7, ponzu: p.money > 3 ? -12 : 3, scuola: -15, mattia: -10, pecore: -6, negroni: 0, narcao: p.money >= 6 ? 6 : -1, giba: p.money >= 6 ? 6 : -1, tonnara: p.money >= 5 ? 5 : 0, bacu: 3, nuxis: p.money >= 6 ? 6 : 0, renzo: 2, rubiu: 3, bocca: p.hp < START_HP ? 10 : 3, carloforte: 2 })[q.event] ?? 0;
  if (q.zone === "true" && to < CARL0) s -= 3; if (q.zone === "mid") s -= p.hp <= 1 ? 8 : 2;   // zone pericolose
  if (players.some((o) => o !== p && o.gun && !o.finished && o.pos > p.pos && o.pos < to)) s -= 60;   // chi ha la pistola ti spara se lo sorpassi
  return s;
}
function botDice(p, r) {
  if (difficulty === "facile") { for (let k = 0; k < r.length; k++) r[k] = Math.ceil((r[k] * 5) / 8); return; }            // 1–5: restano indietro
  if (difficulty === "difficile") { for (let k = 0; k < r.length; k++) r[k] = 4 + Math.ceil(r[k] / 2); return; }           // 5–8: un sacco di numeri alti
  if (difficulty === "demon") {                                                                                              // sceglie il risultato migliore, come un computer
    const n = r.length; let best = n, bs = -1e9;
    for (let v = n; v <= 8 * n; v++) { const sc = landScore(p, v) + (p.lastRoll === v && p.sameStreak >= 2 ? -9999 : 0); if (sc > bs) { bs = sc; best = v; } }
    if (n === 1) r[0] = best; else { r[0] = Math.min(8, best - 1); r[1] = best - r[0]; if (r[0] === r[1] && best < 16) { r[0]--; r[1]++; if (r[1] > 8) { r[0] += 2; r[1] -= 2; } } }
  }
}
async function doRoll(p) {
  if (angCool > 0) angCool--;
  if (sr() < 0.05) { const g0 = gen; await temporale(); if (g0 !== gen) return; }   // ogni tanto: temporale, tutti indietro di 1
  const g = gen, d = $("#d1"), d2 = $("#d2"), startPos = p.pos; let moved = 0, rolls = 0, lastTot = 0;
  for (;;) {
    rolls++;
    const r = Array.from({ length: mode.dice }, () => 1 + rnd(8));
    if (p.cpu && !inExile(p) && !p.carl) botDice(p, r);   /* difficoltà dei bot */ let bonus = rolls === 1 ? p.bonusMove || 0 : 0; if (rolls === 1) p.bonusMove = 0;
    if (rolls === 1 && p.chips > 0) { bonus += 2; p.chips--; }
    if (rolls === 1 && p.beer) { p.beer = 0; const ok = sr() < 0.5; bonus += ok ? 5 : -5; log(ok ? `🍺 ${p.name} ha bevuto il giusto: +5!` : `🍺 ${p.name} ha bevuto troppo: −5!`); toast(ok ? "🍺 Hai bevuto il giusto: +5!" : "🍺 Hai bevuto troppo: −5!"); }
    if (rolls === 1 && p.bike > 0) { bonus += 2; p.bike--; }
    if (rolls === 1 && p.negroni) { p.negroni = 0; const ok = sr() < 0.5; bonus += ok ? 2 : -2; log(ok ? `🍸 Il Negroni sbagliato carica ${p.name}: +2!` : `🍸 ${p.name} è ubriaco col Negroni sbagliato: −2!`); toast(ok ? "🍸 Il Negroni sbagliato ti carica: +2!" : "🍸 Sei ubriaco col Negroni sbagliato: −2!"); }
    if (rolls === 1 && p.coke > 0) { for (let k = 0; k < r.length; k++) r[k] = Math.max(6, r[k]); p.coke--; }
    if (rolls === 1 && p.dmax > 0) { for (let k = 0; k < r.length; k++) r[k] = Math.min(4, r[k]); p.dmax--; }
    if (inExile(p)) for (let k = 0; k < r.length; k++) r[k] = 6 + ((r[k] - 1) % 3);   // verso Cagliari / da Cagliari: il dado fa sempre 6, 7 o 8
    if (p.forceRoll) { const v = p.forceRoll; p.forceRoll = 0; if (mode.dice === 1) r[0] = Math.max(1, Math.min(8, v)); else { const a = Math.max(1, Math.min(8, v - 8)); r[0] = a; r[1] = Math.max(1, Math.min(8, v - a)); } }   // tiro forzato dall'admin
    if (!Q.fast) {
      const tD = performance.now(); Sfx.tick(); await throwDice(p, r); if (g !== gen) return;
      { const left = DICE_MS - (performance.now() - tD); if (left > 0) await gsleep(left); if (g !== gen) return; }   // durata fissa del lancio: la fisica varia da client a client
      const m = diceObjs.reduce((a, o) => a.add(o.mesh.position), new T.Vector3()).multiplyScalar(1 / Math.max(1, diceObjs.length));
      cam.focus = new T.Vector3(m.x, m.y - 2.6, m.z); cam.goalDist = 9; const oldPitch = cam.pitch; cam.pitch = 1.2;   // primo piano sul dado
      d.textContent = r[0]; if (r[1]) d2.textContent = r[1];
      await gsleep(1000); if (g !== gen) return;
      cam.focus = null; cam.pitch = oldPitch; cam.goalDist = FOLLOW_DIST; clearDice();
    }
    d.textContent = r[0]; if (r[1]) d2.textContent = r[1];
    const windNow = rolls === 1 && p.wind; if (windNow) { p.wind = 0; log(`🌬️ Maestrale in poppa: il tiro di ${p.name} vale doppio!`); toast("🌬️ Maestrale in poppa: tiro doppio!"); }
    const base = r.reduce((a, b) => a + b, 0), tot = Math.max(0, base * (windNow ? 2 : 1) + bonus), dbl = mode.dice === 2 && r[0] === r[1];
    log(`${p.name} tira ${r.join("+")}${bonus ? (bonus > 0 ? " +" : " ") + bonus : ""} = ${tot}`);
    if (rolls === 1 && !p.carl) { p.sameStreak = p.lastRoll === base ? (p.sameStreak || 1) + 1 : 1; if (p.sameStreak >= 3) return foulSame(p, base); }   // 3 volte di fila lo stesso numero: fallo
    p.lastRoll = base;
    if (rolls === 1) { if (base <= (mode.dice === 1 ? 2 : 4)) { p.lowStreak = (p.lowStreak || 0) + 1; if (p.lowStreak >= 2) p.extraRoll = true; } else p.lowStreak = 0; }
    await gsleep(300);
    if (p.carl) return carloforteMove(p, tot);                                         // dentro Carloforte: regole a parte
    const stopped = await moveBy(p, tot, false); moved += tot; lastTot = tot;
    if (g !== gen) return;
    if (stopped === "end") return nextTurn();
    if (stopped || !dbl || rolls >= 4) break;
    toast("🎲🎲 Doppio! Tiri di nuovo"); log(`🎲🎲 ${p.name} ha fatto un doppio: tira di nuovo!`); await gsleep(900);
  }
  if (rolls > 1 && moved > 20) return foulSlow(p, startPos);                         // troppo veloce: fallo
  await landed(p, lastTot);
}
async function hospStop(p) {   // passando davanti all'ospedale: fermarsi a curarsi (+1 ❤️) perdendo un turno
  if (p.hp >= START_HP) return false;
  if (p.cpu) return sr() < 0.5;
  const pi = players.indexOf(p), w = ask(pi, "choice", { k: "choice", v: "n" }); let a;
  if (mine(p)) a = await ownerPrompt(w, "choice", `<h2>🏥 Ospedale</h2><p class="help">Stai passando davanti all'ospedale.<br>Se ti fermi <b>guarisci 1 ❤️</b> ma <b>perdi il prossimo turno</b> (e i passi che ti restano).</p><div class="pick"><button class="primary" data-v="y">🏥 Mi fermo</button><button data-v="n">➡️ Vado avanti</button></div>`, "", 30000, (v) => (v === "y" ? "y" : "n"));
  else { toast(`${p.name} passa davanti all'ospedale...`); a = await w; }
  return a.v === "y";
}
async function shopStop(p, left) {   // passando davanti a un negozio: fermarsi a comprare o proseguire
  const cheap = Math.min(...shopStock("").map((o) => o.prezzo));
  if (p.money < cheap) { toast(`🏪 ${p.name} passa davanti al negozio ma ha solo ${p.money}€ (serve almeno ${cheap}€)`); log(`🏪 ${p.name} passa davanti al negozio senza soldi.`); await gsleep(900); return false; }   // lo diciamo, invece di tirare dritto in silenzio
  if (p.cpu) return sr() < 0.6;
  const pi = players.indexOf(p), w = ask(pi, "choice", { k: "choice", v: "n" }); let a;
  if (mine(p)) a = await ownerPrompt(w, "choice", `<h2>🏪 Negozio</h2><p class="help">Stai passando davanti a un negozio.<br><b>Se ti fermi qui non andrai avanti</b>: perdi i ${left} passi che ti restano.<br>Ti fermi a comprare o prosegui?</p><div class="pick"><button class="primary" data-v="y">🏪 Mi fermo</button><button data-v="n">➡️ Vado avanti</button></div>`, "", 30000, (v) => (v === "y" ? "y" : "n"));
  else { toast(`${p.name} passa davanti a un negozio...`); a = await w; }
  return a.v === "y";
}
async function moveBy(p, steps, final = true) {
  const g = gen, pi = players.indexOf(p); let stopped = false, rev = 1;
  for (let i = 0; i < steps; i++) {
    if (g !== gen) return;
    let d = (p.dir || 1) * rev;
    if (d === 1 && p.pos >= FINISH) d = -1;
    if (d === 1 && !p.back && p.pos >= WIN1 && p.pos < FINISH) {         // supera le 3 caselle di Gonnesa: dritto a Cagliari
      showSteps(0); await toCagliari(p, "overshoot"); if (g !== gen) return; if (final) nextTurn(); return "end";
    }
    if (d === -1 && p.pos <= 1) d = 1;
    const wi = walls.findIndex((w) => w.pos === p.pos + d && w.owner !== pi);
    if (wi >= 0) {                                                       // muro di Bacu Abis: rimbalzi indietro e il muro si rompe
      walls.splice(wi, 1); Sfx.slap(); cam.shake = 0.6; toast(`🧱 ${p.name} sbatte contro il muro e rimbalza!`); log(`🧱 ${p.name} rimbalza contro il muro, che si rompe.`);
      await gsleep(500); cam.shake = 0; if (g !== gen) return; rev = -rev; d = -d; if (p.pos + d < 1) d = 1;
    }
    showSteps(steps - i); if (rev === 1) p.dir = d; const prev = p.pos; await hop(p, p.pos + d);
    if (p.pos === FINISH) { p.back = true; p.dir = -1; }
    if (SQ[p.pos].zone !== p.zone && p.pos <= FINISH) { p.zone = SQ[p.pos].zone; zoneBanner(zoneOf(p.pos)); log(`${p.name} entra in ${zoneOf(p.pos).nome}`); }   // avviso di zona appena si supera il confine
    if (SQ[p.pos].heart && p.hp < START_HP) { p.hp++; Sfx.heal(); toast(`❤️ ${p.name} +1 cuore`); log(`❤️ ${p.name} passa davanti all'ospedale: +1 cuore.`); redraw(); }
    const shooter = d === 1 && players.find((q) => q !== p && q.gun && !q.finished && q.pos <= FINISH && prev <= q.pos && p.pos > q.pos);
    if (shooter) {                                                       // pistola: chi ti sorpassa viene sparato
      shooter.gun = false; showSteps(0); await shootAnim(shooter, p); if (g !== gen) return;
      if (await askCounter(p)) await fxShield(p);
      else { await kill(p); log(`🔫 ${shooter.name} spara a ${p.name} che lo stava sorpassando.`); if (final) nextTurn(); return "end"; }
    }
    if (i < steps - 1 && SQ[p.pos].kind === "hosp" && (await hospStop(p))) {
      p.hp = Math.min(START_HP, p.hp + 1); p.skip = Math.max(p.skip, 1); Sfx.heal(); showSteps(0); log(`🏥 ${p.name} si ferma all'ospedale: +1 ❤️, salta il prossimo turno.`); toast(`🏥 ${p.name}: +1 ❤️, perde un turno`); redraw();
      await gsleep(900); if (g !== gen) return; if (final) nextTurn(); return "end";
    }
    if (i < steps - 1 && SQ[p.pos].kind === "shop" && (await shopStop(p, steps - 1 - i))) { stopped = true; break; }
    if (i < steps - 1 && d === 1 && SQ[p.pos].event === "mattia") {     // Mattia ti ferma anche se passi soltanto
      showSteps(0); const free = await eventMattia(p); if (g !== gen) return;
      if (!free) { if (final) nextTurn(); return "end"; }
    }
  }
  showSteps(0);
  if (p.back && p.pos < WIN0) { p.back = false; p.dir = 1; }            // tornando da Cagliari hai superato Gonnesa: si riparte in avanti
  if (final) await landed(p, steps);
  return stopped;
}
async function giveFree(p) {   // casella gialla: carta gratis (mai la protezione, che si compra solo nei negozi). La carta la vede solo chi la ottiene.
  const salv = !SQ[p.pos].tonnoOnly && sr() < 0.15, a = SQ[p.pos].tonnoOnly ? azById("tonno") : salv ? azById(pickOne(["santabarbara", "padrino", "ragno"])) : pickOne(AZ.filter((x) => x.tipo !== "Contro" && x.tipo !== "Passiva" && !x.dove)), ok = giveAction(p, a), gain = ok ? 0 : Math.min(6, MAX_MONEY - p.money); if (gain > 0) p.money += gain; if (mine(p)) Sfx.card();   // mano piena: al posto della carta 6€ (senza superare il massimo)
  log(`🎁 ${p.name} ottiene una carta`); redraw();
  await syncModal(p, {
    me: `<h2>🎁 ${esc(p.name)}: carta gratis!</h2><div class="cardshow">${cardHTML(a, { flip: true })}</div><p style="text-align:center">${ok ? "Finisce nella tua mano." : gain > 0 ? `Mano piena: prendi <b>${gain}€</b> al posto della carta.` : "Mano piena e soldi al massimo: la carta va persa."}</p>`,
    others: `<h2>🎁 ${esc(p.name)} ottiene ${ok ? "una carta" : "dei soldi"}</h2>`,
  }, "OK", 2600);
}
async function eventCagata(p, n) {   // Fake Lands: ti cachi addosso e torni indietro di 1 casella
  Sfx.splat(); toast("💩 Ti sei cagato addosso!"); log(`💩 ${p.name} se la fa addosso e torna indietro di 1 casella.`);
  await gsleep(1200); await hop(p, Math.max(1, n - 1)); redraw();
}
function strangerDest(p) {   // Nobody Lives Here Lands: si scappa dal concorrente più vicino dietro di te (nella zona), altrimenti fuori dalla zona
  const z = SQ[p.pos].zone, behind = players.filter((q) => q !== p && !q.finished && q.pos < p.pos && q.pos <= FINISH && SQ[q.pos].zone === z).sort((a, b) => b.pos - a.pos)[0];
  if (behind) return behind.pos;
  let n = p.pos; while (n > 1 && SQ[n - 1].zone === z) n--; return Math.max(n, p.pos - 8);   // nessuno dietro: scappi 8 caselle, ma non oltre l'inizio della zona
}
async function toCagliari(p, why) {   // oltre Gonnesa (o niente senso dello stile): dritto a Cagliari, poi si torna indietro
  const g = gen; log(why === "style" ? `💩 ${p.name} non è un vero gonnesiano: spedito a Cagliari!` : `🏙️ ${p.name} supera Gonnesa: dritto a Cagliari!`);
  await syncModal(p, why === "style" ? `<h2>💩 Non hai senso dello stile</h2><p class="help">Hai scelto una gonna di merda: <b>non sei un vero gonnesiano</b>.<br>Te ne vai a Cagliari!</p>` : `<h2>🏙️ Hai superato Gonnesa, eh?</h2><p class="help">Beh, noi adoriamo Gonnesa.<br>Se te non ci vuoi stare, <b>te ne vai dritto a fanculo a Cagliari</b>!<br>Poi da lì devi tornare indietro.</p>`, "Mannaggia…", 3800);
  if (g !== gen) return;
  p.back = true; p.dir = -1; await hop(p, FINISH, 1400, 40); p.zone = SQ[FINISH].zone; redraw(); toast("🏙️ Benvenuto a Cagliari. Non c'è niente.");
}
async function gonnesa(p) { const g = gen, ok = await gonnaGame(p); if (g !== gen) return; if (ok) return win(p); await toCagliari(p, "style"); if (g !== gen) return; return nextTurn(); }
async function greenShop(p, intro, stock, title, ms) { const g = gen, done = await intro(p); if (g !== gen) return; await shop(p, stock, title, ms); if (g !== gen) return; done(); return nextTurn(); }
async function landedGreenNuxis(p) { const g2 = gen, intro = await nuxisIntro(p); if (g2 !== gen) return; const st = shopStock("nuxis"); st.forEach((o) => { if (o.id === "ragnatela") o.act = (pp) => webAll(pp, intro.pr); }); await shop(p, st, "🕷️ Il principe di Nuxis"); if (g2 !== gen) return; intro.done(); return nextTurn(); }
async function landed(p, lastRoll) {
  const g = gen; if (!inGame) return; redraw();
  const n = p.pos, sq = SQ[n];
  if (sq.zone !== p.zone) { p.zone = sq.zone; zoneBanner(zoneOf(n)); log(`${p.name} entra in ${zoneOf(n).nome}`); }
  if (n >= WIN0 && n <= WIN1) return gonnesa(p);              // ti sei fermato a Gonnesa: minigioco della gonna
  if (p.forceEvent) {                                       // evento forzato dall'admin (anche fuori zona)
    const ev = p.forceEvent; p.forceEvent = ""; log(`🛠 Evento forzato: ${ev}`);
    if (ev === "angelica") { await eventAngelica(p); if (g !== gen) return; redraw(); return nextTurn(); }
    if (ev === "cagata") { await eventCagata(p, n); return nextTurn(); }
    if (ev === "giba") return greenShop(p, gibaIntro, shopStock("narcao"), "💊 Spaccio di Giba", 40000);
    if (ev === "mattia") { await eventMattia(p); if (g !== gen) return; return nextTurn(); }
    if (ev === "pecore") { await eventPecore(p); if (g !== gen) return; return nextTurn(); }
    if (ev === "pesca") { await eventPesca(p); if (g !== gen) return; return nextTurn(); }
    if (ev === "negroni") { await eventNegroni(p); if (g !== gen) return; return nextTurn(); }
    if (ev === "simone") return eventSimone(p);
    if (ev === "ponzu") { await eventPonzu(p); if (g !== gen) return; return nextTurn(); }
    if (ev === "vecchio") { await eventVecchio(p); if (g !== gen) return; return nextTurn(); }
    if (ev === "carloforte") { await eventCarloforte(p, n); if (g !== gen) return; return nextTurn(); }
    if (ev === "fallo") return foulSame(p, lastRoll || 5);
    if (ev === "lumaca") return foulSlow(p, Math.max(1, p.pos - 3));
    if (ev === "mcdonald") { await eventMcDonald(p); if (g !== gen) return; { const got = addMoney(p, 3); if (got) { Sfx.coin(); log(`💶 ${p.name} guadagna ${got}€ lavorando al McDonald`); toast(`💶 +${got}€ dal McDonald`); } } redraw();
    await syncModal(p, `<h2>🍟 McDonald</h2><p class="help">La mamma di Giorgia ti ha assunto al McDonald.<br><b>Devi lavorare: salti il prossimo turno, sfigato.</b><br>Però guadagni <b>3€</b> perché hai lavorato.</p>`, "Ok, vado a friggere", 3000);
    if (g !== gen) return; return nextTurn(); }
    if (ev === "sconosciuto") { await eventStranger(p, strangerDest(p)); if (g !== gen) return; return nextTurn(); }
    if (ev === "narcao") return greenShop(p, narcaoIntro, shopStock("narcao"), "💊 Shop di Narcao", 40000);
    if (ev === "tonnara") return greenShop(p, tonnaraIntro, tonnoOffers(), "🐟 Bottega del tonno");
    if (ev === "bacu") return greenShop(p, bacuIntro, shopStock("bacu"), "🧱 Bacu Abis");
    if (ev === "gonna") return gonnesa(p);
    if (ev === "nuxis") return landedGreenNuxis(p);
  }
  // eventi di zona: ogni tiro hai il 20% (Nobody Lives Here: 15%) (chi paga il pizzo viene difeso dal mafioso e va avanti come se niente fosse)
  const spiderSave = async () => { p.spider = false; log(`🕷️ Il ragno protegge ${p.name} dall'evento di zona.`); toast("🕷️ Il ragno ti protegge: non succede niente!"); Sfx.chime(); redraw(); await gsleep(Q.fast ? 0 : 1400); };
  if (sq.zone === "fake" && sr() < 0.2) { if (p.spider) await spiderSave(); else { await eventCagata(p, n); return nextTurn(); } }
  if (sq.zone === "true" && n < CARL0 && angCool <= 0 && sr() < 0.2) {
    if (p.spider) await spiderSave();
    else if (p.pizzo) { angCool = 6; await mafiaSave(p, "angelica"); if (g !== gen) return; }
    else { angCool = 6; await eventAngelica(p); if (g !== gen) return; redraw(); return nextTurn(); }
  }
  if (sq.zone === "mid" && sr() < 0.1) {
    if (p.spider) await spiderSave();
    else if (p.pizzo) { await mafiaSave(p, "hood"); if (g !== gen) return; }
    else if (p.counter) { const c = azById(p.counter); p.counter = null; log(`🛡️ ${p.name} viene salvato da ${c ? c.nome : "uno slot salvezza"}: lo sconosciuto non lo tocca.`); toast(`🛡️ ${c ? c.emoji + " " + c.nome : "Slot salvezza"}: lo sconosciuto non ti tocca!`); await fxShield(p); if (g !== gen) return; redraw(); }
    else { await eventStranger(p, strangerDest(p)); if (g !== gen) return; return nextTurn(); }
  }
  if (sq.zone === "job" && sr() < 0.2) {
    if (p.spider) await spiderSave();
    else if (p.pizzo) { await mafiaSave(p, "mamma"); if (g !== gen) return; }
    else { await eventMcDonald(p); if (g !== gen) return; { const got = addMoney(p, 3); if (got) { Sfx.coin(); log(`💶 ${p.name} guadagna ${got}€ lavorando al McDonald`); toast(`💶 +${got}€ dal McDonald`); } } redraw();
    await syncModal(p, `<h2>🍟 McDonald</h2><p class="help">La mamma di Giorgia ti ha assunto al McDonald.<br><b>Devi lavorare: salti il prossimo turno, sfigato.</b><br>Però guadagni <b>3€</b> perché hai lavorato.</p>`, "Ok, vado a friggere", 3000);
    if (g !== gen) return; }
  }
  if (sq.event === "vecchio") { await eventVecchio(p); if (g !== gen) return; }       // sulla casella di Cussorgia c'è il vecchio che ti parla
  // effetto della casella
  switch (sq.kind) {
    case "blue": { const got = addMoney(p, sq.rich ? 3 : 2); if (got) { Sfx.coin(); toast(`💶 +${got}€`); log(`💶 ${p.name} prende ${got}€`); } else toast("💶 Portafoglio pieno (max 10€)"); redraw(); await gsleep(500); break; }
    case "yellow": await giveFree(p); if (g !== gen) return; break;
    case "heart": toast("🏥 Ingresso dell'ospedale"); await gsleep(500); break;
    case "hosp": heal(p, START_HP); log(`🏥 ${p.name} si cura: cuori al massimo`); toast("🏥 Cuori al massimo!"); redraw(); await gsleep(900); break;
    case "shop": log(`🏪 ${p.name} entra nel negozio`); await shop(p); if (g !== gen) return; break;
    case "green":
      if (sq.event === "pecore") { await eventPecore(p); if (g !== gen) return; return nextTurn(); }
      if (sq.event === "pesca") { await eventPesca(p); if (g !== gen) return; return nextTurn(); }
      if (sq.event === "negroni") { await eventNegroni(p); if (g !== gen) return; return nextTurn(); }
      if (sq.event === "simone") { if (p.simoneDone) { toast("🎸 Il Rockettaro l'hai già incontrato: non c'è più."); break; } p.simoneDone = 1; return eventSimone(p); }
      if (sq.event === "mattia") { await eventMattia(p); if (g !== gen) return; return nextTurn(); }
      if (sq.event === "ponzu") { await eventPonzu(p); if (g !== gen) return; return nextTurn(); }
      if (sq.event === "carloforte") { await eventCarloforte(p, n); if (g !== gen) return; return nextTurn(); }
      if (sq.event === "nuxis") return landedGreenNuxis(p);
      if (sq.event === "scuola") { log(`🏫 ${p.name} deve andare al Liceo Emilio Lussu: salta un turno.`); p.skip = Math.max(p.skip, 1); await syncModal(p, `<h2>🏫 Liceo Emilio Lussu</h2><p class="help">Ti tocca entrare a scuola.<br><b>Salti un turno.</b></p>`, "Che palle", 3000); if (g !== gen) return; break; }
      if (sq.event === "renzo") return greenShop(p, async () => { toast("🍕 Pizzeria Renzo e Rita: la margherita costa cara!"); log(`🍕 ${p.name} entra da Renzo e Rita.`); return () => {}; }, [offer("margherita", 5)], "🍕 Renzo e Rita");
      if (sq.event === "rubiu") return greenShop(p, async () => { toast("🍺 Rubiu burrificio: birra e pizza!"); log(`🍺 ${p.name} entra da Rubiu.`); return () => {}; }, [offer("birra", 6), offer("margherita", 3)], "🧈 Rubiu burrificio");
      if (sq.event === "bocca") { if (p.hp < START_HP) { p.hp++; Sfx.heal(); log(`🥪 Il Boccadillos regala 1 ❤️ a ${p.name}.`); toast("🥪 Il Boccadillos ti regala 1 ❤️"); redraw(); } return greenShop(p, async () => { toast("🥪 Il Boccadillos: panozzo e patatine!"); return () => {}; }, [offer("panozzo", 4), offer("patatine", 4)], "🥪 Il Boccadillos"); }
      if (sq.event === "narcao") return greenShop(p, narcaoIntro, shopStock("narcao"), "💊 Shop di Narcao", 40000);
      if (sq.event === "giba") return greenShop(p, gibaIntro, shopStock("narcao"), "💊 Spaccio di Giba", 40000);
      if (sq.event === "tonnara") return greenShop(p, tonnaraIntro, tonnoOffers(), "🐟 Bottega del tonno");
      if (sq.event === "bacu") return greenShop(p, bacuIntro, shopStock("bacu"), "🧱 Bacu Abis");
      break;
  }
  nextTurn();
}
async function win(p) {   // arrivo a Gonnesa: si prende il posto e gli altri continuano a giocare finché non arrivano tutti
  const g = gen; Sfx.win(); const place = players.filter((q) => q.finished).length + 1; p.finished = place;
  log(`🏆 ${p.name} arriva a Gonnesa: ${place}º posto!`); toast(`🏆 ${p.name}: ${place}º posto a Gonnesa!`);
  const left = players.filter((q) => !q.finished);
  if (left.length > 1) {
    await syncModal(p, `<h2>🏆 ${esc(p.name)} arriva a Gonnesa!</h2><p class="help"><b>${place}º posto.</b><br>Gli altri continuano a giocare per i posti successivi.</p>`, "Che goduria", 3500);
    if (g !== gen) return; redraw(); return nextTurn();
  }
  if (left.length === 1) left[0].finished = players.length;       // l'ultimo rimasto prende l'ultimo posto
  return endGame();
}
async function endGame() {
  const rank = [...players].sort((a, b) => a.finished - b.finished).map((q) => `${q.finished}º ${q.pawn.emoji} ${esc(q.name)}`).join("<br>");
  await modal(`<h2>🏁 Partita finita!</h2><p class="help"><b>Classifica a Gonnesa</b><br>${rank}</p>`, "Torna al menu");
  leaveToMenu();
}

$("#btnCollection").onclick = () => { if ($("#modal").hidden) modal(`<h2>🃏 Collezione (${collection.size}/${cards.length})</h2><div class="grid">${cards.map((c) => collection.has(c.id) ? cardHTML(c) : cardHTML({ ...c, nome: "???", luogo: "", testo: "???", emoji: "❔", immagine: "", sfotto: "" }, { locked: true })).join("")}</div>`, "Chiudi"); };
$("#btnRules").onclick = () => { if ($("#modal").hidden) modal(`<h2>❓ Regole di SulcisOca</h2><div class="help">
  <p>Da <b>Maladroxia</b> a <b>Gonnesa</b> (le 3 caselle ${WIN0}–${WIN1}). Ogni turno puoi giocare una carta della mano (slot in basso), poi si tira il dado.</p>
  <ul><li>🚫 Se fai <b>3 volte di fila lo stesso numero</b> è fallo: sei un pillone e resti fermo.</li><li>❤️ Hai <b>2 cuori</b>: tonno, maestrale e simili ne tolgono 1; Zara ti uccide subito. A 0 vai al primo 🏥 indietro con 1 ❤️ (e perdi il 25% dei soldi). L'ospedale ti riporta a 2 ❤️, la casella prima ti dà 1 ❤️ se ci passi sopra.</li>
  <li>🔵 +2€ · 🎁 carta gratis (vicino a Tonnara solo carte tonno) · 🏪 negozio (anche 🩹 medikit a 4€): passandoci davanti puoi fermarti a comprare.</li>
  <li>🟢 Verdi: ⛵ Carloforte, 🎸 Il Rockettaro, 🍣 Ponzu, 🐟 bottega del tonno (Tonnara), 💊 il boss di Narcao e il suo shop, 🧱 Bacu Abis (muro).</li>
  <li>💩 Fake Lands: 20% di cagarti addosso · 🧹 True Lands: Marilena · 😶 Nobody Lives Here Lands: 10% che qualcuno ti accoltelli alle spalle (−1 ❤️) · 🍟 Job Enslavement Lands: 20% la mamma di Giorgia ti assume al McDonald.</li>
  <li>🐕‍⬛ ZARA uccide chiunque entro 10 caselle avanti o dietro.</li>
  <li>👗 A Gonnesa trovi la gonna bella sotto una delle 3 coppette: se indovini vinci, se no vai a Cagliari. Se superi Gonnesa vai dritto a Cagliari e devi tornare indietro.</li>
  <li>⏱ 30 secondi per tirare, poi il dado parte da solo. ⏩ in alto: voto per saltare un turno bloccato.</li></ul></div>`, "Chiudi"); };

/* ---------- Avvio / rientro dopo reload ---------- */
async function tryRejoin() {
  return;   // versione mobile: niente partite online da riprendere
  const id = localStorage.getItem("sulcis_lobby"); if (!id) return;
  const r = await api("/api/join", { id, name: myName(), rejoin: true });
  if (r.error) {   // dopo >20 s fuori il posto è passato alla CPU: lo riprendo con lo stesso nome
    const t = await api("/api/takeover", { id, name: myName() });
    if (t.error) { localStorage.removeItem("sulcis_lobby"); return; }
  }
  Q.fast = true; Q.live = false; enterRoom(id);
}

Promise.all(["data/cards.json", "data/mappa.json", "data/percorso.json", "data/azioni.json"].map((u) => fetch(u).then((r) => r.json())))
  .then(async ([d, m, p, az]) => { DATA = d; cards = d.carte; MAP = m; PERC = p; AZ = az; saveColl(); renderSetup(); buildSquares(); initScene(); await tryRejoin(); })
  .catch((e) => { document.body.insertAdjacentHTML("beforeend", "<p style='position:fixed;top:70px;left:20px;z-index:20;background:#400;padding:10px'>Errore: " + e + "</p>"); console.error(e); });

/* Se un errore interrompe il flusso di gioco lo mostro a schermo (così si può segnalare) invece di bloccare tutto in silenzio */
addEventListener("unhandledrejection", (e) => { const m = String(e.reason && (e.reason.stack || e.reason.message) || e.reason).split("\n").slice(0, 2).join(" "); console.error(e.reason); if (inGame) { toast("⚠️ Errore nel gioco: " + m.slice(0, 120)); log("⚠️ Errore: " + m); } });
addEventListener("error", (e) => { if (inGame) { toast("⚠️ Errore nel gioco: " + String(e.message).slice(0, 120)); log("⚠️ Errore: " + e.message + " @" + e.filename + ":" + e.lineno); } });
