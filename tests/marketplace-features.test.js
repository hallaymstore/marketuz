import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';
import { calculateShipping, createShippingProvider } from '../shipping.js';
import { computePromoDiscount } from '../marketplace-features.js';
import { isClickSandboxAllowed } from '../payment-handlers.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://marketuz:marketuz_local_test_pw@127.0.0.1:5432/marketuz_test';

async function withDbApp(fn, appOpts = {}) {
  const prevEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    OTP_SECRET: process.env.OTP_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    NODE_ENV: process.env.NODE_ENV
  };
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long-001';
  process.env.OTP_SECRET = 'test-otp-secret-at-least-32-chars-long-002';
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_EMAIL = 'admin-mkt@example.com';
  process.env.ADMIN_PASSWORD = 'AdminSuperStrongPassword!2026';

  const { app, pool, initialize } = createApp(appOpts);
  await initialize();
  const adminPool = new pg.Pool({ connectionString: TEST_DB_URL });
  await adminPool.query('TRUNCATE TABLE telegram_phone_links, card_tokens, order_messages, product_alerts, seller_payouts, wallet_transactions, review_votes, product_questions, notifications, return_requests, promo_codes, product_reviews, cart_items, audit_logs, security_events, auth_attempts, user_sessions, sms_requests, phone_otps, shipment_events, payment_transactions, order_items, orders, favorites, product_events, seller_follows, product_variants, products, site_assets, settings_audit, site_settings, users RESTART IDENTITY CASCADE');
  await initialize();

  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function req(path, { method = 'GET', body, cookie } = {}) {
    const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) };
    const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    const setCookie = r.headers.get('set-cookie')?.split(';')[0] || null;
    return { status: r.status, ok: r.ok, data, cookie: setCookie };
  }
  try {
    await fn({ req, pool, base });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool?.end();
    await adminPool.end();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('shipping quote and UzPost provider abstraction honesty check', async () => {
  assert.equal(calculateShipping({ region: 'Toshkent shahri', subtotal: 100000 }).fee, 20000);
  assert.equal(calculateShipping({ region: 'Samarqand', subtotal: 600000 }).fee, 0);
  assert.equal(calculateShipping({ region: 'Samarqand', subtotal: 100000, shippingIncluded: true }).fee, 0);
  const provider = createShippingProvider();
  assert.equal(provider.configured, false);
  const res = await provider.createShipment({});
  assert.equal(res.ok, false);
});

test('promo discount helper enforces limits and bounds', () => {
  assert.equal(computePromoDiscount({ active: true, discount_type: 'percent', discount_value: 10, min_order: 50000, used_count: 0 }, 100000).discount, 10000);
  assert.equal(computePromoDiscount({ active: true, discount_type: 'fixed', discount_value: 200000, min_order: 0, used_count: 0 }, 100000).discount, 99000);
  assert.equal(computePromoDiscount({ active: true, discount_type: 'percent', discount_value: 10, min_order: 200000, used_count: 0 }, 100000).valid, false);
});

test('buyer cart sync, promo checkout, verified review, return request, seller isolation, and admin monitoring', async () => {
  await withDbApp(async ({ req }) => {
    const pass = 'StrongPass!2026';
    const adminCookie = (await req('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).cookie;
    const buyerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Xaridor Test', email: 'buyer1@example.com', password: pass, agree: true } })).cookie;
    const seller1Cookie = (await req('/auth/register', { method: 'POST', body: { name: 'Sotuvchi 1', email: 'seller1@example.com', password: pass, agree: true } })).cookie;
    const seller2Cookie = (await req('/auth/register', { method: 'POST', body: { name: 'Sotuvchi 2', email: 'seller2@example.com', password: pass, agree: true } })).cookie;

    // Prototype pollution rejected
    const badJson = await req('/promo/check', { method: 'POST', cookie: buyerCookie, body: JSON.parse('{"code":"ABC","__proto__":{"polluted":true}}') });
    assert.equal(badJson.status, 400);

    // Approve seller 1
    await req('/seller/request', { method: 'POST', body: {}, cookie: seller1Cookie });
    const sellers = (await req('/admin/sellers', { cookie: adminCookie })).data.sellers;
    await req(`/admin/sellers/${sellers[0].id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'approved' } });

    // Seller 1 creates product; Seller 2 cannot access or edit it (RBAC + tenant isolation)
    const created = await req('/seller/products', {
      method: 'POST',
      cookie: seller1Cookie,
      body: { name: 'Charm sumka', description: 'Sifatli charm', category: 'aksessuar', price: 200000, stock: 5 }
    });
    assert.equal(created.status, 201);
    const pid = created.data.product.id;
    assert.equal((await req(`/seller/products/${pid}`, { cookie: seller2Cookie })).status, 403);

    // Admin activates product & creates promo code
    await req(`/admin/products/${pid}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'active' } });
    const promoRes = await req('/admin/promos', {
      method: 'POST',
      cookie: adminCookie,
      body: { code: 'YANGI10', discountType: 'percent', discountValue: 10, minOrder: 100000, usageLimit: 5 }
    });
    assert.equal(promoRes.status, 201);

    // Cart sync & search suggestions
    assert.equal((await req('/cart', { method: 'PUT', cookie: buyerCookie, body: { items: [{ id: pid, qty: 2 }] } })).status, 200);
    const cartData = (await req('/cart', { cookie: buyerCookie })).data;
    assert.equal(cartData.items.length, 1);
    const sug = (await req('/catalog/suggestions?q=Charm')).data;
    assert.ok(sug.suggestions.some(s => s.id === pid));

    // Checkout applies promo discount strictly on backend
    const order = await req('/orders', {
      method: 'POST',
      cookie: buyerCookie,
      body: {
        recipient: 'Xaridor Test',
        phone: '+998 90 123 45 67',
        region: 'Toshkent shahri',
        district: 'Chilonzor tumani',
        address: 'Bunyodkor 10',
        paymentMethod: 'cod',
        promoCode: 'YANGI10',
        checkoutKey: randomUUID(),
        agree: true,
        items: [{ id: pid, qty: 2 }]
      }
    });
    assert.equal(order.status, 201);
    assert.equal(order.data.subtotal, 400000);
    assert.equal(order.data.discountAmount, 40000);
    assert.equal(order.data.total, 360000);

    // Advance order to delivered & submit verified review + return request
    const oid = order.data.id;
    for (const status of ['accepted', 'packing', 'handed_over', 'in_transit', 'delivered']) {
      const step = await req(`/admin/orders/${oid}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { status, trackingNumber: status === 'handed_over' ? 'UZ-123456' : undefined }
      });
      assert.equal(step.status, 200);
    }

    const review = await req(`/products/${pid}/reviews`, {
      method: 'POST',
      cookie: buyerCookie,
      body: { rating: 5, comment: 'Juda sifatli mahsulot ekan!' }
    });
    assert.equal(review.status, 201);
    assert.equal(review.data.review.verified_purchase, true);

    const ret = await req(`/orders/${oid}/return`, {
      method: 'POST',
      cookie: buyerCookie,
      body: { reason: 'O‘lchami kichik keldi, almashtirmoqchiman.' }
    });
    assert.equal(ret.status, 201);

    // Seller analytics reflects gross revenue and commission
    const sellerStats = (await req('/seller/analytics', { cookie: seller1Cookie })).data.stats;
    assert.equal(Number(sellerStats.gross_revenue), 400000);
    assert.equal(sellerStats.commission_amount, 20000);

    // Admin monitoring returns SMS stats, audit logs, security events, and DB health
    const mon = (await req('/admin/monitoring', { cookie: adminCookie })).data;
    assert.ok(mon.auditLogs.length >= 2);
    assert.ok(mon.health.db_bytes > 0);
  });
});

test('UzPost branch nearest sorting, pickup order creation, and Click sandbox one-time card payment', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSandbox = process.env.CLICK_SANDBOX_MOCK;
  const prevPayments = process.env.PAYMENTS_ENABLED;
  const prevShip = process.env.SHIPPING_INCLUDED_IN_PRICE;
  try {
    process.env.NODE_ENV = 'production';
    process.env.CLICK_SANDBOX_MOCK = 'true';
    assert.equal(isClickSandboxAllowed(), false);

    process.env.NODE_ENV = 'test';
    process.env.CLICK_SANDBOX_MOCK = 'true';
    process.env.PAYMENTS_ENABLED = 'false';
    process.env.SHIPPING_INCLUDED_IN_PRICE = 'false';
    assert.equal(isClickSandboxAllowed(), true);

    await withDbApp(async ({ req }) => {
      const cfg = (await req('/config')).data;
      assert.equal(cfg.clickSandbox, true);
      assert.ok(cfg.payments.includes('click'));

      // 1) Non-production /api/config returns click prepayment and hides cod when ALLOW_COD is not enabled
      assert.ok(cfg.payments.includes('click'));
      assert.equal(cfg.payments.includes('cod'), false);

      // Nearest UzPost branch sorting around Tashkent center
      const branchRes = (await req('/shipping/branches?lat=41.3111&lng=69.2797')).data;
      assert.ok(branchRes.branches.length >= 10);
      assert.equal(branchRes.branches[0].region, 'Toshkent shahri');
      assert.ok(branchRes.branches[0].distanceKm <= branchRes.branches[1].distanceKm);

      const buyerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Filial Xaridor', email: 'pickup@example.com', password: 'StrongPass!2026', agree: true } })).cookie;
      const cat = (await req('/catalog')).data;
      const pid = cat.products.find(p => p.stock_mode !== 'replenishable' && !p.variant_count && p.stock >= 1).id;

      // Create order with UzPost branch pickup + Click card prepayment
      const order = await req('/orders', {
        method: 'POST',
        cookie: buyerCookie,
        body: {
          recipient: 'Filial Xaridor',
          phone: '+998 90 111 22 33',
          deliveryMode: 'uzpost_pickup',
          pickupBranchId: branchRes.branches[0].id,
          paymentMethod: 'click',
          checkoutKey: randomUUID(),
          agree: true,
          items: [{ id: pid, qty: 1 }]
        }
      });
      assert.equal(order.status, 201);
      assert.equal(order.data.status, 'awaiting_payment');
      assert.equal(order.data.paymentUrl, '/pay/' + order.data.id);

      // Step 1: Invalid card fails Luhn check cleanly; valid 16-digit card + MM/YY succeeds
      const badCard = await req('/payments/click/card-request', {
        method: 'POST',
        cookie: buyerCookie,
        body: { orderId: order.data.id, cardNumber: '8600 0000 0000 0001', expireDate: '12/28' }
      });
      assert.equal(badCard.status, 400);

      const cardReq = await req('/payments/click/card-request', {
        method: 'POST',
        cookie: buyerCookie,
        body: { orderId: order.data.id, cardNumber: '8600 0000 0000 0007', expireDate: '12/28' }
      });
      assert.equal(cardReq.status, 200);
      assert.equal(cardReq.data.step, 'verify');
      assert.match(cardReq.data.sandboxSmsCode, /^\d{6}$/);

      // Step 2: Verify SMS OTP -> charge exact order total -> mark order paid
      const badVerify = await req('/payments/click/card-verify', {
        method: 'POST',
        cookie: buyerCookie,
        body: { orderId: order.data.id, smsCode: cardReq.data.sandboxSmsCode === '111111' ? '222222' : '111111' }
      });
      assert.equal(badVerify.status, 400);

      const cardVerify = await req('/payments/click/card-verify', {
        method: 'POST',
        cookie: buyerCookie,
        body: { orderId: order.data.id, smsCode: cardReq.data.sandboxSmsCode }
      });
      assert.equal(cardVerify.status, 200);
      assert.equal(cardVerify.data.paymentStatus, 'paid');

      const myOrders = (await req('/orders', { cookie: buyerCookie })).data.orders;
      assert.equal(myOrders[0].status, 'new');
      assert.equal(myOrders[0].payment_status, 'paid');
      assert.equal(myOrders[0].delivery_mode, 'uzpost_pickup');
      assert.ok(myOrders[0].pickup_branch_label.includes(branchRes.branches[0].name));

      // Admin payments and safe backup endpoints
      assert.equal((await req('/admin/payments', { cookie: buyerCookie })).status, 403);
      const adminCookie = (await req('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).cookie;
      const payList = (await req('/admin/payments', { cookie: adminCookie })).data;
      assert.ok(payList.transactions.length >= 1);
      assert.equal(payList.transactions[0].gateway, 'click');
      assert.equal(payList.summary.paid_count, 1);

      const backup = (await req('/admin/backup', { cookie: adminCookie })).data;
      assert.ok(Array.isArray(backup.products) && backup.products.length >= 1);
      assert.equal(backup.users, undefined);
    });
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevNodeEnv;
    if (prevSandbox === undefined) delete process.env.CLICK_SANDBOX_MOCK; else process.env.CLICK_SANDBOX_MOCK = prevSandbox;
    if (prevPayments === undefined) delete process.env.PAYMENTS_ENABLED; else process.env.PAYMENTS_ENABLED = prevPayments;
    if (prevShip === undefined) delete process.env.SHIPPING_INCLUDED_IN_PRICE; else process.env.SHIPPING_INCLUDED_IN_PRICE = prevShip;
  }
});

test('Growth features: Q&A, photo review helpful vote, alerts, wallet cashback/redeem, saved Click token, IDOR chat, receipt, escrow payouts, excel export & label', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSandbox = process.env.CLICK_SANDBOX_MOCK;
  const prevPayments = process.env.PAYMENTS_ENABLED;
  const prevShip = process.env.SHIPPING_INCLUDED_IN_PRICE;
  try {
    process.env.NODE_ENV = 'test';
    process.env.CLICK_SANDBOX_MOCK = 'true';
    process.env.PAYMENTS_ENABLED = 'false';
    process.env.SHIPPING_INCLUDED_IN_PRICE = 'false';

    const tgMessages = [];
    await withDbApp(async ({ req, pool, base }) => {
      const adminCookie = (await req('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).cookie;

      // Register seller and get approved by admin
      const sellerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Growth Sotuvchi', email: 'gseller@example.com', password: 'StrongPass!2026', agree: true } })).cookie;
      await req('/seller/request', { method: 'POST', cookie: sellerCookie, body: {} });
      const sellersList = (await req('/admin/sellers', { cookie: adminCookie })).data.sellers;
      const sellerRow = sellersList.find(s => s.email === 'gseller@example.com');
      await req(`/admin/sellers/${sellerRow.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'approved' } });

      // Seller creates a product with Flash Sale & Bundle discount
      const createdProd = await req('/seller/products', {
        method: 'POST',
        cookie: sellerCookie,
        body: {
          name: 'Qishki Termo Krujka',
          description: 'Issiqlikni 12 soat saqlaydigan po‘lat termo krujka.',
          category: 'uy',
          price: 250000,
          flashSalePrice: 200000,
          flashSaleUntil: new Date(Date.now() + 3600_000).toISOString(),
          bundleDiscountPercent: 10,
          stock: 6,
          stockMode: 'tracked',
          restockDays: 3
        }
      });
      assert.equal(createdProd.status, 201);
      const pid = createdProd.data.product.id;
      await req(`/admin/products/${pid}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'active' } });

      // Promote product to TOP
      const promoRes = await req(`/seller/products/${pid}/promote`, { method: 'POST', cookie: sellerCookie, body: { promoted: true } });
      assert.equal(promoRes.status, 200);
      assert.equal(promoRes.data.product.is_promoted, true);

      // Register buyer & stranger
      const buyerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Growth Xaridor', email: 'gbuyer@example.com', password: 'StrongPass!2026', agree: true } })).cookie;
      const strangerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Begona User', email: 'stranger@example.com', password: 'StrongPass!2026', agree: true } })).cookie;

      // Link buyer Telegram chat to phone & save phone in profile to test notifications
      await req('/me', { method: 'PATCH', cookie: buyerCookie, body: { name: 'Growth Xaridor', phone: '+998901234500' } });
      await pool.query("INSERT INTO telegram_phone_links(phone, chat_id, telegram_user_id, username) VALUES('998901234500', 778899, 778899, 'buyer_tg')");

      // Product Q&A + Seller Inbox + Answer
      const qRes = await req(`/products/${pid}/questions`, { method: 'POST', cookie: buyerCookie, body: { question: 'Issiq suv necha soat issiq turadi?' } });
      assert.equal(qRes.status, 201);
      const qid = qRes.data.question.id;
      assert.equal((await req(`/questions/${qid}/answer`, { method: 'PATCH', cookie: strangerCookie, body: { answer: 'No' } })).status, 403);
      const ansRes = await req(`/questions/${qid}/answer`, { method: 'PATCH', cookie: sellerCookie, body: { answer: '12 soatgacha issiq saqlaydi.' } });
      assert.equal(ansRes.status, 200);
      assert.equal(ansRes.data.question.answer, '12 soatgacha issiq saqlaydi.');
      const sellerQs = (await req('/seller/questions', { cookie: sellerCookie })).data.questions;
      assert.equal(sellerQs.length, 1);

      // Photo review & helpful vote
      const revRes = await req(`/products/${pid}/reviews`, {
        method: 'POST',
        cookie: buyerCookie,
        body: { rating: 5, comment: 'Sifati zo‘r ekan!', photos: ['https://example.com/cup.jpg'] }
      });
      assert.equal(revRes.status, 201);
      const rid = revRes.data.review.id;
      const vote1 = await req(`/reviews/${rid}/helpful`, { method: 'POST', cookie: strangerCookie, body: {} });
      assert.equal(vote1.data.helpful_count, 1);
      const vote2 = await req(`/reviews/${rid}/helpful`, { method: 'POST', cookie: strangerCookie, body: {} });
      assert.equal(vote2.data.helpful_count, 0);

      // Selective cart persistence
      const cartPut = await req('/cart', { method: 'PUT', cookie: buyerCookie, body: { items: [{ id: pid, qty: 2, selected: false }] } });
      assert.equal(cartPut.status, 200);
      const cartGet = (await req('/cart', { cookie: buyerCookie })).data.items;
      assert.equal(cartGet[0].selected, false);

      // Price-drop alert trigger when seller drops price
      await req(`/products/${pid}/alerts`, { method: 'POST', cookie: buyerCookie, body: { type: 'price_drop', targetPrice: 230000 } });
      const alertsBefore = (await req('/me/alerts', { cookie: buyerCookie })).data.alerts;
      assert.equal(alertsBefore.length, 1);

      // Order 1 with bundle qty=2 + Click saveCard=true -> earns 2% cashback & credits seller escrow (95%)
      const o1 = await req('/orders', {
        method: 'POST',
        cookie: buyerCookie,
        body: {
          recipient: 'Growth Xaridor',
          phone: '+998 90 123 45 00',
          deliveryMode: 'courier',
          region: 'Toshkent shahri',
          district: 'Yunusobod tumani',
          address: 'Amir Temur 10',
          paymentMethod: 'click',
          checkoutKey: randomUUID(),
          agree: true,
          items: [{ id: pid, qty: 2 }]
        }
      });
      assert.equal(o1.status, 201);
      // 200000 flash price * (1 - 0.10 bundle) = 180000 * 2 = 360000
      assert.equal(o1.data.subtotal, 360000);

      const cr1 = await req('/payments/click/card-request', {
        method: 'POST',
        cookie: buyerCookie,
        body: { orderId: o1.data.id, cardNumber: '8600 0000 0000 0007', expireDate: '12/28', saveCard: true }
      });
      const cv1 = await req('/payments/click/card-verify', {
        method: 'POST',
        cookie: buyerCookie,
        body: { orderId: o1.data.id, smsCode: cr1.data.sandboxSmsCode }
      });
      assert.equal(cv1.status, 200);
      assert.equal(cv1.data.savedCard, true);

      // Verify buyer 2% cashback bonus (7200) & saved card exists
      const wallet1 = (await req('/me/wallet', { cookie: buyerCookie })).data;
      assert.equal(wallet1.bonusBalance, 7200);
      const savedCards = (await req('/payments/click/cards', { cookie: buyerCookie })).data.cards;
      assert.equal(savedCards.length, 1);

      // Order 2 uses bonus balance & pays in 1 click using saved card token
      const o2 = await req('/orders', {
        method: 'POST',
        cookie: buyerCookie,
        body: {
          recipient: 'Growth Xaridor',
          phone: '+998 90 123 45 00',
          deliveryMode: 'courier',
          region: 'Toshkent shahri',
          district: 'Yunusobod tumani',
          address: 'Amir Temur 10',
          paymentMethod: 'click',
          useBonus: true,
          checkoutKey: randomUUID(),
          agree: true,
          items: [{ id: pid, qty: 1 }]
        }
      });
      assert.equal(o2.status, 201);
      assert.equal(o2.data.bonusUsed, 7200);
      assert.equal(o2.data.total, 200000 - 7200);

      const paySaved = await req('/payments/click/pay-saved', {
        method: 'POST',
        cookie: buyerCookie,
        body: { orderId: o2.data.id, cardId: savedCards[0].id }
      });
      assert.equal(paySaved.status, 200);
      assert.equal(paySaved.data.paymentStatus, 'paid');

      // Delete saved card
      assert.equal((await req(`/payments/click/cards/${savedCards[0].id}`, { method: 'DELETE', cookie: buyerCookie, body: {} })).status, 200);

      // IDOR-protected Order Chat & Electronic Receipt
      assert.equal((await req(`/orders/${o1.data.id}/messages`, { cookie: strangerCookie })).status, 403);
      assert.equal((await req(`/orders/${o1.data.id}/messages`, { method: 'POST', cookie: buyerCookie, body: { message: 'Tezroq jo‘nating iltimos' } })).status, 201);
      assert.equal((await req(`/orders/${o1.data.id}/messages`, { method: 'POST', cookie: sellerCookie, body: { message: 'Bugun UzPostga topshiramiz!' } })).status, 201);
      const chatMsgs = (await req(`/orders/${o1.data.id}/messages`, { cookie: buyerCookie })).data.messages;
      assert.equal(chatMsgs.length, 2);

      const receiptRes = (await req(`/orders/${o1.data.id}/receipt`, { cookie: buyerCookie })).data.receipt;
      assert.match(receiptRes.receiptNumber, /^MKT-/);
      assert.equal(receiptRes.total, 360000);

      // Seller Escrow balance & Payout reject refund -> then approve
      const sellerPayoutInit = (await req('/seller/payouts', { cookie: sellerCookie })).data;
      assert.ok(sellerPayoutInit.sellerBalance > 500000);
      const reqP1 = await req('/seller/payouts', {
        method: 'POST',
        cookie: sellerCookie,
        body: { amount: 100000, cardMask: '8600 **** **** 0001', recipientName: 'Growth Sotuvchi' }
      });
      assert.equal(reqP1.status, 201);
      await req(`/admin/payouts/${reqP1.data.payout.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'rejected', note: 'Test refund' } });
      const afterReject = (await req('/seller/payouts', { cookie: sellerCookie })).data.sellerBalance;
      assert.equal(afterReject, sellerPayoutInit.sellerBalance);

      // Seller Orders Excel export & Nakladnoy shipping label
      const sellerOrders = (await req('/seller/orders', { cookie: sellerCookie })).data.items;
      assert.ok(sellerOrders.length >= 1);
      const labelRes = (await req(`/seller/order-items/${sellerOrders[0].id}/label`, { cookie: sellerCookie })).data.label;
      assert.equal(labelRes.recipient, 'Growth Xaridor');
      const xlsxResp = await fetch(base + '/seller/orders.xlsx', { headers: { Cookie: sellerCookie } });
      assert.equal(xlsxResp.status, 200);
      const xlsxBytes = new Uint8Array(await xlsxResp.arrayBuffer());
      assert.equal(xlsxBytes[0], 0x50);
      assert.equal(xlsxBytes[1], 0x4b);

      // Admin updates order tracking + status -> verify Telegram webhook transport received messages
      await req(`/admin/orders/${o1.data.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'accepted' } });
      await req(`/admin/orders/${o1.data.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'packing' } });
      await req(`/admin/orders/${o1.data.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'handed_over', trackingNumber: 'UZP12345678' } });
      await new Promise(r => setTimeout(r, 80));
      assert.ok(tgMessages.some(m => String(m.text).includes('UZP12345678')));

      // Seller drops product price -> verifies buyer receives price-drop Telegram alert
      await req(`/seller/products/${pid}`, {
        method: 'PATCH',
        cookie: sellerCookie,
        body: {
          name: 'Qishki Termo Krujka',
          description: 'Issiqlikni 12 soat saqlaydigan po‘lat termo krujka.',
          category: 'uy',
          price: 190000,
          stock: 3,
          stockMode: 'tracked',
          restockDays: 3
        }
      });
      await req(`/admin/products/${pid}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'active' } });
      await new Promise(r => setTimeout(r, 120));
      const notifs = (await req('/notifications', { cookie: buyerCookie })).data.notifications;
      assert.ok(notifs.some(n => n.kind === 'alert'));
      assert.ok(tgMessages.some(m => String(m.text).includes('Narx tushdi') || String(m.text).includes('omborga')));
    }, { telegramTransport: async payload => { tgMessages.push(payload); return { ok: true }; } });
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevNodeEnv;
    if (prevSandbox === undefined) delete process.env.CLICK_SANDBOX_MOCK; else process.env.CLICK_SANDBOX_MOCK = prevSandbox;
    if (prevPayments === undefined) delete process.env.PAYMENTS_ENABLED; else process.env.PAYMENTS_ENABLED = prevPayments;
    if (prevShip === undefined) delete process.env.SHIPPING_INCLUDED_IN_PRICE; else process.env.SHIPPING_INCLUDED_IN_PRICE = prevShip;
  }
});

