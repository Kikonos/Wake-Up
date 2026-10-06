// WakeUp: Lock Screen and Home Screen widget for the E-Gate Planner.
// In Scriptable, create a script named exactly "WakeUp" and paste this in.
// The planner sends your duties with its "Update widget" button.
const KEY = "wakeup.duties", H = 36e5, DAY = 24 * H;
const q = args.queryParameters || {};
// Same colours as the planner, light and dark.
const C = (l, d) => Color.dynamic(new Color(l), new Color(d));
const BG = C("#ffffff", "#171a22"), INK = C("#12141a", "#eef0f4"), MUTE = C("#6b7280", "#8b93a3");
const G = C("#16a34a", "#22c55e"), Y = C("#ca8a04", "#eab308"), R = C("#dc2626", "#ef4444");

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
  return { wake, t, col, refresh: new Date(change + 1000) };
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
  w.backgroundColor = BG; w.setPadding(14, 14, 14, 14);
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
  w.refreshAfterDate = st.refresh;
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
