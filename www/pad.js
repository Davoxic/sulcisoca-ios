/* ===== SulcisOca mobile – supporto controller (Xbox / Bluetooth) =====
   Croce o levetta sinistra: sposta la selezione tra i pulsanti · A: premi · B: indietro / chiudi
   X: tira il dado · Y: ricentra la camera · LB/RB o levetta destra: ruota la camera · LT/RT: zoom
   Menu (Start): regole · Visualizza (Back): giocatori e log
   Su Android i tasti arrivano dall'app nativa (window.Pad.key / Pad.axes); altrove dalla Gamepad API del browser. */
const Pad = (() => {
  let focus = null, native = false, lastMove = 0, held = {}, rs = { x: 0, y: 0 }, trig = { l: 0, r: 0 };
  const SEL = 'button:not([disabled]), select, .sh-cup.pickable, label:has(input[type=radio])';
  const visible = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; let e = el; while (e) { if (e.hidden) return false; const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return false; e = e.parentElement; } return true; };
  function layer() {   // dove si sta giocando adesso: finestra in primo piano, minigioco, menu o partita
    const m = document.getElementById("modal"); if (m && !m.hidden) return m;
    const sh = document.getElementById("shell"); if (sh && !sh.hidden && sh.querySelector(SEL)) return sh;
    const st = document.getElementById("setup"); if (st && !st.hidden && visible(st)) return st;
    return document.body;
  }
  const cands = () => { const L = layer(); return [...L.querySelectorAll(SEL)].filter((e) => visible(e) && !(L === document.body && e.closest("#setup,#modal"))); };
  function setFocus(el) { if (focus) focus.classList.remove("padfocus"); focus = el; if (el) { el.classList.add("padfocus"); el.scrollIntoView({ block: "nearest", inline: "nearest" }); } }
  function preferred(list) { return list.find((e) => e.classList.contains("primary") && e.id !== "btnLeave") || list.find((e) => e.id === "roll") || list[0] || null; }
  function valid() { const c = cands(); if (!focus || !c.includes(focus)) setFocus(preferred(c)); return c; }
  function move(dx, dy) {
    const c = valid(); if (!focus) return;
    const a = focus.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2; let best = null, bs = 1e9;
    for (const e of c) {
      if (e === focus) continue;
      const r = e.getBoundingClientRect(), x = r.left + r.width / 2 - ax, y = r.top + r.height / 2 - ay, along = x * dx + y * dy;
      if (along <= 4) continue;
      const side = Math.abs(x * dy - y * dx), s = along + side * 2.2;
      if (s < bs) { bs = s; best = e; }
    }
    if (best) setFocus(best);
  }
  function activate() {
    valid(); const e = focus; if (!e) return;
    if (e.tagName === "SELECT") { e.selectedIndex = (e.selectedIndex + 1) % e.options.length; e.dispatchEvent(new Event("change", { bubbles: true })); return; }
    if (e.tagName === "LABEL") { const r = e.querySelector("input"); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); } return; }
    e.click();
  }
  function back() {
    const L = layer(), q = (s) => [...L.querySelectorAll(s)].find(visible);
    const b = L.id === "modal" ? q('[data-v="exit"]') || q('[data-v="n"]') || q(".modal-inner > button:last-of-type") : L.id === "setup" ? q("[data-back]") : null;
    if (b) b.click(); else if (document.getElementById("side") && document.body.classList.contains("side")) document.getElementById("btnSide").click();
  }
  const click = (id) => { const e = document.getElementById(id); if (e && visible(e) && !e.disabled) e.click(); };
  const rotate = (d) => { if (typeof cam === "undefined") return; cam.yaw += d; lastInput = performance.now(); };
  const zoom = (k) => { if (typeof cam === "undefined") return; cam.goalDist = Math.max(MIN_DIST, Math.min(MAX_DIST, cam.goalDist * k)); lastInput = performance.now(); };
  function press(b) {
    try { const c = Sfx.ctx(); if (c.state !== "running") c.resume(); } catch (e) {}
    switch (b) {
      case "up": return move(0, -1); case "down": return move(0, 1); case "left": return move(-1, 0); case "right": return move(1, 0);
      case "a": return activate(); case "b": return back();
      case "x": return click("roll"); case "y": return click("btnView");
      case "lb": return rotate(-0.35); case "rb": return rotate(0.35);
      case "lt": return zoom(1.2); case "rt": return zoom(1 / 1.2);
      case "start": return click("btnRules"); case "select": return click("btnSide");
    }
  }
  // levette: la sinistra fa da croce (con ripetizione), la destra ruota la camera
  function stick(x, y) {
    const now = performance.now(), m = Math.max(Math.abs(x), Math.abs(y));
    if (m < 0.55) { lastMove = 0; return; }
    if (lastMove && now - lastMove < 260) return; lastMove = now;
    if (Math.abs(x) > Math.abs(y)) press(x > 0 ? "right" : "left"); else press(y > 0 ? "down" : "up");
  }
  function frame() {
    if (Math.abs(rs.x) > 0.2) rotate(rs.x * 0.035);
    if (Math.abs(rs.y) > 0.3) zoom(1 + rs.y * 0.02);
    if (!native && navigator.getGamepads) {   // browser (iOS, PC): Gamepad API, mappatura standard
      for (const g of navigator.getGamepads()) {
        if (!g) continue;
        const map = { 0: "a", 1: "b", 2: "x", 3: "y", 4: "lb", 5: "rb", 6: "lt", 7: "rt", 8: "select", 9: "start", 12: "up", 13: "down", 14: "left", 15: "right" };
        g.buttons.forEach((bt, i) => { const k = g.index + ":" + i, on = bt.pressed || bt.value > 0.6; if (on && !held[k] && map[i]) press(map[i]); held[k] = on; });
        stick(g.axes[0] || 0, g.axes[1] || 0); rs.x = g.axes[2] || 0; rs.y = g.axes[3] || 0;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(() => { if (focus && !cands().includes(focus)) setFocus(null); }, 400);   // la finestra si è chiusa: niente selezione fantasma
  window.addEventListener("pointerdown", () => setFocus(null));                          // si tocca lo schermo: via la selezione
  const hat = { x: 0, y: 0 };
  return {
    key(name) { native = true; press(name); },   // dall'app Android: tasto premuto
    axes(lx, ly, rx, ry, hx, hy, lt, rt) {        // dall'app Android: levette, croce (hat) e grilletti
      native = true; stick(lx, ly); rs.x = rx; rs.y = ry;
      if (hx !== hat.x) { if (hx) press(hx > 0 ? "right" : "left"); hat.x = hx; }
      if (hy !== hat.y) { if (hy) press(hy > 0 ? "down" : "up"); hat.y = hy; }
      if (lt > 0.6 && trig.l <= 0.6) press("lt"); if (rt > 0.6 && trig.r <= 0.6) press("rt"); trig.l = lt; trig.r = rt;
    },
    press,
  };
})();
window.Pad = Pad;
