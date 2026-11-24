import express from 'express';
import pg from 'pg';
import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products as samples, featuredSamples, regions } from './seed.js';
import { defaults, validateSite, seasonalState, assetUrl } from './site-config.js';
import { mountPayments } from './payment-handlers.js';
import { canAdvanceOrder, checkoutContainsCardData } from './order-safety.js';
import { buildInterests, rankProducts } from './recommendations.js';
import { templateWorkbook, parseWorkbook } from './product-import.js';

const scrypt = promisify(scryptCallback);
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const secret = process.env.SESSION_SECRET || randomBytes(48).toString('hex');
const demoOnly = !process.env.DATABASE_URL;
let site = structuredClone(defaults);
const pool = demoOnly ? null : new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false
});
pool?.on('error', error => console.error('Database pool error:', error.message));
const inMemoryCatalog = samples.map((p, i) => ({ id: i + 1, seller_id: null, name: p[0], description: p[1], category: p[2], price: p[3], old_price: p[4], stock: p[5], stock_mode:'tracked',restock_days:7,sold_count:0,image_url: p[6], card_background:'',detail_background:'',badge: p[7], status: 'active' }));

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; script-src 'self' https://telegram.org https://my.click.uz; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://my.click.uz; frame-src https://my.click.uz; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://my.click.uz"
  });
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '3mb', type:['application/json','text/json'] }));
app.use('/api/payments/click',express.urlencoded({extended:false,limit:'16kb'}));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    if(req.path.startsWith('/payments/')||req.path==='/telegram/webhook') return next(); // Provider signatures/auth are validated by their handlers.
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'So‘rov manbasi tasdiqlanmadi.' });
    const origin = req.get('origin');
    if (origin && (() => { try { return new URL(origin).host !== req.get('host'); } catch { return true; } })()) return res.status(403).json({ error: 'So‘rov manbasi tasdiqlanmadi.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON ma’lumot yuboring.' });
  }
  next();
});