test('Security hardening & new analytics/flash endpoints: Click OTP 5-fail lockout, sandboxed /media CSP, flashOnly feed, dailySales & securityPosture', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSandbox = process.env.CLICK_SANDBOX_MOCK;
  const prevPayments = process.env.PAYMENTS_ENABLED;
  try {
    process.env.NODE_ENV = 'test';
    process.env.CLICK_SANDBOX_MOCK = 'true';
    process.env.PAYMENTS_ENABLED = 'false';

    await withDbApp(async ({ req, base }) => {
      const adminCookie = (await req('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).cookie;
      const sellerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Sec Sotuvchi', email: 'secseller@example.com', password: 'StrongPass!2026', agree: true } })).cookie;
      await req('/seller/request', { method: 'POST', cookie: sellerCookie, body: {} });
      const sellerRow = (await req('/admin/sellers', { cookie: adminCookie })).data.sellers.find(s => s.email === 'secseller@example.com');
      await req(`/admin/sellers/${sellerRow.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'approved' } });

      // Flash sale product & /catalog/feed?flashOnly=true filter
      const pRes = await req('/seller/products', {
        method: 'POST',
        cookie: sellerCookie,
        body: {
          name: 'Flash Lamp',
          description: 'Yorqin stol chirog‘i chegirmada.',
          category: 'uy',
          price: 180000,
          flashSalePrice: 120000,
          flashSaleUntil: new Date(Date.now() + 7200_000).toISOString(),
          stock: 10,
          stockMode: 'tracked',
          restockDays: 3
        }
      });
      const pid = pRes.data.product.id;
      await req(`/admin/products/${pid}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'active' } });
      const flashFeed = (await req('/catalog/feed?flashOnly=true&limit=10')).data.products;
      assert.equal(flashFeed.length, 1);
      assert.equal(flashFeed[0].id, pid);

      // Seller 7-day dailySales & Admin securityPosture
      const sAnalytics = (await req('/seller/analytics', { cookie: sellerCookie })).data;
      assert.equal(sAnalytics.dailySales.length, 7);
      const mon = (await req('/admin/monitoring', { cookie: adminCookie })).data;
      assert.equal(mon.securityPosture.cspStrict, true);
      assert.equal(mon.securityPosture.sandboxedMedia, true);
      assert.ok(mon.securityPosture.rateLimitersActive.includes('cardPay'));

      // Sandboxed /media/:id security headers
      const pngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
      const asset = await req('/assets', { method: 'POST', cookie: sellerCookie, body: { data: 'data:image/png;base64,' + pngBytes.toString('base64') } });
      assert.equal(asset.status, 201);
      const rootUrl = base.replace(/\/api$/, '');
      const mediaResp = await fetch(rootUrl + asset.data.url);
      assert.equal(mediaResp.status, 200);
      assert.equal(mediaResp.headers.get('content-security-policy'), "default-src 'none'; sandbox");
      assert.equal(mediaResp.headers.get('cross-origin-resource-policy'), 'same-origin');

      // Click OTP 5 wrong attempts lockout
      const buyerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Sec Buyer', email: 'secbuyer@example.com', password: 'StrongPass!2026', agree: true } })).cookie;
      const ord = await req('/orders', {
        method: 'POST',
        cookie: buyerCookie,
        body: { recipient: 'Sec Buyer', phone: '+998 90 444 55 66', deliveryMode: 'courier', region: 'Toshkent shahri', district: 'Yunusobod tumani', address: 'Chorsu 1', paymentMethod: 'click', checkoutKey: randomUUID(), agree: true, items: [{ id: pid, qty: 1 }] }
      });
      const cr = await req('/payments/click/card-request', { method: 'POST', cookie: buyerCookie, body: { orderId: ord.data.id, cardNumber: '8600 0000 0000 0007', expireDate: '12/28' } });
      const wrongOtp = cr.data.sandboxSmsCode === '111111' ? '222222' : '111111';
      for (let i = 0; i < 4; i++) {
        const failRes = await req('/payments/click/card-verify', { method: 'POST', cookie: buyerCookie, body: { orderId: ord.data.id, smsCode: wrongOtp } });
        assert.equal(failRes.status, 400);
      }
      const fifth = await req('/payments/click/card-verify', { method: 'POST', cookie: buyerCookie, body: { orderId: ord.data.id, smsCode: wrongOtp } });
      assert.equal(fifth.status, 429);
      const afterLock = await req('/payments/click/card-verify', { method: 'POST', cookie: buyerCookie, body: { orderId: ord.data.id, smsCode: cr.data.sandboxSmsCode } });
      assert.equal(afterLock.status, 400);
    });
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevNodeEnv;
    if (prevSandbox === undefined) delete process.env.CLICK_SANDBOX_MOCK; else process.env.CLICK_SANDBOX_MOCK = prevSandbox;
    if (prevPayments === undefined) delete process.env.PAYMENTS_ENABLED; else process.env.PAYMENTS_ENABLED = prevPayments;
  }
});
