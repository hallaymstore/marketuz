const CACHE='marketuz-shell-20261126g';
const SHELL=['/styles.css','/winter.css','/seasonal.css','/discovery.css','/studio.css','/payment.css','/growth.css','/app.js','/product-studio.js','/cms-ui.js','/experience.js','/growth-ui.js','/favicon.svg','/assets/product-placeholder.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const r=event.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/media/')||r.mode==='navigate')return;
  if(SHELL.includes(u.pathname))event.respondWith(fetch(r).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(r,copy));}return response;}).catch(()=>caches.match(r)));
});