const fail = (status, message) => Object.assign(new Error(message), { status });
const route = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
const requireDb = (req, res, next) => demoOnly ? res.status(503).json({ error: 'Hisob va buyurtmalar uchun ma’lumotlar bazasi ulanmagan.' }) : next();
const emailOk = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
const text = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const imageOk = value => { if(assetUrl(value)) return true; try { const u = new URL(value); return u.protocol === 'https:' && value.length <= 1000; } catch { return false; } };
const externalLinks = value => {
  if(!Array.isArray(value) || value.length>5) throw fail(400,'Mahsulot havolalari ko‘pi bilan 5 ta bo‘lsin.');
  return value.map(x=>{ const label=text(x?.label,45), url=text(x?.url,1000); if(!label || !imageOk(url) || !url.startsWith('https://')) throw fail(400,'Mahsulotning tashqi havolalari HTTPS bo‘lishi kerak.'); return {label,url}; });
};
const gatewayConfigured=gateway=>!demoOnly && (gateway==='payme'?!!(process.env.PAYME_MERCHANT_ID&&process.env.PAYME_KEY&&process.env.PAYME_LOGIN):!!(process.env.CLICK_MERCHANT_ID&&process.env.CLICK_SERVICE_ID&&process.env.CLICK_SECRET_KEY));
const paymentReady=gateway=>gatewayConfigured(gateway) && process.env.PAYMENTS_ENABLED==='true' && process.env.SHIPPING_INCLUDED_IN_PRICE==='true' && ['operator','taxId','address','phone','email','returnPolicy'].every(k=>!!site.legal[k]);
const paymentUrl=(gateway,id,total)=>{
  const ret=site.seo.siteUrl+'/pay/'+id;
  if(gateway==='payme') return 'https://checkout.paycom.uz/'+Buffer.from(`m=${process.env.PAYME_MERCHANT_ID};ac.order_id=${id};a=${total*100};l=uz;c=${encodeURIComponent(ret)}`).toString('base64');
  const u=new URL('https://my.click.uz/services/pay');
  for(const [k,v] of Object.entries({service_id:process.env.CLICK_SERVICE_ID,merchant_id:process.env.CLICK_MERCHANT_ID,amount:total,transaction_param:id,return_url:ret})) u.searchParams.set(k,String(v));
  return u.href;
};
const hashPassword = async password => { const salt = randomBytes(16).toString('hex'); const key = await scrypt(password, salt, 64); return salt + ':' + key.toString('hex'); };
const verifyPassword = async (password, encoded) => { const [salt, hash] = (encoded || '').split(':'); if (!salt || !hash || hash.length !== 128) return false; const actual = await scrypt(password, salt, 64); return timingSafeEqual(Buffer.from(hash, 'hex'), actual); };
function tokenFor(id) { const payload = Buffer.from(JSON.stringify({ id: String(id), exp: Date.now() + 7 * 864e5 })).toString('base64url'); return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url'); }
function tokenId(value) {
  try { const [payload, signature] = value.split('.'); if (!payload || !signature) return null; const expected = createHmac('sha256', secret).update(payload).digest(); const actual = Buffer.from(signature, 'base64url'); if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null; const obj = JSON.parse(Buffer.from(payload, 'base64url').toString()); return obj.exp > Date.now() && /^\d+$/.test(obj.id) ? obj.id : null; } catch { return null; }
}
function cookieValue(req, name) { const found = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '=')); return found?.slice(name.length + 1); }
const setSession = (res, id) => res.cookie('marketuz_session', tokenFor(id), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 864e5 });
const auth = route(async (req, res, next) => { const id = tokenId(cookieValue(req, 'marketuz_session') || ''); if (!id) throw fail(401, 'Davom etish uchun hisobingizga kiring.'); const { rows } = await pool.query('SELECT id, full_name, email, phone, role, seller_status, avatar_url, cover_url, bio, personalization_enabled FROM users WHERE id=$1', [id]); if (!rows[0]) throw fail(401, 'Hisob topilmadi.'); req.user = rows[0]; next(); });
const role = name => (req, res, next) => req.user?.role === name ? next() : next(fail(403, 'Ushbu bo‘lim uchun ruxsat yo‘q.'));
const authHits = new Map();
const rateAuth = (req, res, next) => { const key = req.ip || 'unknown', now = Date.now(); const hit = authHits.get(key) || { n: 0, until: now + 15 * 60_000 }; if (hit.until < now) { hit.n = 0; hit.until = now + 15 * 60_000; } if (++hit.n > 25) return res.status(429).json({ error: 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.' }); authHits.set(key, hit); next(); };
setInterval(() => { for (const [key, value] of authHits) if (value.until < Date.now()) authHits.delete(key); }, 20 * 60_000).unref();

app.get('/api/healthz', route(async (req, res) => { if (pool) await pool.query('SELECT 1'); res.json({ ok: true, database: pool ? 'ready' : 'preview' }); }));
app.get('/api/config', (req, res) => res.json({ categories:site.categories, regions, demoOnly, payments: ['cod',...['click','payme'].filter(paymentReady)], shipping: process.env.SHIPPING_INCLUDED_IN_PRICE==='true'?'included':'manual', site, seasonal:seasonalState(site), telegramEnabled:!!process.env.TELEGRAM_BOT_TOKEN }));
app.get('/media/:id', requireDb, route(async (req,res)=>{
  if(!/^[0-9a-f-]{36}$/.test(req.params.id)) throw fail(404,'Rasm topilmadi.');
  const {rows}=await pool.query('SELECT mime,bytes FROM site_assets WHERE id=$1',[req.params.id]);
  if(!rows[0]) throw fail(404,'Rasm topilmadi.');
  res.set('Content-Type',rows[0].mime); res.set('Cache-Control','public,max-age=31536000,immutable'); res.send(rows[0].bytes);
}));
app.get('/manifest.webmanifest',(req,res)=>res.type('application/manifest+json').set('Cache-Control','no-store').json({name:site.brand.name,short_name:site.brand.name.slice(0,12),description:site.brand.description,start_url:'/',display:'standalone',background_color:'#fbf8ef',theme_color:'#113d36',icons:[{src:site.brand.favicon||'/favicon.svg',sizes:'any',purpose:'any'}]}));
app.get('/api/admin/settings', requireDb, auth, role('admin'), (req,res)=>res.json({ site, seasonal:seasonalState(site), payments:{click:paymentReady('click'),clickInline:paymentReady('click')&&process.env.CLICK_INLINE_ENABLED==='true'&&!!process.env.CLICK_MERCHANT_USER_ID,payme:paymentReady('payme'),enabled:process.env.PAYMENTS_ENABLED==='true',shippingIncluded:process.env.SHIPPING_INCLUDED_IN_PRICE==='true'},telegram:!!process.env.TELEGRAM_BOT_TOKEN }));
app.patch('/api/admin/settings', requireDb, auth, role('admin'), route(async(req,res)=>{
  if(JSON.stringify(req.body||{}).length>25000) throw fail(413,'Sozlamalar hajmi juda katta.');
  let next; try { next=validateSite(req.body); } catch(e) { throw fail(400,e.message); }
  if(process.env.MARKETUZ_URL) next.seo.siteUrl=site.seo.siteUrl;
  const orphan=await pool.query("SELECT count(*)::int AS n FROM products WHERE category != ALL($1::text[]) AND status!='archived'",[next.categories.map(c=>c.id)]);
  if(orphan.rows[0].n) throw fail(409,'Kategoriyani o‘chirishdan oldin undagi mahsulotlarni boshqa kategoriyaga o‘tkazing.');
  const db=await pool.connect();
  try { await db.query('BEGIN'); await db.query("INSERT INTO site_settings(key,value,updated_by) VALUES('site',$1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now(),updated_by=excluded.updated_by",[next,req.user.id]); await db.query('INSERT INTO settings_audit(actor_id,old_value,new_value) VALUES($1,$2,$3)',[req.user.id,site,next]); await db.query('COMMIT'); site=next; res.json({site,seasonal:seasonalState(site)}); }
  catch(e){await db.query('ROLLBACK');throw e;} finally{db.release();}
}));
app.post('/api/assets', requireDb, auth, route(async(req,res)=>{
  const data=String(req.body.data||'');
  if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) throw fail(400,'PNG, JPEG yoki WebP rasm yuklang.');
  const [,kind,b64]=data.match(/^data:image\/(png|jpeg|webp);base64,(.*)$/);
  const bytes=Buffer.from(b64,'base64');
  if(bytes.length<32 || bytes.length>1_500_000) throw fail(413,'Rasm 1.5 MB dan kichik bo‘lsin.');
  if(req.user.role==='buyer') { const {rows}=await pool.query("SELECT count(*)::int AS n FROM site_assets WHERE owner_id=$1 AND created_at>now()-interval '1 day'",[req.user.id]); if(rows[0].n>=8) throw fail(429,'Bugun uchun rasm yuklash limiti tugadi.'); }
  const valid=kind==='png'?bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):kind==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid) throw fail(400,'Rasm fayli buzilgan yoki noto‘g‘ri.');
  const id=randomUUID(), mime=kind==='jpeg'?'image/jpeg':`image/${kind}`;
  await pool.query('INSERT INTO site_assets(id,owner_id,mime,bytes,size_bytes) VALUES($1,$2,$3,$4,$5)',[id,req.user.id,mime,bytes,bytes.length]);
  res.status(201).json({url:'/media/'+id,size:bytes.length});
}));
const catalogFields='id,seller_id,name,description,category,subcategory,brand,price,old_price,stock,stock_mode,restock_days,sold_count,image_url,card_background,detail_background,badge,external_links,variant_count,created_at';
const feedSort={ newest:{order:'id DESC',key:'id'}, price_asc:{order:'price ASC,id DESC',key:'price'},price_desc:{order:'price DESC,id DESC',key:'price'},popular:{order:'sold_count DESC,id DESC',key:'sold_count'} };
const encodeCursor=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const decodeCursor=(value,sort,q,category)=>{
  if(!value) return null;
  if(typeof value!=='string'||value.length>400) throw fail(400,'Katalog kursori xato.');
  try {
    const c=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    if(!Array.isArray(c)||c.length!==5||c[0]!==sort||c[1]!==q||c[2]!==category||!Number.isSafeInteger(c[3])||!Number.isSafeInteger(c[4])||c[4]<1) throw Error();
    return c;
  } catch { throw fail(400,'Katalog kursori xato.'); }
};
app.get('/api/catalog/feed',route(async(req,res)=>{
  const q=text(req.query.q,80),category=text(req.query.category,40),sort=feedSort[req.query.sort]?req.query.sort:'newest';
  const limit=Math.min(36,Math.max(1,Number.parseInt(req.query.limit,10)||24));
  const cursor=decodeCursor(req.query.cursor,sort,q,category), config=feedSort[sort];
  if(category && !site.categories.some(x=>x.id===category)) return res.json({products:[],nextCursor:null,hasMore:false});
  if(demoOnly){
    let data=inMemoryCatalog.filter(p=>(!category||p.category===category)&&(!q||(p.name+' '+p.description).toLowerCase().includes(q.toLowerCase())));
    data.sort((a,b)=>sort==='price_asc'?a.price-b.price||b.id-a.id:sort==='price_desc'?b.price-a.price||b.id-a.id:sort==='popular'?b.sold_count-a.sold_count||b.id-a.id:b.id-a.id);
    if(cursor) data=data.filter(p=>sort==='price_asc'?(p.price>cursor[3]||p.price===cursor[3]&&p.id<cursor[4]):sort==='price_desc'?(p.price<cursor[3]||p.price===cursor[3]&&p.id<cursor[4]):sort==='popular'?(p.sold_count<cursor[3]||p.sold_count===cursor[3]&&p.id<cursor[4]):p.id<cursor[4]);
    const products=data.slice(0,limit),last=products.at(-1);return res.json({products,hasMore:data.length>limit,nextCursor:data.length>limit?encodeCursor([sort,q,category,last[config.key],last.id]):null});
  }
  const params=['active'],where=['status=$1'];
  if(q){params.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');where.push(`(name ILIKE $${params.length} ESCAPE '\\' OR description ILIKE $${params.length} ESCAPE '\\')`);}
  if(category){params.push(category);where.push(`category=$${params.length}`);}
  if(cursor){params.push(cursor[3],cursor[4]);const a=params.length-1,b=params.length;where.push(config.key==='id'?`id<$${b}`:sort==='price_asc'?`(price>$${a} OR (price=$${a} AND id<$${b}))`:`(${config.key}<$${a} OR (${config.key}=$${a} AND id<$${b}))`);}
  params.push(limit+1);
  const {rows}=await pool.query(`SELECT ${catalogFields} FROM products WHERE ${where.join(' AND ')} ORDER BY ${config.order} LIMIT $${params.length}`,params);
  const products=rows.slice(0,limit),last=products.at(-1),hasMore=rows.length>limit;
  res.json({products,hasMore,nextCursor:hasMore?encodeCursor([sort,q,category,Number(last[config.key]),Number(last.id)]):null});
}));
app.get('/api/catalog', route(async (req, res) => {
  const q = text(req.query.q, 80), category = text(req.query.category, 40), sort = text(req.query.sort, 20);
  const page = Math.min(100, Math.max(1, Number.parseInt(req.query.page, 10) || 1)), limit = 16;
  const order = { newest: 'id DESC', price_asc: 'price ASC, id DESC', price_desc: 'price DESC, id DESC', popular: 'sold_count DESC,id DESC' }[sort] || 'id DESC';
  if (demoOnly) { let p = inMemoryCatalog.filter(x => (!q || (x.name + ' ' + x.description).toLowerCase().includes(q.toLowerCase())) && (!category || x.category === category)); p = sort === 'price_asc' ? p.sort((a,b) => a.price-b.price) : sort === 'price_desc' ? p.sort((a,b) => b.price-a.price) : p; return res.json({ products: p.slice((page-1)*limit,page*limit), total: p.length, page, pages: Math.ceil(p.length/limit) }); }
  const where = ['status=$1']; const params = ['active'];
  if (q) { params.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%'); where.push(`(name ILIKE $${params.length} ESCAPE '\\' OR description ILIKE $${params.length} ESCAPE '\\')`); }
  if (category) { if(!site.categories.some(c => c.id === category)) return res.json({products:[],total:0,page,pages:0}); params.push(category); where.push(`category=$${params.length}`); }
  const condition = where.join(' AND ');
  const count = await pool.query(`SELECT count(*)::int AS total FROM products WHERE ${condition}`, params);
  params.push(limit, (page-1)*limit);
  const data = await pool.query(`SELECT ${catalogFields} FROM products WHERE ${condition} ORDER BY ${order} LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  const total = count.rows[0].total; res.json({ products: data.rows, total, page, pages: Math.ceil(total/limit) });
}));
app.get('/api/products/:id', route(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) throw fail(404, 'Mahsulot topilmadi.');
  if (demoOnly) { const product = inMemoryCatalog.find(p => p.id === Number(req.params.id)); if (!product) throw fail(404, 'Mahsulot topilmadi.'); return res.json({ product }); }
  const { rows } = await pool.query("SELECT p.*,u.full_name AS seller_name,u.avatar_url AS seller_avatar FROM products p LEFT JOIN users u ON p.seller_id=u.id WHERE p.id=$1 AND p.status='active'", [req.params.id]);
  if (!rows[0]) throw fail(404, 'Mahsulot topilmadi.');
  rows[0].variants=(await pool.query('SELECT id,label,sku,price,stock,image_url FROM product_variants WHERE product_id=$1 AND active=true ORDER BY position,id',[req.params.id])).rows;
  res.json({ product: rows[0] });
}));
app.get('/api/recommendations',route(async(req,res)=>{
  const contextId=/^\d+$/.test(String(req.query.productId||''))?String(req.query.productId):null;
  const limit=Math.min(16,Math.max(1,Number.parseInt(req.query.limit,10)||12));
  const validKind=['for-you','together','trending'].includes(req.query.kind)?req.query.kind:'for-you';
  if(demoOnly) return res.json({products:rankProducts(inMemoryCatalog,null,{context:contextId?inMemoryCatalog.find(p=>String(p.id)===contextId):null,limit}),personalized:false});
  const sessionId=tokenId(cookieValue(req,'marketuz_session')||'');
  const current=sessionId?(await pool.query('SELECT personalization_enabled FROM users WHERE id=$1',[sessionId])).rows[0]:null;
  const personalized=!!current?.personalization_enabled && validKind==='for-you';
  let interests=null;
  if(personalized){
    const [events,favorites,purchases]=await Promise.all([
      pool.query("SELECT e.kind,e.query,e.duration_seconds,e.created_at,p.id,p.category,p.name,p.price FROM product_events e LEFT JOIN products p ON p.id=e.product_id WHERE e.user_id=$1 AND e.created_at>now()-interval '90 days' ORDER BY e.created_at DESC LIMIT 160",[sessionId]),
      pool.query('SELECT p.id,p.category,p.name,p.price FROM favorites f JOIN products p ON p.id=f.product_id WHERE f.user_id=$1 ORDER BY p.id DESC LIMIT 80',[sessionId]),
      pool.query("SELECT p.id,p.category,p.name,p.price FROM orders o JOIN order_items i ON i.order_id=o.id JOIN products p ON p.id=i.product_id WHERE o.buyer_id=$1 AND o.status!='cancelled' ORDER BY o.created_at DESC LIMIT 80",[sessionId])
    ]);
    interests=buildInterests(events.rows,favorites.rows,purchases.rows);
  }
  const context=contextId?(await pool.query("SELECT id,category,price FROM products WHERE id=$1 AND status='active'",[contextId])).rows[0]:null;
  const pairs=new Map();
  if(context){
    const {rows}=await pool.query("SELECT i2.product_id AS id,count(*)::int AS count FROM order_items i1 JOIN orders o ON o.id=i1.order_id JOIN order_items i2 ON i2.order_id=i1.order_id AND i2.product_id<>i1.product_id WHERE i1.product_id=$1 AND o.status!='cancelled' GROUP BY i2.product_id ORDER BY count DESC LIMIT 30",[contextId]);
    rows.forEach(p=>pairs.set(String(p.id),p.count));
  }
  const categories=interests?[...interests.categories.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]):[];
  const candidateQueries=[
    pool.query("SELECT * FROM products WHERE status='active' AND (stock_mode='replenishable' OR stock>0) ORDER BY sold_count DESC,id DESC LIMIT 80"),
    pool.query("SELECT * FROM products WHERE status='active' AND (stock_mode='replenishable' OR stock>0) ORDER BY id DESC LIMIT 80")
  ];
  if(categories.length) candidateQueries.push(pool.query("SELECT * FROM products WHERE status='active' AND category=ANY($1::text[]) AND (stock_mode='replenishable' OR stock>0) ORDER BY id DESC LIMIT 100",[categories]));
  if(context) candidateQueries.push(pool.query("SELECT * FROM products WHERE status='active' AND category=$1 AND (stock_mode='replenishable' OR stock>0) ORDER BY id DESC LIMIT 60",[context.category]));
  if(pairs.size) candidateQueries.push(pool.query("SELECT * FROM products WHERE id=ANY($1::bigint[]) AND status='active'",[[...pairs.keys()]]));
  const results=await Promise.all(candidateQueries);
  const products=rankProducts(results.flatMap(x=>x.rows),validKind==='trending'?null:interests,{context:validKind==='trending'?null:context,together:validKind==='trending'?new Map():pairs,limit});
  res.json({products,personalized});
}));

app.post('/api/auth/register', requireDb, rateAuth, route(async (req, res) => {
  const name = text(req.body.name), email = text(req.body.email, 200).toLowerCase(), password = String(req.body.password || '');
  if (name.length < 2 || !emailOk(email) || password.length < 10 || password.length > 128) throw fail(400, 'Ism, email va kamida 10 belgili parol kiriting.');
  if (req.body.agree !== true) throw fail(400, 'Foydalanish shartlari va maxfiylik siyosatini tasdiqlang.');
  try { const result = await pool.query('INSERT INTO users(full_name,email,password_hash) VALUES($1,$2,$3) RETURNING id,full_name,email,phone,role,seller_status', [name,email,await hashPassword(password)]); setSession(res, result.rows[0].id); res.status(201).json({ user: result.rows[0] }); }
  catch (e) { if (e.code === '23505') throw fail(409, 'Bu email bilan hisob allaqachon ochilgan.'); throw e; }
}));
app.post('/api/auth/login', requireDb, rateAuth, route(async (req, res) => {
  const email = text(req.body.email, 200).toLowerCase(), password = String(req.body.password || '');
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) throw fail(401, 'Email yoki parol noto‘g‘ri.');
  setSession(res, rows[0].id); const { password_hash, ...user } = rows[0]; res.json({ user });
}));
app.post('/api/auth/telegram', requireDb, rateAuth, route(async(req,res)=>{
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) throw fail(503,'Telegram orqali kirish sozlanmagan.');
  const raw=String(req.body.initData||''); if(!raw || raw.length>12000) throw fail(400,'Telegram ma’lumoti xato.');
  const params=new URLSearchParams(raw), hash=params.get('hash'), date=Number(params.get('auth_date'));
  if(!hash || !/^[0-9a-f]{64}$/i.test(hash) || [...params].length!==new Set([...params.keys()]).size || !Number.isSafeInteger(date) || Math.abs(Date.now()/1000-date)>3600) throw fail(401,'Telegram tasdiqlash muddati tugagan.');
  const check=[...params].filter(([k])=>k!=='hash').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const key=createHmac('sha256','WebAppData').update(token).digest();
  const expected=createHmac('sha256',key).update(check).digest();
  if(!timingSafeEqual(expected,Buffer.from(hash,'hex'))) throw fail(401,'Telegram imzosi tasdiqlanmadi.');
  let tg; try { tg=JSON.parse(params.get('user')||''); } catch { throw fail(400,'Telegram foydalanuvchisi xato.'); }
  const tgId=String(tg.id||''); if(!/^\d{1,20}$/.test(tgId)) throw fail(400,'Telegram ID xato.');
  const name=text([tg.first_name,tg.last_name].filter(Boolean).join(' '),100)||'Telegram foydalanuvchisi';
  const email=`telegram-${tgId}@marketuz.invalid`;
  const {rows}=await pool.query("INSERT INTO users(full_name,email,password_hash,telegram_id) VALUES($1,$2,$3,$4) ON CONFLICT(telegram_id) DO UPDATE SET full_name=excluded.full_name RETURNING id,full_name,email,phone,role,seller_status",[name,email,await hashPassword(randomBytes(36).toString('hex')),tgId]);
  setSession(res,rows[0].id); res.json({user:rows[0]});
}));
app.post('/api/telegram/webhook', route(async(req,res)=>{
  const token=process.env.TELEGRAM_BOT_TOKEN,secretToken=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(!token||!secretToken) throw fail(503,'Telegram bot sozlanmagan.');
  const got=req.get('X-Telegram-Bot-Api-Secret-Token')||'';
  if(!got||Buffer.byteLength(got)!==Buffer.byteLength(secretToken)||!timingSafeEqual(Buffer.from(got),Buffer.from(secretToken))) throw fail(401,'Telegram imzosi xato.');
  const message=req.body?.message;
  if(message?.text?.startsWith('/start') && Number.isSafeInteger(message.chat?.id)){
    const reply=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:message.chat.id,text:`${site.brand.name} — mahsulotlarni kashf eting.`,reply_markup:{inline_keyboard:[[{text:'Do‘konni ochish',web_app:{url:site.seo.siteUrl}}]]}}),signal:AbortSignal.timeout(10000)});
    if(!reply.ok) throw fail(502,'Telegram xabarini yuborib bo‘lmadi.');
  }
  res.json({ok:true});
}));
app.post('/api/auth/logout', (req, res) => { res.clearCookie('marketuz_session', { path: '/' }); res.json({ ok: true }); });
app.get('/api/me', requireDb, auth, (req, res) => res.json({ user: req.user }));
app.patch('/api/me', requireDb, auth, route(async (req, res) => {
  const name = text(req.body.name), phone = text(req.body.phone, 30),bio=text(req.body.bio,300),avatar=text(req.body.avatarUrl,1000),cover=text(req.body.coverUrl,1000);
  if (name.length < 2 || (phone && !/^\+?[\d\s()-]{9,25}$/.test(phone))) throw fail(400, 'Ism yoki telefon raqami xato.');
  if((avatar&&!imageOk(avatar))||(cover&&!imageOk(cover))) throw fail(400,'Profil rasmi yoki fon havolasi xato.');
  const { rows } = await pool.query('UPDATE users SET full_name=$1,phone=$2,bio=$3,avatar_url=$4,cover_url=$5 WHERE id=$6 RETURNING id,full_name,email,phone,role,seller_status,avatar_url,cover_url,bio,personalization_enabled', [name,phone,bio,avatar,cover,req.user.id]); res.json({ user: rows[0] });
}));
app.patch('/api/me/personalization',requireDb,auth,route(async(req,res)=>{
  if(typeof req.body.enabled!=='boolean') throw fail(400,'Tanlov xato.');
  const db=await pool.connect();
  try { await db.query('BEGIN');await db.query('UPDATE users SET personalization_enabled=$1 WHERE id=$2',[req.body.enabled,req.user.id]);if(!req.body.enabled) await db.query('DELETE FROM product_events WHERE user_id=$1',[req.user.id]);await db.query('COMMIT');res.json({enabled:req.body.enabled}); }
  catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}));
app.delete('/api/me/activity',requireDb,auth,route(async(req,res)=>{await pool.query('DELETE FROM product_events WHERE user_id=$1',[req.user.id]);res.json({ok:true});}));
app.post('/api/events',requireDb,auth,route(async(req,res)=>{
  if(!req.user.personalization_enabled) return res.json({recorded:false});
  const kind=text(req.body.kind,12),query=text(req.body.query,80),productId=Number(req.body.productId),duration=Number(req.body.durationSeconds||0);
  if(!['search','view','dwell','cart'].includes(kind)||kind==='search'&&query.length<2||kind!=='search'&&(!Number.isSafeInteger(productId)||productId<1)||!Number.isSafeInteger(duration)||duration<0||duration>180||kind==='dwell'&&duration<5) throw fail(400,'Faoliyat ma’lumoti xato.');
  if(kind!=='search'){const found=await pool.query("SELECT id FROM products WHERE id=$1 AND status='active'",[productId]);if(!found.rowCount) throw fail(404,'Mahsulot topilmadi.');}
  const result=await pool.query("INSERT INTO product_events(user_id,product_id,kind,query,duration_seconds) SELECT $1,$2,$3,$4,$5 WHERE (SELECT count(*) FROM product_events WHERE user_id=$1 AND created_at>now()-interval '1 day')<300",[req.user.id,kind==='search'?null:productId,kind,kind==='search'?query:'',kind==='dwell'?duration:0]);
  res.status(result.rowCount?201:429).json({recorded:!!result.rowCount});
}));
app.get('/api/me/follows',requireDb,auth,route(async(req,res)=>{
  const {rows}=await pool.query('SELECT u.id,u.full_name,u.avatar_url,u.cover_url,u.bio,(SELECT count(*)::int FROM products p WHERE p.seller_id=u.id AND p.status=\'active\') AS product_count FROM seller_follows f JOIN users u ON u.id=f.seller_id WHERE f.buyer_id=$1 ORDER BY f.created_at DESC LIMIT 100',[req.user.id]);res.json({sellers:rows});
}));
app.get('/api/shops/:id',requireDb,route(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) throw fail(404,'Do‘kon topilmadi.');
  const {rows}=await pool.query("SELECT u.id,u.full_name,u.avatar_url,u.cover_url,u.bio,u.created_at,(SELECT count(*)::int FROM seller_follows WHERE seller_id=u.id) AS followers,(SELECT count(*)::int FROM products WHERE seller_id=u.id AND status='active') AS product_count FROM users u WHERE u.id=$1 AND u.role='seller'",[req.params.id]);
  if(!rows[0]) throw fail(404,'Do‘kon topilmadi.');
  const cursor=/^\d+$/.test(String(req.query.cursor||''))?Number(req.query.cursor):null;
  const {rows:products}=await pool.query(`SELECT ${catalogFields} FROM products WHERE seller_id=$1 AND status='active' ${cursor?'AND id<$2':''} ORDER BY id DESC LIMIT 25`,cursor?[req.params.id,cursor]:[req.params.id]);
  const sessionId=tokenId(cookieValue(req,'marketuz_session')||'');let following=false;
  if(sessionId) following=!!(await pool.query('SELECT 1 FROM seller_follows WHERE seller_id=$1 AND buyer_id=$2',[req.params.id,sessionId])).rowCount;
  res.json({seller:rows[0],products:products.slice(0,24),nextCursor:products.length>24?String(products[23].id):null,following});
}));
app.put('/api/shops/:id/follow',requireDb,auth,route(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)||String(req.params.id)===String(req.user.id)) throw fail(400,'Do‘kon xato.');
  const {rowCount}=await pool.query("INSERT INTO seller_follows(buyer_id,seller_id) SELECT $1,id FROM users WHERE id=$2 AND role='seller' ON CONFLICT DO NOTHING",[req.user.id,req.params.id]);
  if(!rowCount){const found=await pool.query("SELECT id FROM users WHERE id=$1 AND role='seller'",[req.params.id]);if(!found.rowCount) throw fail(404,'Do‘kon topilmadi.');}
  res.json({following:true});
}));
app.delete('/api/shops/:id/follow',requireDb,auth,route(async(req,res)=>{await pool.query('DELETE FROM seller_follows WHERE buyer_id=$1 AND seller_id=$2',[req.user.id,req.params.id]);res.json({following:false});}));
app.post('/api/me/password', requireDb, auth, rateAuth, route(async (req, res) => {
  const old = String(req.body.currentPassword || ''), next = String(req.body.newPassword || '');
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await verifyPassword(old, rows[0].password_hash))) throw fail(400, 'Joriy parol xato.');
  if (next.length < 10 || next.length > 128) throw fail(400, 'Yangi parol kamida 10 belgidan iborat bo‘lsin.');
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(next),req.user.id]); res.json({ ok: true });
}));
app.get('/api/favorites', requireDb, auth, route(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${catalogFields.split(',').map(x=>'p.'+x).join(',')} FROM favorites f JOIN products p ON p.id=f.product_id WHERE f.user_id=$1 AND p.status='active' ORDER BY p.id DESC LIMIT 100`, [req.user.id]); res.json({ products: rows });
}));
app.put('/api/favorites/:id', requireDb, auth, route(async (req, res) => { const { rowCount } = await pool.query("INSERT INTO favorites(user_id,product_id) SELECT $1,id FROM products WHERE id=$2 AND status='active' ON CONFLICT DO NOTHING", [req.user.id,req.params.id]); res.json({ ok: true, added: !!rowCount }); }));
app.delete('/api/favorites/:id', requireDb, auth, route(async (req, res) => { await pool.query('DELETE FROM favorites WHERE user_id=$1 AND product_id=$2', [req.user.id,req.params.id]); res.json({ ok: true }); }));

app.post('/api/orders', requireDb, auth, route(async (req, res) => {
  const body = req.body||{}, recipient = text(body.recipient), phone = text(body.phone,30), region = text(body.region,80), district = text(body.district,100), address = text(body.address,300), note = text(body.note,500);
  if (checkoutContainsCardData(body)) throw fail(400,'Karta ma’lumotlarini saytga yubormang. Karta Click oynasiga kiritiladi.');
  const checkoutKey=body.checkoutKey||null;
  if(checkoutKey && (typeof checkoutKey!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(checkoutKey))) throw fail(400,'Buyurtma kaliti noto‘g‘ri.');
  if(body.agree!==true && body.agree!=='on') throw fail(400,'Buyurtma shartlarini tasdiqlang.');
  if (recipient.length < 2 || !/^\+?[\d\s()-]{9,25}$/.test(phone) || !regions.includes(region) || district.length < 2 || address.length < 5) throw fail(400, 'Qabul qiluvchi va manzil ma’lumotlarini to‘liq kiriting.');
  const method=text(body.paymentMethod,20);
  if(method!=='cod' && !(['click','payme'].includes(method) && paymentReady(method))) throw fail(400,'Tanlangan to‘lov usuli hozir faol emas.');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 30) throw fail(400, 'Savat bo‘sh yoki juda katta.');
  const items = body.items.map(x => ({ id: Number(x.id), variantId:x.variantId?Number(x.variantId):null, qty: Number(x.qty) }));
  if (items.some(x => !Number.isSafeInteger(x.id) || x.id < 1 || !Number.isSafeInteger(x.qty) || x.qty < 1 || x.qty > 20 || (x.variantId!==null&&(!Number.isSafeInteger(x.variantId)||x.variantId<1))) || new Set(items.map(x => `${x.id}:${x.variantId||''}`)).size !== items.length) throw fail(400, 'Savat ma’lumotlari xato.');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    if(checkoutKey){
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${req.user.id}:${checkoutKey}`]);
      const existing=(await db.query('SELECT id,subtotal,status,payment_method FROM orders WHERE buyer_id=$1 AND checkout_key=$2',[req.user.id,checkoutKey])).rows[0];
      if(existing){
        await db.query('COMMIT');
        return res.json({id:existing.id,subtotal:existing.subtotal,status:existing.status,paymentUrl:existing.status==='awaiting_payment'&&paymentReady(existing.payment_method)?paymentUrl(existing.payment_method,existing.id,existing.subtotal):null,message:'Buyurtma avval yaratilgan.'});
      }
    }
    const ids = [...new Set(items.map(x=>x.id))].sort((a,b) => a-b);
    const locked = await db.query('SELECT id,name,price,stock,stock_mode,image_url,seller_id,variant_count FROM products WHERE id=ANY($1::bigint[]) AND status=$2 ORDER BY id FOR UPDATE', [ids,'active']);
    if (locked.rows.length !== ids.length) throw fail(409, 'Savatdagi ayrim mahsulotlar endi mavjud emas.');
    let subtotal = 0; const detailed = [];
    const variantIds=items.map(i=>i.variantId).filter(Boolean).sort((a,b)=>a-b);
    const variants=variantIds.length?(await db.query('SELECT id,product_id,label,price,stock,image_url FROM product_variants WHERE id=ANY($1::bigint[]) AND active=true ORDER BY id FOR UPDATE',[variantIds])).rows:[];
    for (const item of items) {
      const p=locked.rows.find(x=>Number(x.id)===item.id),v=item.variantId?variants.find(x=>Number(x.id)===item.variantId):null;
      if((p.variant_count>0 && (!v || Number(v.product_id)!==item.id)) || (p.variant_count===0 && item.variantId))throw fail(409,`${p.name}: variantni qayta tanlang.`);
      if(p.stock_mode!=='replenishable' && (v?v.stock:p.stock)<item.qty)throw fail(409,`${p.name}: ombordagi miqdor yetarli emas.`);
      const price=v?v.price:p.price;subtotal+=price*item.qty;
      if(subtotal>2_000_000_000) throw fail(400,'Buyurtma summasi limitdan oshdi.');
      detailed.push({...p,qty:item.qty,variantId:v?.id||null,variantLabel:v?.label||'',price,image_url:v?.image_url||p.image_url});
    }
    if(method!=='cod' && detailed.some(p=>p.stock_mode==='replenishable')) throw fail(409,'Buyurtma asosida keladigan mahsulot uchun to‘lov operator tasdiqlaganidan keyin kelishiladi. Yetkazilganda to‘lovni tanlang.');
    const id = randomUUID();
    await db.query('INSERT INTO orders(id,buyer_id,recipient,phone,region,district,address,note,payment_method,subtotal,total,status,payment_status,checkout_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13)', [id,req.user.id,recipient,phone,region,district,address,note,method,subtotal,method==='cod'?'new':'awaiting_payment',method==='cod'?'unpaid':'pending',checkoutKey]);
    for (const p of detailed) {
      await db.query("UPDATE products SET stock=CASE WHEN stock_mode='tracked' THEN stock-$1 ELSE stock END,sold_count=sold_count+$1,updated_at=now() WHERE id=$2", [p.qty,p.id]);
      if(p.variantId&&p.stock_mode==='tracked')await db.query('UPDATE product_variants SET stock=stock-$1,updated_at=now() WHERE id=$2',[p.qty,p.variantId]);
      await db.query('INSERT INTO order_items(order_id,product_id,seller_id,title,image_url,price,quantity,stock_reserved,variant_id,variant_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id,p.id,p.seller_id,p.name,p.image_url,p.price,p.qty,p.stock_mode==='tracked',p.variantId,p.variantLabel]);
    }
    await db.query('COMMIT'); res.status(201).json({ id, subtotal, status: method==='cod'?'new':'awaiting_payment', paymentUrl:method==='cod'?null:paymentUrl(method,id,subtotal), message: method==='cod'?'Buyurtma qabul qilindi. Yetkazish narxi operator tasdiqlagach aniqlanadi.':'Buyurtma yaratildi. To‘lovni xavfsiz oynada yakunlang.' });
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}));
app.get('/api/orders', requireDb, auth, route(async (req, res) => {
  const result = await pool.query('SELECT * FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  const ids = result.rows.map(o => o.id);
  const items = ids.length ? (await pool.query('SELECT * FROM order_items WHERE order_id=ANY($1::uuid[]) ORDER BY id', [ids])).rows : [];
  const events = ids.length ? (await pool.query('SELECT order_id,status,tracking_number,occurred_at,source FROM shipment_events WHERE order_id=ANY($1::uuid[]) ORDER BY occurred_at DESC LIMIT 300',[ids])).rows : [];
  res.json({ orders: result.rows.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id), shipment_events:events.filter(e=>e.order_id===o.id).slice(0,8) })) });
}));
app.get('/api/orders/:id/payment', requireDb, auth, route(async(req,res)=>{
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(req.params.id)) throw fail(404,'Buyurtma topilmadi.');
  const o=(await pool.query('SELECT id,total,status,payment_method,payment_status,tracking_number,created_at FROM orders WHERE id=$1 AND buyer_id=$2',[req.params.id,req.user.id])).rows[0];
  if(!o) throw fail(404,'Buyurtma topilmadi.');
  const pending=o.status==='awaiting_payment' && paymentReady(o.payment_method);
  res.json({id:o.id,total:o.total,status:o.status,paymentStatus:o.payment_status,method:o.payment_method,createdAt:o.created_at,trackingNumber:o.tracking_number,
    paymentUrl:pending?paymentUrl(o.payment_method,o.id,o.total):null,
    clickWidget:pending&&o.payment_method==='click'&&process.env.CLICK_INLINE_ENABLED==='true'&&!!process.env.CLICK_MERCHANT_USER_ID
      ?{service_id:process.env.CLICK_SERVICE_ID,merchant_id:process.env.CLICK_MERCHANT_ID,merchant_user_id:process.env.CLICK_MERCHANT_USER_ID,amount:o.total.toFixed(2),transaction_param:o.id}:null
  });
}));
app.get('/api/orders/:id/payment-link', requireDb, auth, route(async(req,res)=>{
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(req.params.id)) throw fail(404,'Buyurtma topilmadi.');
  const {rows}=await pool.query('SELECT id,total,status,payment_method FROM orders WHERE id=$1 AND buyer_id=$2',[req.params.id,req.user.id]);
  const o=rows[0];if(!o||o.status!=='awaiting_payment'||!paymentReady(o.payment_method)) throw fail(409,'Bu buyurtma uchun to‘lov havolasi mavjud emas.');
  res.json({url:paymentUrl(o.payment_method,o.id,o.total)});
}));
async function cancelOrder(id, buyerId) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const { rows } = await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id]); const o = rows[0]; if (!o || (buyerId && String(o.buyer_id) !== String(buyerId))) throw fail(404,'Buyurtma topilmadi.'); if (!['awaiting_payment','new','accepted','packing'].includes(o.status) || o.payment_status==='paid') throw fail(409,'Bu buyurtmani bekor qilib bo‘lmaydi.'); const reserved=await db.query('SELECT id FROM payment_transactions WHERE order_id=$1 AND state=1 LIMIT 1',[id]); if(reserved.rowCount) throw fail(409,'To‘lov jarayonda. Yakunlanishini kuting.'); await db.query("UPDATE orders SET status='cancelled',payment_status=CASE WHEN payment_status='pending' THEN 'cancelled' ELSE payment_status END,updated_at=now() WHERE id=$1",[id]); await db.query('INSERT INTO shipment_events(order_id,source,status,tracking_number) VALUES($1,$2,$3,$4)',[id,buyerId?'buyer':'admin','cancelled',o.tracking_number]); const items = await db.query('SELECT product_id,variant_id,quantity,stock_reserved FROM order_items WHERE order_id=$1',[id]); for(const x of items.rows){if(x.variant_id&&x.stock_reserved)await db.query('UPDATE product_variants SET stock=stock+$1 WHERE id=$2',[x.quantity,x.variant_id]);await db.query('UPDATE products p SET stock=CASE WHEN p.variant_count>0 THEN (SELECT coalesce(sum(v.stock),0) FROM product_variants v WHERE v.product_id=p.id AND v.active) WHEN $4::bigint IS NULL AND $1::int>0 THEN p.stock+$1 ELSE p.stock END,sold_count=GREATEST(0,sold_count-$2) WHERE p.id=$3',[x.stock_reserved?x.quantity:0,x.quantity,x.product_id,x.variant_id]);} await db.query('COMMIT'); return o; } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
app.post('/api/orders/:id/cancel', requireDb, auth, route(async (req,res) => { await cancelOrder(req.params.id,req.user.id); res.json({ ok:true }); }));

app.post('/api/seller/request', requireDb, auth, route(async (req,res) => {
  if (req.user.role === 'seller') return res.json({ ok:true, status:'approved' });
  if (req.user.seller_status === 'pending') return res.json({ ok:true, status:'pending' });
  await pool.query("UPDATE users SET seller_status='pending' WHERE id=$1 AND role='buyer'",[req.user.id]); res.json({ ok:true, status:'pending' });
}));
app.get('/api/seller/products', requireDb, auth, role('seller'), route(async (req,res) => { const cursor=/^\d+$/.test(String(req.query.cursor||''))?Number(req.query.cursor):null;const { rows } = await pool.query(`SELECT * FROM products WHERE seller_id=$1 ${cursor?'AND id<$2':''} ORDER BY id DESC LIMIT 51`,cursor?[req.user.id,cursor]:[req.user.id]);res.json({products:rows.slice(0,50),nextCursor:rows.length>50?String(rows[49].id):null}); }));
function productInput(body) {
  const specs=body.specifications??{}, gallery=body.gallery??[], variants=body.variants??[];
  if(!specs || Array.isArray(specs) || typeof specs!=='object' || Object.keys(specs).length>24 || !Array.isArray(gallery) || gallery.length>12 || !Array.isArray(variants) || variants.length>30) throw fail(400,'Rasm, xususiyat yoki variantlar soni juda katta.');
  const p = { name:text(body.name,180), description:text(body.description,4000), category:text(body.category,40),subcategory:text(body.subcategory,80),brand:text(body.brand,100),sku:text(body.sku,80), price:Number(body.price), oldPrice:Number(body.oldPrice || 0), stock:Number(body.stock),stockMode:text(body.stockMode||'tracked',20),restockDays:Number(body.restockDays||7), image:text(body.image,1000)||'/assets/product-placeholder.svg', cardBackground:text(body.cardBackground,1000),detailBackground:text(body.detailBackground,1000), externalLinks:externalLinks(body.externalLinks||[]),gallery:gallery.map(x=>text(x,1000)),specifications:Object.fromEntries(Object.entries(specs).map(([k,v])=>[text(k,70),text(v,200)])),variants:variants.map(v=>({id:v.id?Number(v.id):null,label:text(v.label,100),sku:text(v.sku,80),price:Number(v.price),stock:Number(v.stock),image:text(v.image,1000)})) };
  if (p.name.length < 3 || !site.categories.some(c=>c.id === p.category) || !Number.isSafeInteger(p.price) || p.price < 1000 || p.price > 1e9 || !Number.isSafeInteger(p.stock) || p.stock < 0 || p.stock > 100000 || !['tracked','replenishable'].includes(p.stockMode) || !Number.isSafeInteger(p.restockDays) || p.restockDays<1 || p.restockDays>90 || !imageOk(p.image) || (p.cardBackground&&!imageOk(p.cardBackground)) || (p.detailBackground&&!imageOk(p.detailBackground)) || !Number.isSafeInteger(p.oldPrice) || p.oldPrice < 0 || p.oldPrice > 1e9) throw fail(400,'Mahsulot nomi, narxi, soni va rasmlarini tekshiring.');
  if(p.gallery.some(x=>!imageOk(x)) || Object.entries(p.specifications).some(([k,v])=>!k||!v) || p.variants.some(v=>(v.id!==null&&(!Number.isSafeInteger(v.id)||v.id<1))||!v.label||!Number.isSafeInteger(v.price)||v.price<1000||v.price>1e9||!Number.isSafeInteger(v.stock)||v.stock<0||v.stock>100000||(v.image&&!imageOk(v.image)))) throw fail(400,'Galereya, xususiyat yoki variantlarni tekshiring.');
  if(new Set(p.variants.filter(v=>v.id).map(v=>v.id)).size!==p.variants.filter(v=>v.id).length || new Set(p.variants.filter(v=>v.sku).map(v=>v.sku.toLowerCase())).size!==p.variants.filter(v=>v.sku).length) throw fail(400,'Variant ID yoki SKU takrorlangan.');
  return p;
}
async function checkSubcategory(db,p){
  if(!p.subcategory)return;
  const found=await db.query('SELECT 1 FROM product_subcategories WHERE category=$1 AND name=$2',[p.category,p.subcategory]);
  if(!found.rowCount)throw fail(400,'Quyi kategoriya tanlangan kategoriyaga mos emas.');
}
async function saveProduct(db,p,{id=null,sellerId=null,status='pending'}={}){
  await checkSubcategory(db,p);
  const values=[p.name,p.description,p.category,p.subcategory,p.brand,p.sku,p.price,p.oldPrice||null,p.variants.length?0:p.stock,p.stockMode,p.restockDays,p.image,p.cardBackground,p.detailBackground,JSON.stringify(p.externalLinks),JSON.stringify(p.gallery),JSON.stringify(p.specifications),status];
  let product;
  if(id){
    const existing=(await db.query('SELECT id,seller_id,status FROM products WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!existing || (sellerId!==null && String(existing.seller_id)!==String(sellerId)) || (sellerId!==null&&existing.status==='archived'))throw fail(404,'Mahsulot topilmadi.');
    product=(await db.query(`UPDATE products SET name=$1,description=$2,category=$3,subcategory=$4,brand=$5,sku=$6,price=$7,old_price=$8,stock=$9,stock_mode=$10,restock_days=$11,image_url=$12,card_background=$13,detail_background=$14,external_links=$15,gallery=$16,specifications=$17,status=$18,updated_at=now() WHERE id=$19 RETURNING *`,[...values,id])).rows[0];
  }else{
    product=(await db.query(`INSERT INTO products(seller_id,name,description,category,subcategory,brand,sku,price,old_price,stock,stock_mode,restock_days,image_url,card_background,detail_background,external_links,gallery,specifications,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,[sellerId,...values])).rows[0];
  }
  const keep=p.variants.filter(v=>v.id).map(v=>v.id);
  await db.query('UPDATE product_variants SET active=false WHERE product_id=$1 AND active=true AND NOT(id=ANY($2::bigint[]))',[product.id,keep]);
  for(const [position,v] of p.variants.entries()){
    if(v.id){const result=await db.query('UPDATE product_variants SET label=$1,sku=$2,price=$3,stock=$4,image_url=$5,active=true,position=$6,updated_at=now() WHERE id=$7 AND product_id=$8 RETURNING id',[v.label,v.sku,v.price,v.stock,v.image,position,v.id,product.id]);if(!result.rowCount)throw fail(400,'Variant ushbu mahsulotga tegishli emas.');}
    else await db.query('INSERT INTO product_variants(product_id,label,sku,price,stock,image_url,position) VALUES($1,$2,$3,$4,$5,$6,$7)',[product.id,v.label,v.sku,v.price,v.stock,v.image,position]);
  }
  if(p.variants.length)product=(await db.query('UPDATE products SET stock=(SELECT coalesce(sum(stock),0) FROM product_variants WHERE product_id=$1 AND active),price=(SELECT min(price) FROM product_variants WHERE product_id=$1 AND active),variant_count=$2 WHERE id=$1 RETURNING *',[product.id,p.variants.length])).rows[0];
  else product=(await db.query('UPDATE products SET variant_count=0 WHERE id=$1 RETURNING *',[product.id])).rows[0];
  return product;
}
async function saveProductRequest(req,{id=null,sellerId=null,status='pending'}={}){
  const p=productInput(req.body),db=await pool.connect();
  try {await db.query('BEGIN');const product=await saveProduct(db,p,{id,sellerId,status});await db.query('COMMIT');return product;}
  catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
app.get('/api/subcategories',route(async(req,res)=>{if(demoOnly)return res.json({subcategories:[]});const {rows}=await pool.query('SELECT id,category,name FROM product_subcategories WHERE category=ANY($1::text[]) ORDER BY category,name',[site.categories.map(c=>c.id)]);res.json({subcategories:rows});}));
app.get('/api/admin/subcategories', requireDb, auth, role('admin'),route(async(req,res)=>{const {rows}=await pool.query('SELECT id,category,name FROM product_subcategories ORDER BY category,name');res.json({subcategories:rows});}));
app.post('/api/admin/subcategories', requireDb, auth, role('admin'),route(async(req,res)=>{const category=text(req.body.category,40),name=text(req.body.name,80);if(!site.categories.some(x=>x.id===category)||name.length<2)throw fail(400,'Kategoriya va quyi kategoriya nomini tekshiring.');const {rows}=await pool.query('INSERT INTO product_subcategories(category,name) VALUES($1,$2) ON CONFLICT(category,name) DO UPDATE SET name=excluded.name RETURNING *',[category,name]);res.status(201).json({subcategory:rows[0]});}));
app.delete('/api/admin/subcategories/:id', requireDb, auth, role('admin'),route(async(req,res)=>{const row=(await pool.query('SELECT category,name FROM product_subcategories WHERE id=$1',[req.params.id])).rows[0];if(!row)throw fail(404,'Quyi kategoriya topilmadi.');const used=await pool.query("SELECT 1 FROM products WHERE category=$1 AND subcategory=$2 AND status!='archived' LIMIT 1",[row.category,row.name]);if(used.rowCount)throw fail(409,'Bu quyi kategoriyada mahsulotlar bor.');await pool.query('DELETE FROM product_subcategories WHERE id=$1',[req.params.id]);res.json({ok:true});}));
app.get('/api/seller/products/:id',requireDb,auth,role('seller'),route(async(req,res)=>{const product=(await pool.query("SELECT * FROM products WHERE id=$1 AND seller_id=$2",[req.params.id,req.user.id])).rows[0];if(!product)throw fail(404,'Mahsulot topilmadi.');product.variants=(await pool.query('SELECT id,label,sku,price,stock,image_url FROM product_variants WHERE product_id=$1 AND active ORDER BY position,id',[product.id])).rows;res.json({product});}));
app.post('/api/seller/products', requireDb, auth, role('seller'), route(async (req,res) => { const product=await saveProductRequest(req,{sellerId:req.user.id});res.status(201).json({product}); }));
app.patch('/api/seller/products/:id', requireDb, auth, role('seller'), route(async (req,res) => { const product=await saveProductRequest(req,{id:req.params.id,sellerId:req.user.id});res.json({product}); }));
app.delete('/api/seller/products/:id', requireDb, auth, role('seller'), route(async (req,res) => { const result=await pool.query("UPDATE products SET status='archived',updated_at=now() WHERE id=$1 AND seller_id=$2 RETURNING id",[req.params.id,req.user.id]); if(!result.rowCount) throw fail(404,'Mahsulot topilmadi.'); res.json({ok:true}); }));
app.get('/api/seller/orders', requireDb, auth, role('seller'), route(async (req,res) => { const { rows }=await pool.query('SELECT i.*,o.status AS order_status,o.created_at,o.region,o.district,o.recipient,o.phone FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.seller_id=$1 ORDER BY o.created_at DESC LIMIT 100',[req.user.id]); res.json({items:rows}); }));
app.patch('/api/seller/order-items/:id', requireDb, auth, role('seller'), route(async (req,res) => { const status=text(req.body.status,20); if(!['packing','ready'].includes(status)) throw fail(400,'Status xato.'); const {rows}=await pool.query("UPDATE order_items i SET fulfillment_status=$1 FROM orders o WHERE i.id=$2 AND i.seller_id=$3 AND i.order_id=o.id AND o.status NOT IN ('awaiting_payment','cancelled','delivered') RETURNING i.*",[status,req.params.id,req.user.id]); if(!rows[0]) throw fail(404,'Buyurtma topilmadi.'); res.json({item:rows[0]}); }));

app.get('/api/admin/overview', requireDb, auth, role('admin'), route(async (req,res) => { const {rows}=await pool.query("SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM users WHERE seller_status='pending') AS seller_requests,(SELECT count(*)::int FROM products WHERE status='pending') AS pending_products,(SELECT count(*)::int FROM products WHERE status='active') AS active_products,(SELECT count(*)::int FROM orders WHERE status!='cancelled') AS orders,(SELECT coalesce(sum(subtotal),0)::bigint FROM orders WHERE status!='cancelled') AS order_value"); res.json({stats:rows[0]}); }));
app.get('/api/admin/sellers', requireDb, auth, role('admin'), route(async (req,res) => { const {rows}=await pool.query("SELECT id,full_name,email,phone,role,seller_status,created_at FROM users WHERE seller_status IN ('pending','approved','rejected') ORDER BY created_at DESC LIMIT 100"); res.json({sellers:rows}); }));
app.patch('/api/admin/sellers/:id', requireDb, auth, role('admin'), route(async (req,res) => { const status=text(req.body.status,20); if(!['approved','rejected'].includes(status)) throw fail(400,'Status xato.'); const {rows}=await pool.query("UPDATE users SET seller_status=$1,role=CASE WHEN $3 THEN 'seller' ELSE 'buyer' END WHERE id=$2 AND role!='admin' RETURNING id,full_name,email,seller_status",[status,req.params.id,status==='approved']); if(!rows[0]) throw fail(404,'Sotuvchi topilmadi.'); res.json({seller:rows[0]}); }));
app.get('/api/admin/products', requireDb, auth, role('admin'), route(async (req,res) => { const cursor=decodeCursor(req.query.cursor,'admin','','');let where='';const params=[];if(cursor){params.push(cursor[3],cursor[4]);where="WHERE (CASE WHEN p.status='pending' THEN 0 ELSE 1 END)>$1 OR ((CASE WHEN p.status='pending' THEN 0 ELSE 1 END)=$1 AND p.id<$2)";}const {rows}=await pool.query(`SELECT p.*,u.full_name AS seller_name FROM products p LEFT JOIN users u ON u.id=p.seller_id ${where} ORDER BY CASE WHEN p.status='pending' THEN 0 ELSE 1 END,p.id DESC LIMIT 51`,params);const products=rows.slice(0,50),last=products.at(-1);res.json({products,nextCursor:rows.length>50?encodeCursor(['admin','','',last.status==='pending'?0:1,Number(last.id)]):null}); }));
app.get('/api/admin/products/:id/details', requireDb,auth,role('admin'),route(async(req,res)=>{const product=(await pool.query('SELECT * FROM products WHERE id=$1',[req.params.id])).rows[0];if(!product)throw fail(404,'Mahsulot topilmadi.');product.variants=(await pool.query('SELECT id,label,sku,price,stock,image_url FROM product_variants WHERE product_id=$1 AND active ORDER BY position,id',[product.id])).rows;res.json({product});}));
app.post('/api/admin/products', requireDb, auth, role('admin'), route(async(req,res)=>{
  const status=text(req.body.status,20);
  if(!['active','pending'].includes(status)) throw fail(400,'Yangi mahsulot holati xato.');
  const product=await saveProductRequest(req,{status});res.status(201).json({product});
}));
app.patch('/api/admin/products/:id', requireDb, auth, role('admin'), route(async (req,res) => { const status=text(req.body.status,20); if(!['active','rejected','archived'].includes(status)) throw fail(400,'Status xato.'); const {rows}=await pool.query('UPDATE products SET status=$1,updated_at=now() WHERE id=$2 RETURNING *',[status,req.params.id]); if(!rows[0]) throw fail(404,'Mahsulot topilmadi.'); res.json({product:rows[0]}); }));
app.patch('/api/admin/products/:id/details', requireDb, auth, role('admin'), route(async(req,res)=>{
  const status=text(req.body.status,20);
  if(!['active','pending','rejected','archived'].includes(status)) throw fail(400,'Mahsulot holati xato.');
  const product=await saveProductRequest(req,{id:req.params.id,status});res.json({product});
}));
const manageProducts=(req,res,next)=>['admin','seller'].includes(req.user?.role)?next():next(fail(403,'Mahsulotlarni boshqarish uchun ruxsat yo‘q.'));
app.get('/api/catalog-tools/template.xlsx',requireDb,auth,manageProducts,route(async(req,res)=>{res.set('Cache-Control','no-store').set('Content-Disposition','attachment; filename="marketuz-mahsulotlar.xlsx"').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(await templateWorkbook());}));
async function readProductWorkbook(req){
  const data=req.body?.data;
  if(typeof data!=='string'||data.length>1_650_000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw fail(400,'Excel fayl formati xato.');
  let rows;try{rows=await parseWorkbook(Buffer.from(data,'base64'));}catch(e){throw fail(400,e.message||'Excel faylni o‘qib bo‘lmadi.');}
  const parsed=rows.map(p=>productInput(p));
  for(const p of parsed)await checkSubcategory(pool,p);
  return parsed;
}
app.post('/api/products/import/preview',requireDb,auth,manageProducts,route(async(req,res)=>{const products=await readProductWorkbook(req);res.json({count:products.length,variants:products.reduce((n,p)=>n+p.variants.length,0),products:products.map(p=>({sku:p.sku,name:p.name,category:p.category,subcategory:p.subcategory,price:p.price,variants:p.variants.length,image:p.image}))});}));
app.post('/api/products/import/commit',requireDb,auth,manageProducts,route(async(req,res)=>{
  const products=await readProductWorkbook(req),db=await pool.connect();
  try{
    await db.query('BEGIN');
    for(const p of products){
      const duplicate=await db.query("SELECT id FROM products WHERE coalesce(seller_id,0)=$1 AND lower(sku)=lower($2) AND status!='archived' LIMIT 1",[req.user.role==='seller'?req.user.id:0,p.sku]);
      if(duplicate.rowCount)throw fail(409,`${p.sku} SKU allaqachon mavjud. Import bekor qilindi.`);
      await saveProduct(db,p,{sellerId:req.user.role==='seller'?req.user.id:null,status:'pending'});
    }
    await db.query('COMMIT');res.status(201).json({count:products.length,message:`${products.length} ta mahsulot tekshiruv ro‘yxatiga qo‘shildi.`});
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}));
app.get('/api/admin/orders', requireDb, auth, role('admin'), route(async (req,res) => { const {rows}=await pool.query('SELECT o.*,u.email AS buyer_email FROM orders o JOIN users u ON u.id=o.buyer_id ORDER BY o.created_at DESC LIMIT 100'); res.json({orders:rows}); }));
app.patch('/api/admin/orders/:id', requireDb, auth, role('admin'), route(async (req,res) => {
  const status=text(req.body.status,24),tracking=text(req.body.trackingNumber,100);
  if(!['new','accepted','packing','handed_over','in_transit','delivered','cancelled'].includes(status)) throw fail(400,'Status xato.');
  if(status==='cancelled'){await cancelOrder(req.params.id,null);return res.json({ok:true});}
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(req.params.id)) throw fail(404,'Buyurtma topilmadi.');
  if(tracking&&!/^[\w -]{5,100}$/.test(tracking)) throw fail(400,'Kuzatuv raqami xato.');
  const db=await pool.connect();
  try{
    await db.query('BEGIN');
    const current=(await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
    if(!current||!canAdvanceOrder(current.status,status)||['awaiting_payment','cancelled'].includes(current.status)) throw fail(409,'Buyurtma holatini bu tartibda o‘zgartirib bo‘lmaydi.');
    const trackingNumber=tracking||current.tracking_number||null;
    if(['handed_over','in_transit','delivered'].includes(status)&&!trackingNumber) throw fail(400,'Jo‘natishdan oldin UzPost kuzatuv raqamini kiriting.');
    let order=current;
    if(status!==current.status||trackingNumber!==current.tracking_number){
      order=(await db.query('UPDATE orders SET status=$1,tracking_number=$2,updated_at=now() WHERE id=$3 RETURNING *',[status,trackingNumber,current.id])).rows[0];
      await db.query('INSERT INTO shipment_events(order_id,source,status,tracking_number) VALUES($1,$2,$3,$4)',[order.id,'admin',status,trackingNumber]);
    }
    await db.query('COMMIT');res.json({order});
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}));

mountPayments(app,pool,gatewayConfigured);

const htmlEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const absolute=(url,base)=>{try{return new URL(url,base).href;}catch{return base;}};
app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nSitemap: ${site.seo.siteUrl}/sitemap.xml\n`));
app.get('/sitemap.xml',route(async(req,res)=>{
  const urls=['/','/catalog','/discover','/delivery','/terms','/privacy'];
  if(pool){const {rows}=await pool.query("SELECT id FROM products WHERE status='active' ORDER BY id DESC LIMIT 10000"); urls.push(...rows.map(x=>`/product/${x.id}`));}
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${htmlEsc(site.seo.siteUrl+u)}</loc></url>`).join('')}</urlset>`);
}));
app.use(express.static(path.join(root,'public'),{ maxAge: '1h', index: false }));
const shell=await readFile(path.join(root,'public','index.html'),'utf8');
app.get('*', route(async (req,res) => {
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'API manzili topilmadi.'});
  let title=site.seo.title, description=site.seo.description, picture=site.seo.ogImage, type='website', structured='';
  const match=req.path.match(/^\/product\/(\d+)$/);
  if(match){
    const p=pool?(await pool.query("SELECT id,name,description,price,stock,stock_mode,image_url FROM products WHERE id=$1 AND status='active'",[match[1]])).rows[0]:inMemoryCatalog.find(x=>x.id===Number(match[1]));
    if(p){title=`${p.name} | ${site.brand.name}`;description=p.description.slice(0,230)||site.seo.description;picture=p.image_url;type='product';structured=`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',name:p.name,description:p.description,image:absolute(p.image_url,site.seo.siteUrl),offers:{'@type':'Offer',priceCurrency:'UZS',price:p.price,availability:p.stock_mode==='replenishable'?'https://schema.org/PreOrder':p.stock>0?'https://schema.org/InStock':'https://schema.org/OutOfStock',url:site.seo.siteUrl+req.path}}).replace(/</g,'\\u003c')}</script>`;}
  }
  const canonical=site.seo.siteUrl+req.path;
  const extra=`<link rel="canonical" href="${htmlEsc(canonical)}"><meta property="og:type" content="${type}"><meta property="og:site_name" content="${htmlEsc(site.brand.name)}"><meta property="og:title" content="${htmlEsc(title)}"><meta property="og:description" content="${htmlEsc(description)}"><meta property="og:image" content="${htmlEsc(absolute(picture,site.seo.siteUrl))}"><meta property="og:url" content="${htmlEsc(canonical)}"><meta name="twitter:card" content="summary_large_image"><meta name="keywords" content="${htmlEsc(site.seo.keywords)}">${structured}`;
  res.set('Cache-Control','no-store').type('html').send(shell.replace(/<title>[^<]*<\/title>/,`<title>${htmlEsc(title)}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${htmlEsc(description)}">`).replace('</head>',`<link rel="icon" href="${htmlEsc(site.brand.favicon||'/favicon.svg')}"><link rel="manifest" href="/manifest.webmanifest">${extra}</head>`));
}));
app.use((err,req,res,next) => { if(res.headersSent) return next(err); if(!err.status || err.status >= 500) console.error('Request error:', err.message); res.status(err.status || 500).json({ error: err.status ? err.message : 'Serverda xatolik yuz berdi. Keyinroq urinib ko‘ring.' }); });

