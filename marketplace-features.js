import { logAudit } from './security.js';
import { calculateShipping, createShippingProvider, findNearestBranches, regionDistricts, uzpostBranches } from './shipping.js';

export function computePromoDiscount(promo, subtotal) {
  if (!promo || !promo.active) return { valid: false, discount: 0, reason: 'Promokod faol emas.' };
  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return { valid: false, discount: 0, reason: 'Promokod muddati hali boshlanmagan.' };
  if (promo.expires_at && new Date(promo.expires_at).getTime() < now) return { valid: false, discount: 0, reason: 'Promokod muddati tugagan.' };
  if (promo.usage_limit !== null && promo.usage_limit !== undefined && promo.used_count >= promo.usage_limit) {
    return { valid: false, discount: 0, reason: 'Promokod limiti tugagan.' };
  }
  if (subtotal < (promo.min_order || 0)) {
    return { valid: false, discount: 0, reason: `Minimal buyurtma summasi: ${promo.min_order} so‘m.` };
  }
  let discount = promo.discount_type === 'percent'
    ? Math.floor((subtotal * promo.discount_value) / 100)
    : promo.discount_value;
  if (promo.max_discount && promo.max_discount > 0) discount = Math.min(discount, promo.max_discount);
  discount = Math.max(0, Math.min(discount, subtotal - 1000));
  return { valid: true, discount, code: promo.code };
}

export async function createNotification(dbOrPool, { userId, kind = 'info', title, body = '', href = '' }) {
  if (!dbOrPool || !userId || !title) return;
  await dbOrPool.query(
    'INSERT INTO notifications(user_id, kind, title, body, href) VALUES($1,$2,$3,$4,$5)',
    [userId, String(kind).slice(0, 32), String(title).slice(0, 140), String(body).slice(0, 400), String(href).slice(0, 200)]
  ).catch(() => {});
}

