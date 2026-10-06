// WakeUp: Lock Screen and Home Screen widget for the E-Gate Planner.
// In Scriptable, create a script named exactly "WakeUp" and paste this in.
// The planner sends your duties with its "Update widget" button.
const KEY = "wakeup.duties", H = 36e5, DAY = 24 * H;
const q = args.queryParameters || {};
// Same colours as the planner, light and dark.
const C = (l, d) => Color.dynamic(new Color(l), new Color(d));
const BG = C("#ffffff", "#171a22"), INK = C("#12141a", "#eef0f4"), MUTE = C("#6b7280", "#8b93a3");
const G = C("#16a34a", "#22c55e"), Y = C("#ca8a04", "#eab308"), R = C("#dc2626", "#ef4444");
// The ring is a drawn image, so it takes fixed colours that read in light and dark.
const RING = new Map([[MUTE, "#8b93a3"], [G, "#22c55e"], [Y, "#eab308"], [R, "#ef4444"]]);

function load() {
  try { return JSON.parse(Keychain.contains(KEY) ? Keychain.get(KEY) : "[]") } catch (e) { return [] }
}
// Next duty whose bus hasn't left yet.
function next(now) {
  return load().filter(d => d.b > now).sort((a, b) => a.b - b.b)[0] || null;
}
// Countdown target, colour and when the colour next changes, as in the planner.
function state(d, now) {
  const wake = now < d.w, t = wake ? d.w : d.b, ms = t - now;
  const steps = wake ? [[DAY, G], [12 * H, Y], [4 * H, R]] : [[30 * 6e4, Y], [15 * 6e4, R]];
  let col = wake ? MUTE : G, change = t;
  for (const [lim, c] of steps) if (ms <= lim) col = c; else change = Math.min(change, t - lim);
  // Ring: remaining share of the last 24h before wake-up, then of wake-up to bus.
  const span = wake ? DAY : Math.max(d.b - d.w, 6e4), left = Math.min(1, Math.max(0, ms / span));
  return { wake, t, col, left, refresh: new Date(change + 1000) };
}
// Points along a rounded rectangle, clockwise from top centre.
function outline(x, y, w, h, r) {
  const pts = [[x + w / 2, y]], arc = (cx, cy, a0) => {
    for (let i = 0; i <= 16; i++) { const a = a0 + i / 16 * Math.PI / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) }
  };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0);
  arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  pts.push([x + w / 2, y]);
  return pts;
}
// Strokes the outline from fraction a to b of the way round.
function stroke(ctx, pts, a, b, color, width) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const from = total * a, to = total * b, p = new Path(), at = (i, k) => new Point(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k);
  let pos = 0, started = false;
  for (let i = 1; i < pts.length && pos < to; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), end = pos + seg;
    if (end > from) {
      if (!started) { p.move(at(i, Math.max(0, (from - pos) / seg))); started = true }
      p.addLine(at(i, Math.min(1, (to - pos) / seg)));
    }
    pos = end;
  }
  ctx.addPath(p); ctx.setStrokeColor(color); ctx.setLineWidth(width); ctx.strokePath();
}
// Progress ring hugging the widget's rounded corners.
function ring(family, st) {
  const S = 3, h = (family === "systemLarge" ? 382 : 170) * S, w = (family === "systemSmall" ? 170 : 364) * S, lw = 5 * S, inset = 3 * S + lw / 2, rad = 22 * S - inset;
  const ctx = new DrawContext();
  ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = false;
  const pts = outline(inset, inset, w - 2 * inset, h - 2 * inset, rad), hex = RING.get(st.col);
  stroke(ctx, pts, 0, 1, new Color("#8b93a3", 0.22), lw);
  // The empty part grows clockwise from the top, so the bar drains clockwise.
  if (st.left > 0) stroke(ctx, pts, 1 - st.left, 1, new Color(hex), lw);
  return ctx.getImage();
}
function text(s, s0, font, color, op) {
  const t = s0.addText(s);
  t.font = font; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
  if (color) t.textColor = color;
  if (op) t.textOpacity = op;
  return t;
}
function timer(s0, st, now, d, size) {
  if (st.t - now > DAY) return text(d.dl, s0, Font.boldSystemFont(size * 0.75), st.col);
  const c = s0.addDate(new Date(st.t));
  c.applyTimerStyle();
  c.font = Font.boldMonospacedSystemFont(size); c.textColor = st.col;
  c.lineLimit = 1; c.minimumScaleFactor = 0.5;
  return c;
}
// Timeline rows: past steps fade, the one being counted down to takes the colour.
function rows(s0, d, st, now, size) {
  const R0 = [["Wake up", d.w, d.ws, st.wake], ["Leave home", d.l, d.ls], ["Bus", d.b, d.bs, !st.wake], ["E-gate", d.e, d.es]];
  R0.filter(r => r[2]).forEach(([k, at, s, hot], i) => {
    if (i) s0.addSpacer(2);
    const r = s0.addStack(); r.centerAlignContent();
    const c = hot ? st.col : null, op = at <= now && !hot ? 0.4 : null;
    text(k, r, hot ? Font.semiboldSystemFont(size) : Font.systemFont(size), c || MUTE, op);
    r.addSpacer();
    text(s, r, Font.semiboldMonospacedSystemFont(size), c || INK, op);
  });
}
function home(family, d, now) {
  const w = new ListWidget();
  w.backgroundColor = BG; w.setPadding(16, 16, 16, 16);
  if (!d) {
    text("WAKE UP", w, Font.boldSystemFont(11), MUTE);
    w.addSpacer();
    text("No e-gates yet", w, Font.semiboldSystemFont(15), INK);
    text("Tap Update widget in the planner.", w, Font.systemFont(11), MUTE);
    w.addSpacer();
    w.refreshAfterDate = new Date(now + 6 * H);
    return w;
  }
  const st = state(d, now), medium = family === "systemMedium" || family === "systemLarge";
  w.backgroundImage = ring(family, st);
  // Redraw now and then so the ring moves; iOS decides how often it really does.
  w.refreshAfterDate = new Date(Math.min(+st.refresh, now + (st.wake ? 15 : 2) * 6e4));
  const head = (s0) => {
    const h = s0.addStack(); h.centerAlignContent();
    text(st.wake ? "NEXT WAKE-UP" : "BUS LEAVES", h, Font.boldSystemFont(11), st.col);
    h.addSpacer();
    // The small widget only has room for the flight number.
    const info = medium ? d.dl + (d.f ? " · " + d.f : "") : d.f || "";
    if (info) text(info, h, Font.mediumSystemFont(11), MUTE);
  };
  if (medium) {
    head(w); w.addSpacer(6);
    const b = w.addStack(); b.centerAlignContent();
    const l = b.addStack(); l.layoutVertically();
    text(st.wake ? d.ws : d.bs, l, Font.boldRoundedSystemFont(40), INK);
    timer(l, st, now, d, 26);
    b.addSpacer();
    const r = b.addStack(); r.layoutVertically(); r.size = new Size(150, 0);
    rows(r, d, st, now, 13);
  } else {
    head(w); w.addSpacer(4);
    timer(w, st, now, d, 32);
    w.addSpacer(6);
    rows(w, d, st, now, 12.5);
  }
  return w;
}
function lock(family, d, now) {
  const w = new ListWidget();
  if (!d) { text("No e-gates", w, Font.semiboldSystemFont(13)); w.refreshAfterDate = new Date(now + 6 * H); return w }
  const st = state(d, now);
  w.refreshAfterDate = st.refresh;
  if (family === "accessoryInline") {
    text(st.wake ? `⏰ ${d.ws} · bus ${d.bs}` : `🚌 Bus ${d.bs} · e-gate ${d.es}`, w, Font.systemFont(13));
    return w;
  }
  text(st.wake ? `Wake up ${d.ws}` : `Bus leaves ${d.bs}`, w, Font.boldSystemFont(13));
  timer(w, st, now, d, 22);
  text(st.wake ? `Bus ${d.bs} · e-gate ${d.es}` : `E-gate ${d.es}${d.f ? " · " + d.f : ""}`, w, Font.systemFont(12), null, 0.75);
  return w;
}
function build(family) {
  const now = Date.now(), d = next(now);
  return String(family).startsWith("accessory") ? lock(family, d, now) : home(family, d, now);
}

if (q.d) {
  // Opened from the planner: save the duties.
  let n = 0;
  try { n = JSON.parse(q.d).length; Keychain.set(KEY, q.d) } catch (e) { n = -1 }
  const d = next(Date.now()), a = new Alert();
  a.title = n < 0 ? "Couldn't read the duties" : "Widget updated";
  a.message = n < 0 ? "Tap Update widget in the planner again." :
    `${n} dut${n === 1 ? "y" : "ies"} saved.` + (d ? `\nNext wake-up ${d.ws} · ${d.dl}` : "");
  a.addAction("OK");
  await a.present();
} else if (config.runsInWidget) {
  Script.setWidget(build(config.widgetFamily));
} else {
  // Run inside Scriptable: preview the small Home Screen widget.
  await build("systemSmall").presentSmall();
}
Script.complete();