async function initialize() {
  if (!pool) { console.warn('DATABASE_URL yo‘q: faqat namoyish katalogi ishlaydi.'); return; }
  for (let attempt = 1; attempt <= 8; attempt++) {
    try { await pool.query(await readFile(path.join(root,'schema.sql'),'utf8')); break; }
    catch (e) { if(attempt === 8) throw e; console.warn('Database initialization retry', attempt, e.message); await new Promise(r=>setTimeout(r,2000)); }
  }
  const saved=await pool.query("SELECT value FROM site_settings WHERE key='site'");
  if(saved.rows[0]) { try { site=validateSite(saved.rows[0].value); } catch(e) { console.error('Invalid site settings:',e.message); } }
  if(process.env.MARKETUZ_URL){
    const publicUrl=new URL(process.env.MARKETUZ_URL);
    if(publicUrl.protocol!=='https:'||publicUrl.username||publicUrl.password||publicUrl.pathname!=='/'||publicUrl.search||publicUrl.hash)throw new Error('MARKETUZ_URL must be an HTTPS origin.');
    site.seo.siteUrl=publicUrl.origin;
  }
  const count = await pool.query('SELECT count(*)::int AS n FROM products');
  if (!count.rows[0].n) {
    for (const p of samples) await pool.query("INSERT INTO products(name,description,category,price,old_price,stock,image_url,badge,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active')",p);
    console.log('Sample product catalog initialized.');
  } else {
    for (const p of featuredSamples) await pool.query("INSERT INTO products(name,description,category,price,old_price,stock,image_url,badge,status) SELECT $1::varchar(180),$2,$3,$4,$5,$6,$7,$8,'active' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name=$1::varchar(180) AND seller_id IS NULL)",p);
  }
  await pool.query("UPDATE products SET image_url=$1,updated_at=now() WHERE seller_id IS NULL AND name=$2 AND image_url<>$1", ['/assets/product-mini-bag.webp','Urban mini sumka']);
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase(), adminPassword = process.env.ADMIN_PASSWORD;
  if(adminEmail && adminPassword) {
    if(!emailOk(adminEmail) || adminPassword.length < 16) throw new Error('ADMIN_EMAIL/ADMIN_PASSWORD configuration is invalid.');
    const existing = await pool.query('SELECT role FROM users WHERE email=$1',[adminEmail]);
    if(existing.rows[0] && existing.rows[0].role !== 'admin') throw new Error('Configured ADMIN_EMAIL already belongs to another user.');
    if(!existing.rows[0]) await pool.query("INSERT INTO users(full_name,email,password_hash,role) VALUES('Marketuz admin',$1,$2,'admin')",[adminEmail,await hashPassword(adminPassword)]);
  }
}
await initialize();
if(pool){
  const prune=()=>pool.query("DELETE FROM product_events WHERE id IN (SELECT id FROM product_events WHERE created_at<now()-interval '90 days' ORDER BY id LIMIT 5000)").catch(e=>console.error('Activity pruning:',e.message));
  prune();setInterval(prune,60*60_000).unref();
  const expire=async()=>{
    try{
      const {rows}=await pool.query("SELECT id FROM orders WHERE status='awaiting_payment' AND created_at<now()-interval '60 minutes' ORDER BY created_at LIMIT 30");
      for(const {id} of rows){try{await cancelOrder(id,null);}catch(e){if(e.status!==409)console.error('Pending order expiration:',e.message);}}
    }catch(e){console.error('Pending order expiration:',e.message);}
  };
  expire();setInterval(expire,5*60_000).unref();
}
const server = app.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('Marketuz listening on port',server.address().port));
process.on('SIGTERM',()=>server.close(()=>pool?.end()));
