// WakeUp: Lock Screen widget for the E-Gate Planner.
// In Scriptable, create a script named exactly "WakeUp" and paste this in.
// The planner sends your duties with its "Update widget" button.
const KEY = "wakeup.duties", DAY = 864e5;
const q = args.queryParameters || {};

function load() {
  try { return JSON.parse(Keychain.contains(KEY) ? Keychain.get(KEY) : "[]") } catch (e) { return [] }
}
// Next duty whose bus hasn't left yet.
function next(now) {
  return load().filter(d => d.b > now).sort((a, b) => a.b - b.b)[0] || null;
}
function line(w, s, font, op) {
  const t = w.addText(s);
  t.font = font; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
  if (op) t.textOpacity = op;
  return t;
}
function build(family) {
  const w = new ListWidget(), now = Date.now(), d = next(now), big = !String(family).startsWith("accessory");
  const k = big ? 1.3 : 1;
  if (!d) {
    line(w, family === "accessoryInline" ? "No e-gates" : "No e-gates yet", Font.semiboldSystemFont(13 * k));
    w.refreshAfterDate = new Date(now + 6 * 36e5);
    return w;
  }
  const wake = now < d.w, t = wake ? d.w : d.b;
  if (family === "accessoryInline") {
    line(w, wake ? `⏰ ${d.ws} · bus ${d.bs}` : `🚌 Bus ${d.bs} · e-gate ${d.es}`, Font.systemFont(13));
    w.refreshAfterDate = new Date(t + 1000);
    return w;
  }
  line(w, wake ? `Wake up ${d.ws}` : `Bus leaves ${d.bs}`, Font.boldSystemFont(13 * k));
  if (t - now > DAY) {
    // A timer over a day long is hard to read, so show the date until then.
    line(w, d.dl, Font.boldSystemFont(20 * k));
    w.refreshAfterDate = new Date(t - DAY + 1000);
  } else {
    const c = w.addDate(new Date(t));
    c.applyTimerStyle();
    c.font = Font.boldMonospacedSystemFont(22 * k); c.lineLimit = 1; c.minimumScaleFactor = 0.6;
    w.refreshAfterDate = new Date(t + 1000);
  }
  line(w, wake ? `Bus ${d.bs} · e-gate ${d.es}` : `E-gate ${d.es}${d.f ? " · " + d.f : ""}`, Font.systemFont(12 * k), 0.75);
  return w;
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
  // Run inside Scriptable: preview the Lock Screen widget.
  const w = build("accessoryRectangular");
  if (typeof w.presentAccessoryRectangular === "function") await w.presentAccessoryRectangular();
  else await w.presentSmall();
}
Script.complete();