export function mountMarketplaceFeatures(app, { pool, requireDb, auth, role, route, fail, text, idParam }) {
  const shippingProvider = createShippingProvider();

  // Shipping reference, UzPost branches & quote
  app.get('/api/shipping/meta', (req, res) => {
    res.json({
      regions: Object.keys(regionDistricts),
      districts: regionDistricts,
      branches: uzpostBranches,
      provider: { name: shippingProvider.name, configured: shippingProvider.configured }
    });
  });

  app.get('/api/shipping/branches', (req, res) => {
    const region = text(req.query.region, 80);
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : NaN;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : NaN;
    const branches = findNearestBranches(lat, lng, region);
    res.json({ branches });
  });

  app.post('/api/shipping/quote', route(async (req, res) => {
    const region = text(req.body?.region, 80);
    const deliveryMode = req.body?.deliveryMode === 'uzpost_pickup' ? 'uzpost_pickup' : 'courier';
    const subtotal = Math.max(0, Number(req.body?.subtotal || 0));
    const shippingIncluded = process.env.SHIPPING_INCLUDED_IN_PRICE === 'true';
    res.json(calculateShipping({ region, subtotal, shippingIncluded, deliveryMode }));
  }));

  // Persistent buyer cart
  app.get('/api/cart', requireDb, auth, route(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT product_id AS id, variant_id AS "variantId", qty FROM cart_items WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 30',
      [req.user.id]
    );
    res.json({ items: rows });
  }));

  app.put('/api/cart', requireDb, auth, route(async (req, res) => {
    const raw = Array.isArray(req.body?.items) ? req.body.items.slice(0, 30) : [];
    const items = raw
      .map(x => ({ id: Number(x?.id), variantId: x?.variantId ? Number(x.variantId) : null, qty: Number(x?.qty || 1) }))
      .filter(x => Number.isSafeInteger(x.id) && x.id > 0 && Number.isSafeInteger(x.qty) && x.qty >= 1 && x.qty <= 20 && (x.variantId === null || (Number.isSafeInteger(x.variantId) && x.variantId > 0)));
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
      const seen = new Set();
      for (const item of items) {
        const key = `${item.id}:${item.variantId || 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await db.query(
          "INSERT INTO cart_items(user_id, product_id, variant_id, qty) SELECT $1, id, $3, $4 FROM products WHERE id=$2 AND status='active'",
          [req.user.id, item.id, item.variantId, item.qty]
        );
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
    res.json({ ok: true });
  }));

  // Product reviews & verified buyer ratings
  app.get('/api/products/:id/reviews', requireDb, route(async (req, res) => {
    const pid = idParam(req.params.id);
    const { rows } = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.verified_purchase, r.created_at, u.full_name AS author_name
       FROM product_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id=$1 AND u.deleted_at IS NULL
       ORDER BY r.verified_purchase DESC, r.created_at DESC
       LIMIT 50`,
      [pid]
    );
    res.json({ reviews: rows });
  }));

  app.post('/api/products/:id/reviews', requireDb, auth, route(async (req, res) => {
    const pid = idParam(req.params.id);
    const rating = Number(req.body?.rating);
    const comment = text(req.body?.comment, 1000);
    if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5) throw fail(400, 'Reyting 1 dan 5 gacha bo‘lsin.');
    if (comment.length < 3) throw fail(400, 'Sharh matni kamida 3 belgidan iborat bo‘lsin.');

    const prod = await pool.query("SELECT id FROM products WHERE id=$1 AND status='active'", [pid]);
    if (!prod.rowCount) throw fail(404, 'Mahsulot topilmadi.');

    const purchase = await pool.query(
      `SELECT o.id FROM orders o
       JOIN order_items i ON i.order_id = o.id
       WHERE o.buyer_id=$1 AND i.product_id=$2 AND o.status='delivered'
       ORDER BY o.created_at DESC LIMIT 1`,
      [req.user.id, pid]
    );
    const verified = !!purchase.rowCount;
    const orderId = purchase.rows[0]?.id || null;

    const db = await pool.connect();
    let review;
    try {
      await db.query('BEGIN');
      const { rows } = await db.query(
        `INSERT INTO product_reviews(product_id, user_id, order_id, rating, comment, verified_purchase)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(product_id, user_id) DO UPDATE
           SET rating=excluded.rating, comment=excluded.comment, verified_purchase=GREATEST(product_reviews.verified_purchase, excluded.verified_purchase)
         RETURNING *`,
        [pid, req.user.id, orderId, rating, comment, verified]
      );
      review = rows[0];
      await db.query(
        `UPDATE products
         SET rating_avg = coalesce((SELECT round(avg(rating)::numeric, 2) FROM product_reviews WHERE product_id=$1), 0),
             rating_count = (SELECT count(*)::int FROM product_reviews WHERE product_id=$1)
         WHERE id=$1`,
        [pid]
      );
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
    res.status(201).json({ review });
  }));

  // Promo code preview
  app.post('/api/promo/check', requireDb, auth, route(async (req, res) => {
    const code = text(req.body?.code, 32).toUpperCase();
    const subtotal = Math.max(0, Number(req.body?.subtotal || 0));
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw fail(400, 'Promokod formati noto‘g‘ri.');
    const { rows } = await pool.query('SELECT * FROM promo_codes WHERE code=$1', [code]);
    const check = computePromoDiscount(rows[0], subtotal);
    if (!check.valid) throw fail(400, check.reason);
    res.json({ code: rows[0].code, discount: check.discount, finalSubtotal: subtotal - check.discount });
  }));

  // Return requests (buyer)
  app.post('/api/orders/:id/return', requireDb, auth, route(async (req, res) => {
    const orderId = String(req.params.id || '');
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(orderId)) throw fail(404, 'Buyurtma topilmadi.');
    const reason = text(req.body?.reason, 400);
    if (reason.length < 10) throw fail(400, 'Qaytarish sababini batafsilroq yozing (kamida 10 belgi).');
    const { rows: [order] } = await pool.query('SELECT id, buyer_id, status FROM orders WHERE id=$1 AND buyer_id=$2', [orderId, req.user.id]);
    if (!order) throw fail(404, 'Buyurtma topilmadi.');
    if (order.status !== 'delivered') throw fail(409, 'Faqat yetkazib berilgan buyurtma bo‘yicha qaytarish arizasi yuboriladi.');
    try {
      const { rows } = await pool.query(
        'INSERT INTO return_requests(order_id, buyer_id, reason) VALUES($1,$2,$3) RETURNING *',
        [order.id, req.user.id, reason]
      );
      await logAudit(pool, { actorId: req.user.id, action: 'return_requested', targetType: 'order', targetId: order.id, req });
      res.status(201).json({ returnRequest: rows[0] });
    } catch (e) {
      if (e.code === '23505') throw fail(409, 'Bu buyurtma uchun qaytarish arizasi allaqachon yuborilgan.');
      throw e;
    }
  }));

  app.get('/api/me/returns', requireDb, auth, route(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM return_requests WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json({ returns: rows });
  }));

  // Notifications
  app.get('/api/notifications', requireDb, auth, route(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40', [req.user.id]);
    const unread = rows.filter(x => !x.is_read).length;
    res.json({ notifications: rows, unread });
  }));

  app.post('/api/notifications/read', requireDb, auth, route(async (req, res) => {
    await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false', [req.user.id]);
    res.json({ ok: true });
  }));

  // Seller analytics, promos, returns
  app.get('/api/seller/analytics', requireDb, auth, role('seller'), route(async (req, res) => {
    const commissionRate = 0.05;
    const { rows: [sales] } = await pool.query(
      `SELECT
         count(DISTINCT i.order_id)::int AS total_orders,
         coalesce(sum(i.price * i.quantity), 0)::bigint AS gross_revenue,
         coalesce(sum(i.quantity), 0)::int AS units_sold
       FROM order_items i
       JOIN orders o ON o.id = i.order_id
       WHERE i.seller_id=$1 AND o.status != 'cancelled'`,
      [req.user.id]
    );
    const { rows: [catalogStats] } = await pool.query(
      `SELECT
         count(*) FILTER (WHERE status='active')::int AS active_products,
         count(*) FILTER (WHERE status='pending')::int AS pending_products,
         count(*) FILTER (WHERE status='rejected')::int AS rejected_products,
         coalesce(round(avg(rating_avg) FILTER (WHERE rating_count > 0), 2), 0) AS avg_rating
       FROM products WHERE seller_id=$1`,
      [req.user.id]
    );
    const gross = Number(sales?.gross_revenue || 0);
    const commission = Math.round(gross * commissionRate);
    const returns = (await pool.query(
      `SELECT r.*, o.subtotal FROM return_requests r
       JOIN orders o ON o.id = r.order_id
       WHERE EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.seller_id=$1)
       ORDER BY r.created_at DESC LIMIT 30`,
      [req.user.id]
    )).rows;
    res.json({
      stats: {
        ...sales,
        ...catalogStats,
        commission_rate: commissionRate,
        commission_amount: commission,
        net_revenue: gross - commission
      },
      returns
    });
  }));

  // Admin: customers, analytics, promos, returns, audit logs, security events, SMS costs, health
  app.get('/api/admin/customers', requireDb, auth, role('admin'), route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.verified_phone, u.role, u.seller_status, u.created_at, u.last_login_at,
         (SELECT count(*)::int FROM orders o WHERE o.buyer_id = u.id) AS order_count
       FROM users u
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC LIMIT 100`
    );
    res.json({ customers: rows });
  }));

  app.get('/api/admin/promos', requireDb, auth, role('admin'), route(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 100');
    res.json({ promos: rows });
  }));

  app.post('/api/admin/promos', requireDb, auth, role('admin'), route(async (req, res) => {
    const code = text(req.body?.code, 32).toUpperCase();
    const discountType = ['percent', 'fixed'].includes(req.body?.discountType) ? req.body.discountType : 'percent';
    const discountValue = Number(req.body?.discountValue);
    const minOrder = Math.max(0, Number(req.body?.minOrder || 0));
    const maxDiscount = req.body?.maxDiscount ? Number(req.body.maxDiscount) : null;
    const usageLimit = req.body?.usageLimit ? Number(req.body.usageLimit) : null;
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw fail(400, 'Promokod 3-32 ta lotin harf/raqamdan iborat bo‘lsin.');
    if (!Number.isSafeInteger(discountValue) || discountValue < 1 || (discountType === 'percent' && discountValue > 80)) {
      throw fail(400, 'Chegirma qiymati noto‘g‘ri.');
    }
    try {
      const { rows } = await pool.query(
        'INSERT INTO promo_codes(code, discount_type, discount_value, min_order, max_discount, usage_limit) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [code, discountType, discountValue, minOrder, maxDiscount, usageLimit]
      );
      await logAudit(pool, { actorId: req.user.id, action: 'promo_created', targetType: 'promo', targetId: code, req });
      res.status(201).json({ promo: rows[0] });
    } catch (e) {
      if (e.code === '23505') throw fail(409, 'Bu promokod allaqachon mavjud.');
      throw e;
    }
  }));

  app.patch('/api/admin/promos/:id', requireDb, auth, role('admin'), route(async (req, res) => {
    const pid = idParam(req.params.id);
    const active = req.body?.active === true;
    const { rows } = await pool.query('UPDATE promo_codes SET active=$1 WHERE id=$2 RETURNING *', [active, pid]);
    if (!rows[0]) throw fail(404, 'Promokod topilmadi.');
    await logAudit(pool, { actorId: req.user.id, action: 'promo_toggled', targetType: 'promo', targetId: pid, req, details: { active } });
    res.json({ promo: rows[0] });
  }));

  app.get('/api/admin/returns', requireDb, auth, role('admin'), route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT r.*, o.subtotal, o.payment_method, o.payment_status, u.full_name AS buyer_name
       FROM return_requests r
       JOIN orders o ON o.id = r.order_id
       JOIN users u ON u.id = r.buyer_id
       ORDER BY r.created_at DESC LIMIT 100`
    );
    res.json({ returns: rows });
  }));

  app.patch('/api/admin/returns/:id', requireDb, auth, role('admin'), route(async (req, res) => {
    const rid = idParam(req.params.id);
    const status = text(req.body?.status, 24);
    const note = text(req.body?.note, 400);
    if (!['approved', 'rejected', 'refunded'].includes(status)) throw fail(400, 'Status xato.');
    const { rows } = await pool.query(
      'UPDATE return_requests SET status=$1, resolution_note=$2, reviewed_by=$3, updated_at=now() WHERE id=$4 RETURNING *',
      [status, note, req.user.id, rid]
    );
    if (!rows[0]) throw fail(404, 'Qaytarish arizasi topilmadi.');
    await createNotification(pool, {
      userId: rows[0].buyer_id,
      kind: 'return',
      title: `Qaytarish arizasi: ${status}`,
      body: note || 'Administrator tomonidan ko‘rib chiqildi.',
      href: '/account?tab=orders'
    });
    await logAudit(pool, { actorId: req.user.id, action: 'return_' + status, targetType: 'return_request', targetId: rid, req, details: { note } });
    res.json({ returnRequest: rows[0] });
  }));

  app.get('/api/admin/monitoring', requireDb, auth, role('admin'), route(async (req, res) => {
    const [smsStats, auditLogs, securityEvents, dbStats] = await Promise.all([
      pool.query(
        `SELECT
           count(*)::int AS total_30d,
           count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS today_count,
           count(*) FILTER (WHERE status = 'failed')::int AS failed_30d,
           coalesce(sum(cost_units), 0)::int AS cost_units_30d
         FROM sms_requests WHERE created_at > now() - interval '30 days'`
      ),
      pool.query(
        `SELECT a.*, u.full_name AS actor_name
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
         ORDER BY a.created_at DESC LIMIT 50`
      ),
      pool.query(
        `SELECT s.*, u.full_name AS user_name
         FROM security_events s LEFT JOIN users u ON u.id = s.user_id
         ORDER BY s.created_at DESC LIMIT 50`
      ),
      pool.query(
        `SELECT
           pg_database_size(current_database())::bigint AS db_bytes,
           (SELECT count(*)::int FROM user_sessions WHERE revoked_at IS NULL AND expires_at > now()) AS active_sessions,
           (SELECT count(*)::int FROM site_assets) AS media_assets,
           (SELECT count(*)::int FROM security_events WHERE severity='error' AND created_at > now() - interval '24 hours') AS errors_24h`
      )
    ]);
    res.json({
      sms: smsStats.rows[0],
      auditLogs: auditLogs.rows,
      securityEvents: securityEvents.rows,
      health: {
        ...dbStats.rows[0],
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version
      }
    });
  }));

  app.get('/api/admin/payments', requireDb, auth, role('admin'), route(async (req, res) => {
    const [txRes, sumRes] = await Promise.all([
      pool.query(
        `SELECT t.*, o.status AS order_status, o.payment_status, o.recipient, u.full_name AS buyer_name
         FROM payment_transactions t
         JOIN orders o ON o.id = t.order_id
         JOIN users u ON u.id = o.buyer_id
         ORDER BY t.id DESC LIMIT 100`
      ),
      pool.query(
        `SELECT
           coalesce(sum(amount) FILTER (WHERE state = 2), 0)::bigint AS paid_total,
           coalesce(sum(amount) FILTER (WHERE state < 0), 0)::bigint AS refunded_total,
           count(*) FILTER (WHERE state = 2)::int AS paid_count,
           count(*) FILTER (WHERE state = 1)::int AS pending_count
         FROM payment_transactions`
      )
    ]);
    res.json({ transactions: txRes.rows, summary: sumRes.rows[0] });
  }));

  app.get('/api/admin/backup', requireDb, auth, role('admin'), route(async (req, res) => {
    const [subcats, prods, variants, promos, settingsRes] = await Promise.all([
      pool.query('SELECT id, category, name FROM product_subcategories ORDER BY category, name'),
      pool.query('SELECT id, seller_id, name, description, category, subcategory, brand, sku, price, old_price, stock, stock_mode, status, badge, created_at FROM products ORDER BY id'),
      pool.query('SELECT id, product_id, label, sku, price, stock, active, position FROM product_variants ORDER BY product_id, position, id'),
      pool.query('SELECT id, code, discount_type, discount_value, min_order, max_discount, usage_limit, used_count, active, created_at FROM promo_codes ORDER BY id'),
      pool.query("SELECT key, value, updated_at FROM site_settings WHERE key='site'")
    ]);
    await logAudit(pool, { actorId: req.user.id, action: 'admin_backup_export', targetType: 'database', targetId: 'safe-json', req });
    res.set('Cache-Control', 'no-store')
      .set('Content-Disposition', 'attachment; filename="marketuz-backup.json"')
      .json({
        exportedAt: new Date().toISOString(),
        subcategories: subcats.rows,
        products: prods.rows,
        variants: variants.rows,
        promos: promos.rows,
        siteSettings: settingsRes.rows[0]?.value || null
      });
  }));
}
