const C="egate-v12",PDF="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/",WAIT=3000,
F=["./","index.html","manifest.webmanifest","scriptable/WakeUp.js","icon-180.png","icon-192.png","icon-512.png"],X=[PDF+"pdf.min.js",PDF+"pdf.worker.min.js"];
// The PDF reader is saved too so roster upload works offline; if the CDN is down the app still installs.
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F).then(()=>c.addAll(X).catch(()=>{}))));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  const q=e.request;if(q.method!=="GET")return;
  const own=new URL(q.url).origin===location.origin,good=r=>r.ok||r.type==="opaque";
  const saved=()=>caches.match(q,{ignoreSearch:true}).then(m=>m||(q.mode==="navigate"?caches.match("./"):null));
  // Only good responses replace the saved copy, so an error page never overwrites the app.
  let store=Promise.resolve();
  const net=fetch(q,own?{cache:"no-cache"}:{}).then(r=>{if(good(r)){const cp=r.clone();store=caches.open(C).then(c=>c.put(q,cp))}return r});
  e.waitUntil(net.then(()=>store,()=>{}));
  // The PDF reader never changes, so use the saved copy first.
  if(!own){e.respondWith(saved().then(m=>m||net));return}
  // App files: fresh when the network answers, saved copy after WAIT ms. In-flight Wi-Fi
  // often hangs instead of failing, which used to leave the screen blank.
  e.respondWith(new Promise(ok=>{
    let sent=false;const send=r=>{if(r&&!sent){sent=true;ok(r)}},fallback=r=>saved().then(m=>send(m||r||Response.error()));
    setTimeout(()=>saved().then(send),WAIT);
    net.then(r=>good(r)?send(r):fallback(r),()=>fallback());
  }));
});
