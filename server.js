import express from 'express';
import pg from 'pg';
import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, products as samples, featuredSamples, regions } from './seed.js';

const scrypt = promisify(scryptCallback);
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const secret = process.env.SESSION_SECRET || randomBytes(48).toString('hex');
const demoOnly = !process.env.DATABASE_URL;
const pool = demoOnly ? null : new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false
});
pool?.on('error', error => console.error('Database pool error:', error.message));
const inMemoryCatalog = samples.map((p, i) => ({ id: i + 1, seller_id: null, name: p[0], description: p[1], category: p[2], price: p[3], old_price: p[4], stock: p[5], image_url: p[6], badge: p[7], status: 'active' }));

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https://images.unsplash.com; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use('/api', (req, res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && (() => { try { return new URL(origin).host !== req.get('host'); } catch { return true; } })()) return res.status(403).json({ error: 'So‘rov manbasi tasdiqlanmadi.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON ma’lumot yuboring.' });
  }
  next();
});

const fail = (status, message) => Object.assign(new Error(message), { status });
const route = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
const requireDb = (req, res, next) => demoOnly ? res.status(503).json({ error: 'Sinov katalogi faol. Hisob va buyurtmalar uchun ma’lumotlar bazasini ulang.' }) : next();
const emailOk = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
const text = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const imageOk = value => { try { const u = new URL(value); return u.protocol === 'https:' && value.length <= 1000; } catch { return false; } };
const hashPassword = async password => { const salt = randomBytes(16).toString('hex'); const key = await scrypt(password, salt, 64); return salt + ':' + key.toString('hex'); };
const verifyPassword = async (password, encoded) => { const [salt, hash] = (encoded || '').split(':'); if (!salt || !hash || hash.length !== 128) return false; const actual = await scrypt(password, salt, 64); return timingSafeEqual(Buffer.from(hash, 'hex'), actual); };
function tokenFor(id) { const payload = Buffer.from(JSON.stringify({ id: String(id), exp: Date.now() + 7 * 864e5 })).toString('base64url'); return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url'); }
function tokenId(value) {
  try { const [payload, signature] = value.split('.'); if (!payload || !signature) return null; const expected = createHmac('sha256', secret).update(payload).digest(); const actual = Buffer.from(signature, 'base64url'); if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null; const obj = JSON.parse(Buffer.from(payload, 'base64url').toString()); return obj.exp > Date.now() && /^\d+$/.test(obj.id) ? obj.id : null; } catch { return null; }
}
function cookieValue(req, name) { const found = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '=')); return found?.slice(name.length + 1); }
const setSession = (res, id) => res.cookie('marketuz_session', tokenFor(id), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 864e5 });
const auth = route(async (req, res, next) => { const id = tokenId(cookieValue(req, 'marketuz_session') || ''); if (!id) throw fail(401, 'Davom etish uchun hisobingizga kiring.'); const { rows } = await pool.query('SELECT id, full_name, email, phone, role, seller_status FROM users WHERE id=$1', [id]); if (!rows[0]) throw fail(401, 'Hisob topilmadi.'); req.user = rows[0]; next(); });
const role = name => (req, res, next) => req.user?.role === name ? next() : next(fail(403, 'Ushbu bo‘lim uchun ruxsat yo‘q.'));
const authHits = new Map();
const rateAuth = (req, res, next) => { const key = req.ip || 'unknown', now = Date.now(); const hit = authHits.get(key) || { n: 0, until: now + 15 * 60_000 }; if (hit.until < now) { hit.n = 0; hit.until = now + 15 * 60_000; } if (++hit.n > 25) return res.status(429).json({ error: 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.' }); authHits.set(key, hit); next(); };
setInterval(() => { for (const [key, value] of authHits) if (value.until < Date.now()) authHits.delete(key); }, 20 * 60_000).unref();

app.get('/api/healthz', route(async (req, res) => { if (pool) await pool.query('SELECT 1'); res.json({ ok: true, database: pool ? 'ready' : 'preview' }); }));
app.get('/api/config', (req, res) => res.json({ categories, regions, demoOnly, payments: ['cod'], shipping: 'manual' }));
app.get('/api/catalog', route(async (req, res) => {
  const q = text(req.query.q, 80), category = text(req.query.category, 40), sort = text(req.query.sort, 20);
  const page = Math.min(100, Math.max(1, Number.parseInt(req.query.page, 10) || 1)), limit = 16;
  const order = { newest: 'created_at DESC, id DESC', price_asc: 'price ASC, id DESC', price_desc: 'price DESC, id DESC', popular: 'id ASC' }[sort] || 'created_at DESC, id DESC';
  if (demoOnly) { let p = inMemoryCatalog.filter(x => (!q || (x.name + ' ' + x.description).toLowerCase().includes(q.toLowerCase())) && (!category || x.category === category)); p = sort === 'price_asc' ? p.sort((a,b) => a.price-b.price) : sort === 'price_desc' ? p.sort((a,b) => b.price-a.price) : p; return res.json({ products: p.slice((page-1)*limit,page*limit), total: p.length, page, pages: Math.ceil(p.length/limit) }); }
  const where = ['status=$1']; const params = ['active'];
  if (q) { params.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%'); where.push(`(name ILIKE $${params.length} ESCAPE '\\' OR description ILIKE $${params.length} ESCAPE '\\')`); }
  if (category && categories.some(c => c.id === category)) { params.push(category); where.push(`category=$${params.length}`); }
  const condition = where.join(' AND ');
  const count = await pool.query(`SELECT count(*)::int AS total FROM products WHERE ${condition}`, params);
  params.push(limit, (page-1)*limit);
  const data = await pool.query(`SELECT id, seller_id, name, description, category, price, old_price, stock, image_url, badge, created_at FROM products WHERE ${condition} ORDER BY ${order} LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  const total = count.rows[0].total; res.json({ products: data.rows, total, page, pages: Math.ceil(total/limit) });
}));
app.get('/api/products/:id', route(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) throw fail(404, 'Mahsulot topilmadi.');
  if (demoOnly) { const product = inMemoryCatalog.find(p => p.id === Number(req.params.id)); if (!product) throw fail(404, 'Mahsulot topilmadi.'); return res.json({ product }); }
  const { rows } = await pool.query("SELECT p.id,p.name,p.description,p.category,p.price,p.old_price,p.stock,p.image_url,p.badge,p.created_at,u.full_name AS seller_name FROM products p LEFT JOIN users u ON p.seller_id=u.id WHERE p.id=$1 AND p.status='active'", [req.params.id]);
  if (!rows[0]) throw fail(404, 'Mahsulot topilmadi.'); res.json({ product: rows[0] });
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
app.post('/api/auth/logout', (req, res) => { res.clearCookie('marketuz_session', { path: '/' }); res.json({ ok: true }); });
app.get('/api/me', requireDb, auth, (req, res) => res.json({ user: req.user }));
app.patch('/api/me', requireDb, auth, route(async (req, res) => {
  const name = text(req.body.name), phone = text(req.body.phone, 30);
  if (name.length < 2 || (phone && !/^\+?[\d\s()-]{9,25}$/.test(phone))) throw fail(400, 'Ism yoki telefon raqami xato.');
  const { rows } = await pool.query('UPDATE users SET full_name=$1, phone=$2 WHERE id=$3 RETURNING id,full_name,email,phone,role,seller_status', [name, phone, req.user.id]); res.json({ user: rows[0] });
}));
app.post('/api/me/password', requireDb, auth, rateAuth, route(async (req, res) => {
  const old = String(req.body.currentPassword || ''), next = String(req.body.newPassword || '');
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await verifyPassword(old, rows[0].password_hash))) throw fail(400, 'Joriy parol xato.');
  if (next.length < 10 || next.length > 128) throw fail(400, 'Yangi parol kamida 10 belgidan iborat bo‘lsin.');
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(next),req.user.id]); res.json({ ok: true });
}));
app.get('/api/favorites', requireDb, auth, route(async (req, res) => {
  const { rows } = await pool.query("SELECT p.id,p.name,p.description,p.category,p.price,p.old_price,p.stock,p.image_url,p.badge FROM favorites f JOIN products p ON p.id=f.product_id WHERE f.user_id=$1 AND p.status='active' ORDER BY p.id DESC", [req.user.id]); res.json({ products: rows });
}));
app.put('/api/favorites/:id', requireDb, auth, route(async (req, res) => { const { rowCount } = await pool.query("INSERT INTO favorites(user_id,product_id) SELECT $1,id FROM products WHERE id=$2 AND status='active' ON CONFLICT DO NOTHING", [req.user.id,req.params.id]); res.json({ ok: true, added: !!rowCount }); }));
app.delete('/api/favorites/:id', requireDb, auth, route(async (req, res) => { await pool.query('DELETE FROM favorites WHERE user_id=$1 AND product_id=$2', [req.user.id,req.params.id]); res.json({ ok: true }); }));

app.post('/api/orders', requireDb, auth, route(async (req, res) => {
  const body = req.body, recipient = text(body.recipient), phone = text(body.phone,30), region = text(body.region,80), district = text(body.district,100), address = text(body.address,300), note = text(body.note,500);
  if (recipient.length < 2 || !/^\+?[\d\s()-]{9,25}$/.test(phone) || !regions.includes(region) || district.length < 2 || address.length < 5) throw fail(400, 'Qabul qiluvchi va manzil ma’lumotlarini to‘liq kiriting.');
  if (body.paymentMethod !== 'cod') throw fail(400, 'Hozir faqat yetkazilganda to‘lov uchun so‘rov qabul qilinadi.');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 30) throw fail(400, 'Savat bo‘sh yoki juda katta.');
  const items = body.items.map(x => ({ id: Number(x.id), qty: Number(x.qty) }));
  if (items.some(x => !Number.isSafeInteger(x.id) || x.id < 1 || !Number.isSafeInteger(x.qty) || x.qty < 1 || x.qty > 20) || new Set(items.map(x => x.id)).size !== items.length) throw fail(400, 'Savat ma’lumotlari xato.');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const ids = items.map(x => x.id).sort((a,b) => a-b);
    const locked = await db.query('SELECT id,name,price,stock,image_url,seller_id FROM products WHERE id=ANY($1::bigint[]) AND status=$2 ORDER BY id FOR UPDATE', [ids,'active']);
    if (locked.rows.length !== ids.length) throw fail(409, 'Savatdagi ayrim mahsulotlar endi mavjud emas.');
    let subtotal = 0; const detailed = [];
    for (const p of locked.rows) { const qty = items.find(i => i.id === Number(p.id)).qty; if (p.stock < qty) throw fail(409, `${p.name}: ombordagi miqdor yetarli emas.`); subtotal += p.price * qty; detailed.push({ ...p, qty }); }
    const id = randomUUID();
    await db.query('INSERT INTO orders(id,buyer_id,recipient,phone,region,district,address,note,payment_method,subtotal,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)', [id,req.user.id,recipient,phone,region,district,address,note,'cod',subtotal]);
    for (const p of detailed) {
      await db.query('UPDATE products SET stock=stock-$1, updated_at=now() WHERE id=$2', [p.qty,p.id]);
      await db.query('INSERT INTO order_items(order_id,product_id,seller_id,title,image_url,price,quantity) VALUES($1,$2,$3,$4,$5,$6,$7)', [id,p.id,p.seller_id,p.name,p.image_url,p.price,p.qty]);
    }
    await db.query('COMMIT'); res.status(201).json({ id, subtotal, status: 'new', message: 'Buyurtma so‘rovi qabul qilindi. Yetkazish narxi operator tasdiqlagach aniqlanadi.' });
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}));
app.get('/api/orders', requireDb, auth, route(async (req, res) => {
  const result = await pool.query('SELECT * FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  const ids = result.rows.map(o => o.id);
  const items = ids.length ? (await pool.query('SELECT * FROM order_items WHERE order_id=ANY($1::uuid[]) ORDER BY id', [ids])).rows : [];
  res.json({ orders: result.rows.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) })) });
}));
async function cancelOrder(id, buyerId) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const { rows } = await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id]); const o = rows[0]; if (!o || (buyerId && String(o.buyer_id) !== String(buyerId))) throw fail(404,'Buyurtma topilmadi.'); if (!['new','accepted','packing'].includes(o.status)) throw fail(409,'Bu buyurtmani bekor qilib bo‘lmaydi.'); await db.query("UPDATE orders SET status='cancelled',updated_at=now() WHERE id=$1",[id]); const items = await db.query('SELECT product_id,quantity FROM order_items WHERE order_id=$1',[id]); for(const x of items.rows) await db.query('UPDATE products SET stock=stock+$1 WHERE id=$2',[x.quantity,x.product_id]); await db.query('COMMIT'); return o; } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
app.post('/api/orders/:id/cancel', requireDb, auth, route(async (req,res) => { await cancelOrder(req.params.id,req.user.id); res.json({ ok:true }); }));

app.post('/api/seller/request', requireDb, auth, route(async (req,res) => {
  if (req.user.role === 'seller') return res.json({ ok:true, status:'approved' });
  if (req.user.seller_status === 'pending') return res.json({ ok:true, status:'pending' });
  await pool.query("UPDATE users SET seller_status='pending' WHERE id=$1 AND role='buyer'",[req.user.id]); res.json({ ok:true, status:'pending' });
}));
app.get('/api/seller/products', requireDb, auth, role('seller'), route(async (req,res) => { const { rows } = await pool.query('SELECT * FROM products WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id]); res.json({ products: rows }); }));
function productInput(body) {
  const p = { name:text(body.name,180), description:text(body.description,2000), category:text(body.category,40), price:Number(body.price), oldPrice:Number(body.oldPrice || 0), stock:Number(body.stock), image:text(body.image,1000) };
  if (p.name.length < 3 || !categories.some(c=>c.id === p.category) || !Number.isSafeInteger(p.price) || p.price < 1000 || p.price > 1e9 || !Number.isSafeInteger(p.stock) || p.stock < 0 || p.stock > 100000 || !imageOk(p.image) || p.oldPrice < 0 || p.oldPrice > 1e9) throw fail(400,'Mahsulot nomi, narxi, soni va HTTPS rasm havolasini tekshiring.');
  return p;
}
app.post('/api/seller/products', requireDb, auth, role('seller'), route(async (req,res) => { const p = productInput(req.body); const { rows } = await pool.query("INSERT INTO products(seller_id,name,description,category,price,old_price,stock,image_url,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *",[req.user.id,p.name,p.description,p.category,p.price,p.oldPrice||null,p.stock,p.image]); res.status(201).json({ product:rows[0] }); }));
app.patch('/api/seller/products/:id', requireDb, auth, role('seller'), route(async (req,res) => { const p=productInput(req.body); const { rows }=await pool.query("UPDATE products SET name=$1,description=$2,category=$3,price=$4,old_price=$5,stock=$6,image_url=$7,status='pending',updated_at=now() WHERE id=$8 AND seller_id=$9 AND status!='archived' RETURNING *",[p.name,p.description,p.category,p.price,p.oldPrice||null,p.stock,p.image,req.params.id,req.user.id]); if(!rows[0]) throw fail(404,'Mahsulot topilmadi.'); res.json({product:rows[0]}); }));
app.delete('/api/seller/products/:id', requireDb, auth, role('seller'), route(async (req,res) => { const result=await pool.query("UPDATE products SET status='archived',updated_at=now() WHERE id=$1 AND seller_id=$2 RETURNING id",[req.params.id,req.user.id]); if(!result.rowCount) throw fail(404,'Mahsulot topilmadi.'); res.json({ok:true}); }));
app.get('/api/seller/orders', requireDb, auth, role('seller'), route(async (req,res) => { const { rows }=await pool.query('SELECT i.*,o.status AS order_status,o.created_at,o.region,o.district,o.recipient,o.phone FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.seller_id=$1 ORDER BY o.created_at DESC LIMIT 100',[req.user.id]); res.json({items:rows}); }));
app.patch('/api/seller/order-items/:id', requireDb, auth, role('seller'), route(async (req,res) => { const status=text(req.body.status,20); if(!['packing','ready'].includes(status)) throw fail(400,'Status xato.'); const {rows}=await pool.query("UPDATE order_items i SET fulfillment_status=$1 FROM orders o WHERE i.id=$2 AND i.seller_id=$3 AND i.order_id=o.id AND o.status NOT IN ('cancelled','delivered') RETURNING i.*",[status,req.params.id,req.user.id]); if(!rows[0]) throw fail(404,'Buyurtma topilmadi.'); res.json({item:rows[0]}); }));

app.get('/api/admin/overview', requireDb, auth, role('admin'), route(async (req,res) => { const {rows}=await pool.query("SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM users WHERE seller_status='pending') AS seller_requests,(SELECT count(*)::int FROM products WHERE status='pending') AS pending_products,(SELECT count(*)::int FROM products WHERE status='active') AS active_products,(SELECT count(*)::int FROM orders WHERE status!='cancelled') AS orders,(SELECT coalesce(sum(subtotal),0)::bigint FROM orders WHERE status!='cancelled') AS order_value"); res.json({stats:rows[0]}); }));
app.get('/api/admin/sellers', requireDb, auth, role('admin'), route(async (req,res) => { const {rows}=await pool.query("SELECT id,full_name,email,phone,role,seller_status,created_at FROM users WHERE seller_status IN ('pending','approved','rejected') ORDER BY created_at DESC LIMIT 100"); res.json({sellers:rows}); }));
app.patch('/api/admin/sellers/:id', requireDb, auth, role('admin'), route(async (req,res) => { const status=text(req.body.status,20); if(!['approved','rejected'].includes(status)) throw fail(400,'Status xato.'); const {rows}=await pool.query("UPDATE users SET seller_status=$1,role=CASE WHEN $3 THEN 'seller' ELSE 'buyer' END WHERE id=$2 AND role!='admin' RETURNING id,full_name,email,seller_status",[status,req.params.id,status==='approved']); if(!rows[0]) throw fail(404,'Sotuvchi topilmadi.'); res.json({seller:rows[0]}); }));
app.get('/api/admin/products', requireDb, auth, role('admin'), route(async (req,res) => { const {rows}=await pool.query("SELECT p.*,u.full_name AS seller_name FROM products p LEFT JOIN users u ON u.id=p.seller_id ORDER BY CASE WHEN p.status='pending' THEN 0 ELSE 1 END,p.created_at DESC LIMIT 100"); res.json({products:rows}); }));
app.patch('/api/admin/products/:id', requireDb, auth, role('admin'), route(async (req,res) => { const status=text(req.body.status,20); if(!['active','rejected','archived'].includes(status)) throw fail(400,'Status xato.'); const {rows}=await pool.query('UPDATE products SET status=$1,updated_at=now() WHERE id=$2 RETURNING *',[status,req.params.id]); if(!rows[0]) throw fail(404,'Mahsulot topilmadi.'); res.json({product:rows[0]}); }));
app.get('/api/admin/orders', requireDb, auth, role('admin'), route(async (req,res) => { const {rows}=await pool.query('SELECT o.*,u.email AS buyer_email FROM orders o JOIN users u ON u.id=o.buyer_id ORDER BY o.created_at DESC LIMIT 100'); res.json({orders:rows}); }));
app.patch('/api/admin/orders/:id', requireDb, auth, role('admin'), route(async (req,res) => { const status=text(req.body.status,24), tracking=text(req.body.trackingNumber,100); if(!['accepted','packing','handed_over','in_transit','delivered','cancelled'].includes(status)) throw fail(400,'Status xato.'); if(status==='cancelled') { await cancelOrder(req.params.id,null); return res.json({ok:true}); } const {rows}=await pool.query("UPDATE orders SET status=$1,tracking_number=$2,updated_at=now() WHERE id=$3 AND status!='cancelled' RETURNING *",[status,tracking||null,req.params.id]); if(!rows[0]) throw fail(404,'Buyurtma topilmadi.'); res.json({order:rows[0]}); }));

app.use(express.static(path.join(root,'public'),{ maxAge: '1h', index: 'index.html' }));
app.get('*', (req,res) => { if(req.path.startsWith('/api/')) return res.status(404).json({error:'API manzili topilmadi.'}); res.sendFile(path.join(root,'public','index.html')); });
app.use((err,req,res,next) => { if(res.headersSent) return next(err); if(!err.status || err.status >= 500) console.error('Request error:', err.message); res.status(err.status || 500).json({ error: err.status ? err.message : 'Serverda xatolik yuz berdi. Keyinroq urinib ko‘ring.' }); });

async function initialize() {
  if (!pool) { console.warn('DATABASE_URL yo‘q: faqat namoyish katalogi ishlaydi.'); return; }
  for (let attempt = 1; attempt <= 8; attempt++) {
    try { await pool.query(await readFile(path.join(root,'schema.sql'),'utf8')); break; }
    catch (e) { if(attempt === 8) throw e; console.warn('Database initialization retry', attempt, e.message); await new Promise(r=>setTimeout(r,2000)); }
  }
  const count = await pool.query('SELECT count(*)::int AS n FROM products');
  if (!count.rows[0].n) {
    for (const p of samples) await pool.query("INSERT INTO products(name,description,category,price,old_price,stock,image_url,badge,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active')",p);
    console.log('Sample product catalog initialized.');
  } else {
    for (const p of featuredSamples) await pool.query("INSERT INTO products(name,description,category,price,old_price,stock,image_url,badge,status) SELECT $1::varchar(180),$2,$3,$4,$5,$6,$7,$8,'active' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name=$1::varchar(180) AND seller_id IS NULL)",p);
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase(), adminPassword = process.env.ADMIN_PASSWORD;
  if(adminEmail && adminPassword) {
    if(!emailOk(adminEmail) || adminPassword.length < 16) throw new Error('ADMIN_EMAIL/ADMIN_PASSWORD configuration is invalid.');
    const existing = await pool.query('SELECT role FROM users WHERE email=$1',[adminEmail]);
    if(existing.rows[0] && existing.rows[0].role !== 'admin') throw new Error('Configured ADMIN_EMAIL already belongs to another user.');
    if(!existing.rows[0]) await pool.query("INSERT INTO users(full_name,email,password_hash,role) VALUES('Marketuz admin',$1,$2,'admin')",[adminEmail,await hashPassword(adminPassword)]);
  }
}
await initialize();
const server = app.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('Marketuz listening on port',server.address().port));
process.on('SIGTERM',()=>server.close(()=>pool?.end()));
