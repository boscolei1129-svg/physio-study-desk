const CACHE='physio-study-desk-v4-premium';
const ASSETS=['./','./index.html','./styles.css','./premium.css','./app.mjs','./core.mjs','./content.mjs','./anatomy100.mjs','./icon.svg','./manifest.webmanifest','./assets/recall-paper.png',
  ...['DMSans-400','DMSans-500','DMSans-600','Newsreader-400','Newsreader-500'].map(name=>'./assets/fonts/'+name+'.ttf'),
  ...['arrow-right','arrow-up-right','arrow-counter-clockwise','caret-down','x','book-open','cards','check-square','clock-counter-clockwise','notebook','clipboard-text','books','calendar-blank','chart-bar','gear','house','plus'].map(name=>'./assets/icons/'+name+'.svg')];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('physio-study-desk-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  // Prefer online updates; fall back to the last successful copy when offline.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&ASSETS.some(asset=>new URL(asset,self.registration.scope).href===event.request.url)){
      const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));
    }
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
