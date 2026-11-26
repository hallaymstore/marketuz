import ExcelJS from 'exceljs';
import { logAudit } from './security.js';
import { normalizePhone } from './phone-auth.js';

const UUID_RE = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function notifyTelegramPhone(pool, telegramTransport, phone, messageText) {
  if (!pool || !phone || !messageText) return false;
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const mockMode = process.env.NODE_ENV !== 'production' && typeof telegramTransport === 'function';
  if (!token && !mockMode) return false;
  try {
    const { rows } = await pool.query('SELECT chat_id FROM telegram_phone_links WHERE phone=$1 LIMIT 1', [normalized]);
    if (!rows[0]?.chat_id) return false;
    const payload = { chat_id: rows[0].chat_id, text: String(messageText).slice(0, 1200) };
    if (mockMode) {
      await telegramTransport(payload);
      return true;
    }
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function releaseOrderEscrow(db, orderId, createNotification) {
  const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
  if (!order || order.status === 'cancelled' || order.escrow_released) return null;
  if (order.payment_status !== 'paid' && order.status !== 'delivered') return null;

  const receiptNo = order.receipt_number || ('MKT-' + String(order.id).slice(0, 8).toUpperCase());
  const cashback = order.bonus_earned > 0
    ? Number(order.bonus_earned)
    : Math.min(200_000, Math.max(0, Math.floor(Number(order.subtotal || 0) * 0.02)));

  await db.query(
    'UPDATE orders SET escrow_released=true, bonus_earned=$2, receipt_number=$3, updated_at=now() WHERE id=$1',
    [order.id, cashback, receiptNo]
  );

  if (cashback > 0 && order.buyer_id) {
    await db.query('UPDATE users SET bonus_balance = bonus_balance + $1 WHERE id=$2', [cashback, order.buyer_id]);
    await db.query(
      'INSERT INTO wallet_transactions(user_id, amount, kind, note, order_id) VALUES($1,$2,$3,$4,$5)',
      [order.buyer_id, cashback, 'cashback', `Buyurtma #${String(order.id).slice(0, 8).toUpperCase()} uchun 2% keshbek`, order.id]
    );
    if (typeof createNotification === 'function') {
      await createNotification(db, {
        userId: order.buyer_id,
        kind: 'bonus',
        title: `+${new Intl.NumberFormat('uz-UZ').format(cashback)} so‘m keshbek hisoblandi`,
        body: 'Keyingi xaridlarda bonus balansingizdan chegirma sifatida foydalanishingiz mumkin.',
        href: '/account?tab=wallet'
      });
    }
  }

  const { rows: sellerTotals } = await db.query(
    'SELECT seller_id, coalesce(sum(price * quantity), 0)::bigint AS gross FROM order_items WHERE order_id=$1 AND seller_id IS NOT NULL GROUP BY seller_id',
    [order.id]
  );
  for (const row of sellerTotals) {
    const net = Math.round(Number(row.gross) * 0.95);
    if (net <= 0) continue;
    await db.query('UPDATE users SET seller_balance = seller_balance + $1 WHERE id=$2', [net, row.seller_id]);
    await db.query(
      'INSERT INTO wallet_transactions(user_id, amount, kind, note, order_id) VALUES($1,$2,$3,$4,$5)',
      [row.seller_id, net, 'escrow_release', `Buyurtma #${String(order.id).slice(0, 8).toUpperCase()} tushumi (95%)`, order.id]
    );
    if (typeof createNotification === 'function') {
      await createNotification(db, {
        userId: row.seller_id,
        kind: 'escrow',
        title: `Balansga +${new Intl.NumberFormat('uz-UZ').format(net)} so‘m qo‘shildi`,
        body: 'Xaridor to‘lovi eskroudan sotuvchi hisobingizga o‘tkazildi.',
        href: '/seller?tab=payouts'
      });
    }
  }
  return { receiptNo, cashback, sellerCount: sellerTotals.length };
}

export async function notifyProductWatchers(pool, product, { oldPrice = null, oldStock = null, createNotification, telegramTransport } = {}) {
  if (!pool || !product || product.status !== 'active') return 0;
  const priceDropped = Number.isFinite(oldPrice) && oldPrice > 0 && Number(product.price) < oldPrice;
  const backInStock = Number.isFinite(oldStock) && oldStock <= 0 && (Number(product.stock) > 0 || product.stock_mode === 'replenishable');
  if (!priceDropped && !backInStock) return 0;

  let notified = 0;
  if (backInStock) {
    const { rows } = await pool.query(
      `SELECT a.id, a.user_id, u.verified_phone, u.phone
       FROM product_alerts a JOIN users u ON u.id = a.user_id
       WHERE a.product_id=$1 AND a.alert_type='stock' AND a.active=true AND u.deleted_at IS NULL`,
      [product.id]
    );
    for (const row of rows) {
      if (typeof createNotification === 'function') {
        await createNotification(pool, {
          userId: row.user_id,
          kind: 'alert',
          title: `${product.name} yana omborda!`,
          body: 'Siz kuzatgan mahsulot sotuvga qaytdi.',
          href: `/product/${product.id}`
        });
      }
      await notifyTelegramPhone(pool, telegramTransport, row.verified_phone || row.phone, `🔔 ${product.name} yana omborga keldi!\nNarxi: ${new Intl.NumberFormat('uz-UZ').format(product.price)} so‘m`);
      await pool.query('UPDATE product_alerts SET last_notified_at=now(), active=false WHERE id=$1', [row.id]).catch(() => {});
      notified++;
    }
  }
  if (priceDropped) {
    const { rows } = await pool.query(
      `SELECT a.id, a.user_id, a.target_price, u.verified_phone, u.phone
       FROM product_alerts a JOIN users u ON u.id = a.user_id
       WHERE a.product_id=$1 AND a.alert_type='price_drop' AND a.active=true AND u.deleted_at IS NULL
         AND (a.target_price = 0 OR a.target_price >= $2)`,
      [product.id, product.price]
    );
    for (const row of rows) {
      if (typeof createNotification === 'function') {
        await createNotification(pool, {
          userId: row.user_id,
          kind: 'alert',
          title: `${product.name} narxi arzonlashdi!`,
          body: `${new Intl.NumberFormat('uz-UZ').format(oldPrice)} → ${new Intl.NumberFormat('uz-UZ').format(product.price)} so‘m`,
          href: `/product/${product.id}`
        });
      }
      await notifyTelegramPhone(pool, telegramTransport, row.verified_phone || row.phone, `📉 Narx tushdi: ${product.name}\nYangi narx: ${new Intl.NumberFormat('uz-UZ').format(product.price)} so‘m`);
      await pool.query('UPDATE product_alerts SET last_notified_at=now(), active=false WHERE id=$1', [row.id]).catch(() => {});
      notified++;
    }
  }
  return notified;
}

export async function runAbandonedCartReminders({ pool, createNotification, telegramTransport }) {
  if (!pool) return 0;
  try {
    const { rows } = await pool.query(
      `SELECT c.user_id, count(*)::int AS cnt, max(p.name) AS sample_name, u.verified_phone, u.phone
       FROM cart_items c
       JOIN users u ON u.id = c.user_id
       JOIN products p ON p.id = c.product_id
       WHERE c.updated_at < now() - interval '2 hours'
         AND c.reminded_at IS NULL
         AND u.deleted_at IS NULL
         AND p.status = 'active'
       GROUP BY c.user_id, u.verified_phone, u.phone
       LIMIT 40`
    );
    for (const row of rows) {
      if (typeof createNotification === 'function') {
        await createNotification(pool, {
          userId: row.user_id,
          kind: 'cart',
          title: 'Savatingizda mahsulotlar kutmoqda',
          body: `${row.sample_name} va yana ${Math.max(0, row.cnt - 1)} ta mahsulotni buyurtma qilishga ulguring.`,
          href: '/cart'
        });
      }
      await notifyTelegramPhone(pool, telegramTransport, row.verified_phone || row.phone, `🛒 Marketuz savatingizda ${row.cnt} ta mahsulot (${row.sample_name}...) sizni kutmoqda. Tugatib buyurtma berishingiz mumkin.`);
      await pool.query('UPDATE cart_items SET reminded_at=now() WHERE user_id=$1 AND reminded_at IS NULL', [row.user_id]);
    }
    return rows.length;
  } catch {
    return 0;
  }
}

export function effectivePrice(p) {
  const flash = Number(p?.flash_sale_price || 0);
  const until = p?.flash_sale_until ? new Date(p.flash_sale_until).getTime() : 0;
  if (flash >= 1000 && (!until || until > Date.now())) return flash;
  return Number(p?.price || 0);
}

export function mountGrowthFeatures(app, { pool, requireDb, auth, role, route, fail, text, idParam, createNotification, telegramTransport, getLegal }) {
  // 1. Product Q&A (Savol-javob)
  app.get('/api/products/:id/questions', route(async (req, res) => {
    const pid = idParam(req.params.id);
    if (!pool) return res.json({ questions: [] });
    const { rows } = await pool.query(
      `SELECT id, product_id, user_id, author_name, question, answer, answered_at, created_at
       FROM product_questions WHERE product_id=$1 ORDER BY (answer <> '') DESC, created_at DESC LIMIT 50`,
      [pid]
    );
    res.json({ questions: rows });
  }));

  app.post('/api/products/:id/questions', requireDb, auth, route(async (req, res) => {
    const pid = idParam(req.params.id);
    const question = text(req.body?.question, 400);
    if (question.length < 5) throw fail(400, 'Savol kamida 5 ta belgidan iborat bo‘lsin.');
    const { rows: [prod] } = await pool.query("SELECT id, seller_id, name FROM products WHERE id=$1 AND status='active'", [pid]);
    if (!prod) throw fail(404, 'Mahsulot topilmadi.');
    const { rows: [created] } = await pool.query(
      'INSERT INTO product_questions(product_id, user_id, author_name, question) VALUES($1,$2,$3,$4) RETURNING *',
      [pid, req.user.id, req.user.full_name, question]
    );
    if (prod.seller_id && String(prod.seller_id) !== String(req.user.id)) {
      await createNotification(pool, {
        userId: prod.seller_id,
        kind: 'question',
        title: `Yangi savol: ${prod.name}`,
        body: question,
        href: '/seller?tab=questions'
      });
    }
    res.status(201).json({ question: created });
  }));

  app.patch('/api/questions/:id/answer', requireDb, auth, route(async (req, res) => {
    const qid = idParam(req.params.id);
    const answer = text(req.body?.answer, 1000);
    if (answer.length < 2) throw fail(400, 'Javob matnini kiriting.');
    const { rows: [q] } = await pool.query(
      `SELECT q.*, p.seller_id, p.name AS product_name
       FROM product_questions q JOIN products p ON p.id = q.product_id WHERE q.id=$1`,
      [qid]
    );
    if (!q) throw fail(404, 'Savol topilmadi.');
    const isSellerOwner = req.user.role === 'seller' && String(q.seller_id) === String(req.user.id);
    if (!isSellerOwner && req.user.role !== 'admin') throw fail(403, 'Faqat sotuvchi yoki admin javob bera oladi.');
    const { rows: [updated] } = await pool.query(
      'UPDATE product_questions SET answer=$1, answered_by=$2, answered_at=now() WHERE id=$3 RETURNING *',
      [answer, req.user.id, qid]
    );
    if (q.user_id) {
      await createNotification(pool, {
        userId: q.user_id,
        kind: 'question',
        title: `Savolingizga javob keldi: ${q.product_name}`,
        body: answer,
        href: `/product/${q.product_id}`
      });
    }
    res.json({ question: updated });
  }));

  app.get('/api/seller/questions', requireDb, auth, role('seller'), route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT q.*, p.name AS product_name, p.image_url AS product_image
       FROM product_questions q
       JOIN products p ON p.id = q.product_id
       WHERE p.seller_id=$1
       ORDER BY (q.answer = '') DESC, q.created_at DESC LIMIT 80`,
      [req.user.id]
    );
    res.json({ questions: rows });
  }));

  // 2. Review Helpful Votes ("Foydali")
  app.post('/api/reviews/:id/helpful', requireDb, auth, route(async (req, res) => {
    const rid = idParam(req.params.id);
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const exists = await db.query('SELECT id FROM product_reviews WHERE id=$1', [rid]);
      if (!exists.rowCount) throw fail(404, 'Sharh topilmadi.');
      const voted = await db.query(
        'INSERT INTO review_votes(review_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING review_id',
        [rid, req.user.id]
      );
      if (voted.rowCount) {
        await db.query('UPDATE product_reviews SET helpful_count = helpful_count + 1 WHERE id=$1', [rid]);
      } else {
        await db.query('DELETE FROM review_votes WHERE review_id=$1 AND user_id=$2', [rid, req.user.id]);
        await db.query('UPDATE product_reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id=$1', [rid]);
      }
      const { rows: [row] } = await db.query('SELECT id, helpful_count FROM product_reviews WHERE id=$1', [rid]);
      await db.query('COMMIT');
      res.json({ id: row.id, helpful_count: row.helpful_count, voted: !!voted.rowCount });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }));

  // 3. Bonus Cashback Wallet
  app.get('/api/me/wallet', requireDb, auth, route(async (req, res) => {
    const { rows: [userRow] } = await pool.query('SELECT bonus_balance, seller_balance FROM users WHERE id=$1', [req.user.id]);
    const { rows: transactions } = await pool.query(
      'SELECT id, amount, kind, note, order_id, created_at FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40',
      [req.user.id]
    );
    res.json({
      bonusBalance: Number(userRow?.bonus_balance || 0),
      sellerBalance: Number(userRow?.seller_balance || 0),
      transactions
    });
  }));

  // 4. Back-in-stock & Price-drop Alerts
  app.get('/api/me/alerts', requireDb, auth, route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT a.*, p.name, p.price, p.stock, p.stock_mode, p.image_url
       FROM product_alerts a JOIN products p ON p.id = a.product_id
       WHERE a.user_id=$1 AND a.active=true AND p.status='active'
       ORDER BY a.created_at DESC LIMIT 60`,
      [req.user.id]
    );
    res.json({ alerts: rows });
  }));

  app.post('/api/products/:id/alerts', requireDb, auth, route(async (req, res) => {
    const pid = idParam(req.params.id);
    const alertType = req.body?.type === 'price_drop' ? 'price_drop' : 'stock';
    const targetPrice = Math.max(0, Number.parseInt(req.body?.targetPrice, 10) || 0);
    const { rows: [prod] } = await pool.query("SELECT id FROM products WHERE id=$1 AND status='active'", [pid]);
    if (!prod) throw fail(404, 'Mahsulot topilmadi.');
    const { rows: [alert] } = await pool.query(
      `INSERT INTO product_alerts(product_id, user_id, alert_type, target_price, active)
       VALUES($1,$2,$3,$4,true)
       ON CONFLICT(product_id, user_id, alert_type) DO UPDATE
         SET active=true, target_price=excluded.target_price
       RETURNING *`,
      [pid, req.user.id, alertType, targetPrice]
    );
    res.status(201).json({ alert });
  }));

  app.delete('/api/products/:id/alerts', requireDb, auth, route(async (req, res) => {
    const pid = idParam(req.params.id);
    const alertType = text(req.query.type, 24);
    if (alertType && ['stock', 'price_drop'].includes(alertType)) {
      await pool.query('DELETE FROM product_alerts WHERE product_id=$1 AND user_id=$2 AND alert_type=$3', [pid, req.user.id, alertType]);
    } else {
      await pool.query('DELETE FROM product_alerts WHERE product_id=$1 AND user_id=$2', [pid, req.user.id]);
    }
    res.json({ ok: true });
  }));

  // Helper to verify order access (IDOR safe)
  async function loadAuthorizedOrder(orderId, user) {
    if (!UUID_RE.test(String(orderId || ''))) throw fail(404, 'Buyurtma topilmadi.');
    const { rows: [order] } = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
    if (!order) throw fail(404, 'Buyurtma topilmadi.');
    const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', [orderId]);
    const isBuyer = String(order.buyer_id) === String(user.id);
    const isSeller = user.role === 'seller' && items.some(i => String(i.seller_id) === String(user.id));
    const isAdmin = user.role === 'admin';
    if (!isBuyer && !isSeller && !isAdmin) throw fail(403, 'Bu buyurtmaga kirish huquqingiz yo‘q.');
    return { order, items, isBuyer, isSeller, isAdmin };
  }

  // 5. Buyer–Seller Order Chat
  app.get('/api/orders/:id/messages', requireDb, auth, route(async (req, res) => {
    await loadAuthorizedOrder(req.params.id, req.user);
    const { rows } = await pool.query(
      'SELECT id, order_id, sender_id, sender_role, sender_name, message, created_at FROM order_messages WHERE order_id=$1 ORDER BY created_at ASC LIMIT 100',
      [req.params.id]
    );
    res.json({ messages: rows });
  }));

  app.post('/api/orders/:id/messages', requireDb, auth, route(async (req, res) => {
    const { order, items, isBuyer, isAdmin } = await loadAuthorizedOrder(req.params.id, req.user);
    const message = text(req.body?.message, 800);
    if (message.length < 1) throw fail(400, 'Xabar matnini yozing.');
    const senderRole = isAdmin ? 'admin' : isBuyer ? 'buyer' : 'seller';
    const { rows: [created] } = await pool.query(
      'INSERT INTO order_messages(order_id, sender_id, sender_role, sender_name, message) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [order.id, req.user.id, senderRole, req.user.full_name, message]
    );
    const shortId = String(order.id).slice(0, 8).toUpperCase();
    if (isBuyer) {
      const sellerIds = [...new Set(items.map(i => i.seller_id).filter(Boolean))];
      for (const sid of sellerIds) {
        await createNotification(pool, {
          userId: sid,
          kind: 'chat',
          title: `Buyurtma #${shortId}: xaridordan xabar`,
          body: message,
          href: '/seller?tab=orders'
        });
      }
    } else if (order.buyer_id) {
      await createNotification(pool, {
        userId: order.buyer_id,
        kind: 'chat',
        title: `Buyurtma #${shortId}: sotuvchidan xabar`,
        body: message,
        href: '/account?tab=orders'
      });
      await notifyTelegramPhone(pool, telegramTransport, order.phone, `💬 Buyurtma #${shortId} bo‘yicha xabar:\n${message}`);
    }
    res.status(201).json({ message: created });
  }));

  // 6. Electronic Fiscal-style Receipt
  app.get('/api/orders/:id/receipt', requireDb, auth, route(async (req, res) => {
    const { order, items } = await loadAuthorizedOrder(req.params.id, req.user);
    const receiptNumber = order.receipt_number || ('MKT-' + String(order.id).slice(0, 8).toUpperCase());
    const legal = typeof getLegal === 'function' ? getLegal() : {};
    res.json({
      receipt: {
        receiptNumber,
        orderId: order.id,
        createdAt: order.created_at,
        recipient: order.recipient,
        phone: order.phone,
        region: order.region,
        district: order.district,
        address: order.address,
        deliveryMode: order.delivery_mode,
        pickupBranchLabel: order.pickup_branch_label,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        status: order.status,
        subtotal: Number(order.subtotal || 0),
        discountAmount: Number(order.discount_amount || 0),
        bonusUsed: Number(order.bonus_used || 0),
        bonusEarned: Number(order.bonus_earned || 0),
        deliveryFee: Number(order.delivery_fee || 0),
        total: Number(order.total || 0),
        operator: legal.operator || 'Marketuz MCHJ',
        taxId: legal.taxId || '',
        legalAddress: legal.address || '',
        items: items.map(i => ({
          title: i.title,
          variant: i.variant_label,
          quantity: i.quantity,
          price: Number(i.price),
          lineTotal: Number(i.price) * Number(i.quantity)
        }))
      }
    });
  }));

  // 7. Seller Escrow Payouts, Promote, Orders Excel Export, Shipping Label
  app.get('/api/seller/payouts', requireDb, auth, role('seller'), route(async (req, res) => {
    const { rows: [userRow] } = await pool.query('SELECT seller_balance FROM users WHERE id=$1', [req.user.id]);
    const { rows: payouts } = await pool.query('SELECT * FROM seller_payouts WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 40', [req.user.id]);
    res.json({ sellerBalance: Number(userRow?.seller_balance || 0), payouts });
  }));

  app.post('/api/seller/payouts', requireDb, auth, role('seller'), route(async (req, res) => {
    const amount = Number.parseInt(req.body?.amount, 10);
    const cardMask = text(req.body?.cardMask, 32);
    const recipientName = text(req.body?.recipientName || req.user.full_name, 120);
    if (!Number.isSafeInteger(amount) || amount < 10_000) throw fail(400, 'Minimal yechish summasi 10 000 so‘m.');
    if (!/^\d{4}[\s*•]{4,12}\d{4}$/.test(cardMask) && !/^\d{16}$/.test(cardMask.replace(/\s+/g, ''))) {
      throw fail(400, 'Karta maskasi yoki raqamini kiriting (masalan: 8600 **** 0001).');
    }
    const cleanDigits = cardMask.replace(/\D/g, '');
    const safeMask = cleanDigits.length >= 8
      ? `${cleanDigits.slice(0, 4)} •••• •••• ${cleanDigits.slice(-4)}`
      : cardMask;

    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const debited = await db.query(
        'UPDATE users SET seller_balance = seller_balance - $2 WHERE id=$1 AND seller_balance >= $2 RETURNING seller_balance',
        [req.user.id, amount]
      );
      if (!debited.rowCount) throw fail(409, 'Sotuvchi balansingizda yetarli mablag‘ yo‘q.');
      const { rows: [payout] } = await db.query(
        'INSERT INTO seller_payouts(seller_id, amount, card_mask, recipient_name) VALUES($1,$2,$3,$4) RETURNING *',
        [req.user.id, amount, safeMask, recipientName]
      );
      await db.query(
        'INSERT INTO wallet_transactions(user_id, amount, kind, note) VALUES($1,$2,$3,$4)',
        [req.user.id, -amount, 'payout_request', `Pul yechish so‘rovi #${payout.id}`]
      );
      await db.query('COMMIT');
      await logAudit(pool, { actorId: req.user.id, action: 'seller_payout_requested', targetType: 'payout', targetId: String(payout.id), req, details: { amount } });
      res.status(201).json({ payout, sellerBalance: Number(debited.rows[0].seller_balance) });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }));

  app.post('/api/seller/products/:id/promote', requireDb, auth, role('seller'), route(async (req, res) => {
    const pid = idParam(req.params.id);
    const active = req.body?.promoted !== false;
    const { rows: [product] } = await pool.query(
      "UPDATE products SET is_promoted=$1, promoted_until=CASE WHEN $1 THEN now() + interval '7 days' ELSE NULL END, updated_at=now() WHERE id=$2 AND seller_id=$3 AND status!='archived' RETURNING *",
      [active, pid, req.user.id]
    );
    if (!product) throw fail(404, 'Mahsulot topilmadi.');
    res.json({ product });
  }));

  app.get('/api/seller/orders.xlsx', requireDb, auth, role('seller'), route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT i.id, i.order_id, i.title, i.variant_label, i.price, i.quantity, i.fulfillment_status,
              o.status AS order_status, o.payment_status, o.recipient, o.phone, o.region, o.district, o.tracking_number, o.created_at
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE i.seller_id=$1 ORDER BY o.created_at DESC LIMIT 500`,
      [req.user.id]
    );
    const book = new ExcelJS.Workbook();
    book.creator = 'Marketuz';
    const sheet = book.addWorksheet('Buyurtmalar');
    sheet.addRow(['Buyurtma ID', 'Mahsulot', 'Variant', 'Narx', 'Soni', 'Jami', 'Holat', 'To‘lov', 'Xaridor', 'Telefon', 'Hudud', 'Kuzatuv kodi', 'Sana']);
    for (const r of rows) {
      sheet.addRow([
        String(r.order_id).slice(0, 8).toUpperCase(),
        r.title,
        r.variant_label || '',
        Number(r.price),
        Number(r.quantity),
        Number(r.price) * Number(r.quantity),
        r.order_status,
        r.payment_status,
        r.recipient,
        r.phone,
        `${r.region}, ${r.district}`,
        r.tracking_number || '',
        new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ')
      ]);
    }
    sheet.getRow(1).font = { bold: true };
    const buf = Buffer.from(await book.xlsx.writeBuffer());
    res.set('Cache-Control', 'no-store')
      .set('Content-Disposition', 'attachment; filename="marketuz-sotuvchi-buyurtmalar.xlsx"')
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(buf);
  }));

  app.get('/api/seller/order-items/:id/label', requireDb, auth, role('seller'), route(async (req, res) => {
    const itemId = idParam(req.params.id);
    const { rows: [row] } = await pool.query(
      `SELECT i.*, o.recipient, o.phone, o.region, o.district, o.address, o.delivery_mode, o.pickup_branch_label, o.tracking_number, o.payment_status, o.created_at,
              u.full_name AS seller_name
       FROM order_items i
       JOIN orders o ON o.id = i.order_id
       LEFT JOIN users u ON u.id = i.seller_id
       WHERE i.id=$1 AND i.seller_id=$2`,
      [itemId, req.user.id]
    );
    if (!row) throw fail(404, 'Buyurtma elementi topilmadi.');
    res.json({
      label: {
        itemId: row.id,
        orderId: row.order_id,
        code: String(row.order_id).slice(0, 8).toUpperCase(),
        trackingNumber: row.tracking_number || ('UZP-' + String(row.order_id).slice(0, 8).toUpperCase()),
        sellerName: row.seller_name || 'Marketuz Sotuvchi',
        recipient: row.recipient,
        phone: row.phone,
        destination: row.delivery_mode === 'uzpost_pickup' && row.pickup_branch_label
          ? `UzPost: ${row.pickup_branch_label}`
          : `${row.region}, ${row.district}, ${row.address}`,
        title: row.title,
        variant: row.variant_label,
        quantity: row.quantity,
        paymentStatus: row.payment_status,
        createdAt: row.created_at
      }
    });
  }));

  // 8. Admin Payout Management
  app.get('/api/admin/payouts', requireDb, auth, role('admin'), route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT p.*, u.full_name AS seller_name, u.email AS seller_email, u.seller_balance
       FROM seller_payouts p JOIN users u ON u.id = p.seller_id
       ORDER BY (p.status = 'requested') DESC, p.created_at DESC LIMIT 100`
    );
    res.json({ payouts: rows });
  }));

  app.patch('/api/admin/payouts/:id', requireDb, auth, role('admin'), route(async (req, res) => {
    const pid = idParam(req.params.id);
    const status = text(req.body?.status, 24);
    const note = text(req.body?.note, 240);
    if (!['paid', 'rejected'].includes(status)) throw fail(400, 'Holat paid yoki rejected bo‘lsin.');
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const { rows: [current] } = await db.query('SELECT * FROM seller_payouts WHERE id=$1 FOR UPDATE', [pid]);
      if (!current || current.status !== 'requested') throw fail(409, 'Bu so‘rov allaqachon ko‘rib chiqilgan.');
      const { rows: [updated] } = await db.query(
        'UPDATE seller_payouts SET status=$1, admin_note=$2, processed_by=$3, updated_at=now() WHERE id=$4 RETURNING *',
        [status, note, req.user.id, pid]
      );
      if (status === 'rejected') {
        await db.query('UPDATE users SET seller_balance = seller_balance + $1 WHERE id=$2', [current.amount, current.seller_id]);
        await db.query(
          'INSERT INTO wallet_transactions(user_id, amount, kind, note) VALUES($1,$2,$3,$4)',
          [current.seller_id, current.amount, 'payout_refund', `Pul yechish so‘rovi #${current.id} rad etildi (qaytarildi)`]
        );
      }
      await createNotification(db, {
        userId: current.seller_id,
        kind: 'payout',
        title: status === 'paid' ? `To‘lov #${current.id} o‘tkazildi` : `To‘lov so‘rovi #${current.id} rad etildi`,
        body: note || (status === 'paid' ? `${current.amount} so‘m kartangizga yuborildi.` : 'Mablag‘ sotuvchi balansingizga qaytarildi.'),
        href: '/seller?tab=payouts'
      });
      await db.query('COMMIT');
      await logAudit(pool, { actorId: req.user.id, action: 'payout_' + status, targetType: 'payout', targetId: pid, req, details: { amount: current.amount } });
      res.json({ payout: updated });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }));
}
