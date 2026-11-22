import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('public preview, search and guarded writes', async () => {
  const port = 39000 + Math.floor(Math.random() * 800);
  const { DATABASE_URL, ...env } = process.env;
  const server = spawn(process.execPath,['server.js'],{ cwd:process.cwd(), env:{...env,PORT:String(port)}, stdio:'ignore' });
  const base=`http://127.0.0.1:${port}`;
  try {
    let healthy=false;
    for(let i=0;i<35;i++) { try { const res=await fetch(base+'/api/healthz'); healthy=res.ok; if(healthy) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
    assert.ok(healthy,'preview server started');
    const page=await (await fetch(base+'/')).text(); assert.match(page,/Marketuz/); assert.match(page,/bottom-nav/); assert.match(page,/rel="canonical"/);assert.doesNotMatch(page,/sinov versiyasi/i);
    const config=await (await fetch(base+'/api/config')).json();assert.ok(['spring','summer','autumn','winter'].includes(config.seasonal.season));assert.equal(config.site.brand.name,'Marketuz');
    const productPage=await (await fetch(base+'/product/1')).text();assert.match(productPage,/application\/ld\+json/);assert.match(productPage,/og:image/);
    const catalog=await (await fetch(base+'/api/catalog?category=elektronika&q=Wireless')).json();
    assert.equal(catalog.total,1); assert.equal(catalog.products[0].name,'Wireless Studio quloqchin');
    const notFound=await fetch(base+'/api/products/999'); assert.equal(notFound.status,404);
    const registration=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}); assert.equal(registration.status,503);
    const blocked=await fetch(base+'/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://bad.example'},body:'{}'}); assert.equal(blocked.status,403);
  } finally { server.kill('SIGTERM'); }
});
