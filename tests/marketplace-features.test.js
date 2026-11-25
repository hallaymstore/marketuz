import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';
import { calculateShipping, createShippingProvider } from '../shipping.js';
import { computePromoDiscount } from '../marketplace-features.js';
import { isClickSandboxAllowed } from '../payment-handlers.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://marketuz:marketuz_local_test_pw@127.0.0.1:5432/marketuz_test';

async function withDbApp(fn) {
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

  const { app, pool, initialize } = createApp();
  await initialize();
  const adminPool = new pg.Pool({ connectionString: TEST_DB_URL });
  await adminPool.query('TRUNCATE TABLE notifications, return_requests, promo_codes, product_reviews, cart_items, audit_logs, security_events, auth_attempts, user_sessions, sms_requests, phone_otps, shipment_events, payment_transactions, order_items, orders, favorites, product_events, seller_follows, product_variants, products, site_assets, settings_audit, site_settings, users RESTART IDENTITY CASCADE');
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
    await fn({ req, pool });
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

      // Nearest UzPost branch sorting around Tashkent center
      const branchRes = (await req('/shipping/branches?lat=41.3111&lng=69.2797')).data;
      assert.ok(branchRes.branches.length >= 10);
      assert.equal(branchRes.branches[0].region, 'Toshkent shahri');
      assert.ok(branchRes.branches[0].distanceKm <= branchRes.branches[1].distanceKm);

      const buyerCookie = (await req('/auth/register', { method: 'POST', body: { name: 'Filial Xaridor', email: 'pickup@example.com', password: 'StrongPass!2026', agree: true } })).cookie;
      const cat = (await req('/catalog')).data;
      const pid = cat.products.find(p => p.stock_mode !== 'replenishable' && !p.variant_count && p.stock >= 1).id;

      // Create order with UzPost branch pickup + Click sandbox payment
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
      assert.match(order.data.paymentUrl, /^\/api\/payments\/click\/sandbox-pay\?orderId=/);

      // Complete sandbox payment
      const payResp = await req('/payments/click/sandbox-pay', {
        method: 'POST',
        body: { orderId: order.data.id, decision: 'pay' }
      });
      assert.ok([200, 303].includes(payResp.status));

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
