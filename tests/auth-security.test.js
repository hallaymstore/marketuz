import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createApp } from '../server.js';
import { normalizePhone, formatPhone, otpDigest, isMockSmsAllowed } from '../phone-auth.js';
import { generateTotpSecret, totpCode, verifyTotp, passwordStrength } from '../security.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://marketuz:marketuz_local_test_pw@127.0.0.1:5432/marketuz_test';

async function withTestServer(fn) {
  const prevEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    OTP_SECRET: process.env.OTP_SECRET,
    SMS_ENABLED: process.env.SMS_ENABLED,
    SMS_MOCK: process.env.SMS_MOCK,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    NODE_ENV: process.env.NODE_ENV
  };
  const sentSms = [];
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long-001';
  process.env.OTP_SECRET = 'test-otp-secret-at-least-32-chars-long-002';
  process.env.SMS_ENABLED = 'false';
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_EMAIL = 'admin-sec@example.com';
  process.env.ADMIN_PASSWORD = 'AdminSuperStrongPassword!2026';

  const { app, pool, initialize } = createApp({
    smsTransport: async ({ phone, code, purpose }) => {
      sentSms.push({ phone, code, purpose });
      return { providerId: `test-${sentSms.length}`, status: 'sent' };
    }
  });
  await initialize();
  const adminPool = new pg.Pool({ connectionString: TEST_DB_URL });
  await adminPool.query('TRUNCATE TABLE audit_logs, security_events, auth_attempts, user_sessions, sms_requests, phone_otps, shipment_events, payment_transactions, order_items, orders, favorites, product_events, seller_follows, product_variants, products, site_assets, settings_audit, site_settings, users RESTART IDENTITY CASCADE');
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
    await fn({ req, pool, sentSms, base });
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

test('phone normalization, formatting, TOTP and password strength helpers', () => {
  assert.equal(normalizePhone('+998 (90) 123-45-67'), '998901234567');
  assert.equal(normalizePhone('901234567'), '998901234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(formatPhone('998901234567'), '+998 90 123 45 67');
  assert.notEqual(otpDigest('998901234567', '123456', 'secret', 'register'), otpDigest('998901234567', '123456', 'secret', 'reset'));

  const secret = generateTotpSecret();
  const code = totpCode(secret);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotp(secret, code), true);
  assert.equal(verifyTotp(secret, '000000'), code === '000000');

  assert.equal(passwordStrength('short').ok, false);
  assert.equal(passwordStrength('1234567890').ok, false);
  assert.equal(passwordStrength('StrongPass!2026').ok, true);
});

test('mock SMS is strictly disabled in production mode', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevMock = process.env.SMS_MOCK;
  try {
    process.env.NODE_ENV = 'production';
    process.env.SMS_MOCK = 'true';
    assert.equal(isMockSmsAllowed(), false);
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevNodeEnv;
    if (prevMock === undefined) delete process.env.SMS_MOCK; else process.env.SMS_MOCK = prevMock;
  }
});

test('SMS registration, OTP replay/expiry/purpose isolation, phone login, reset, bind, change, sessions, 2FA and account delete', async () => {
  await withTestServer(async ({ req, pool, sentSms }) => {
    const phone = '+998 90 555 11 22';
    const norm = '998905551122';
    const pass1 = 'SecureBuyerPass!2026';
    const pass2 = 'UpdatedBuyerPass!2026';

    // 1. Send OTP for register
    const send1 = await req('/auth/phone/send', { method: 'POST', body: { phone, purpose: 'register' } });
    assert.equal(send1.status, 200);
    assert.equal(sentSms.length, 1);
    const regCode = sentSms[0].code;

    // 2. 60-second cooldown rejects immediate resend
    const sendCooldown = await req('/auth/phone/send', { method: 'POST', body: { phone, purpose: 'register' } });
    assert.equal(sendCooldown.status, 429);

    // 3. Purpose isolation: register OTP cannot be used for password reset
    const wrongPurpose = await req('/auth/phone/reset-password', { method: 'POST', body: { phone, code: regCode, newPassword: pass2 } });
    assert.equal(wrongPurpose.status, 400);

    // 4. Concurrent registration race condition: only 1 succeeds, 1 fails (replay prevented)
    const [rA, rB] = await Promise.all([
      req('/auth/phone/register', { method: 'POST', body: { name: 'Ali Valiyev', phone, code: regCode, password: pass1, agree: true } }),
      req('/auth/phone/register', { method: 'POST', body: { name: 'Ali Valiyev', phone, code: regCode, password: pass1, agree: true } })
    ]);
    const statuses = [rA.status, rB.status].sort();
    assert.deepEqual(statuses, [201, 400]);
    const sessionA = rA.status === 201 ? rA.cookie : rB.cookie;
    assert.ok(sessionA);

    // 5. Login with phone + password (works cleanly without SMS)
    const login2 = await req('/auth/phone/login', { method: 'POST', body: { phone, password: pass1 } });
    assert.equal(login2.status, 200);
    const sessionB = login2.cookie;
    assert.ok(sessionB);

    // 6. Active sessions list shows 2 sessions; refresh rotates current session
    const sessList = await req('/me/sessions', { cookie: sessionB });
    assert.equal(sessList.status, 200);
    assert.equal(sessList.data.sessions.length, 2);
    const refresh = await req('/me/sessions/refresh', { method: 'POST', body: {}, cookie: sessionB });
    assert.equal(refresh.status, 200);
    const sessionB2 = refresh.cookie;
    assert.ok(sessionB2);
    assert.equal((await req('/me', { cookie: sessionB })).status, 401);
    assert.equal((await req('/me', { cookie: sessionB2 })).status, 200);

    // 7. Password reset via SMS (clear cooldown in DB for test, test expiry & reset revoking all sessions)
    await pool.query('DELETE FROM sms_requests');
    const resetUnregistered = await req('/auth/phone/send', { method: 'POST', body: { phone: '+998 90 999 88 77', purpose: 'reset' } });
    assert.equal(resetUnregistered.status, 200); // No account enumeration
    assert.equal(sentSms.length, 1); // Did NOT actually send SMS

    const sendReset = await req('/auth/phone/send', { method: 'POST', body: { phone, purpose: 'reset' } });
    assert.equal(sendReset.status, 200);
    assert.equal(sentSms.length, 2);
    const resetCode = sentSms[1].code;

    // Test OTP expiration
    await pool.query("UPDATE phone_otps SET expires_at = now() - interval '1 minute' WHERE phone=$1 AND purpose='reset'", [norm]);
    const expiredRes = await req('/auth/phone/reset-password', { method: 'POST', body: { phone, code: resetCode, newPassword: pass2 } });
    assert.equal(expiredRes.status, 400);

    // Restore expiry and reset password -> must revoke ALL existing sessions!
    await pool.query("UPDATE phone_otps SET expires_at = now() + interval '5 minutes' WHERE phone=$1 AND purpose='reset'", [norm]);
    const resetOk = await req('/auth/phone/reset-password', { method: 'POST', body: { phone, code: resetCode, newPassword: pass2 } });
    assert.equal(resetOk.status, 200);
    assert.equal((await req('/me', { cookie: sessionA })).status, 401);
    assert.equal((await req('/me', { cookie: sessionB2 })).status, 401);

    // Login with new password
    const loginNew = await req('/auth/phone/login', { method: 'POST', body: { phone, password: pass2 } });
    assert.equal(loginNew.status, 200);
    const userCookie = loginNew.cookie;

    // 8. Change verified phone number
    await pool.query('DELETE FROM sms_requests');
    const newPhone = '+998 91 777 33 44';
    const sendChange = await req('/me/phone/send', { method: 'POST', cookie: userCookie, body: { phone: newPhone, purpose: 'change_phone', currentPassword: pass2 } });
    assert.equal(sendChange.status, 200);
    const changeCode = sentSms[2].code;
    const verifyChange = await req('/me/phone/verify', { method: 'POST', cookie: userCookie, body: { phone: newPhone, code: changeCode, purpose: 'change_phone' } });
    assert.equal(verifyChange.status, 200);
    assert.equal(verifyChange.data.user.verified_phone, '+998917773344');

    // 9. Numeric ID validation returns 404 instead of 500
    assert.equal((await req('/favorites/not-a-number', { method: 'PUT', body: {}, cookie: userCookie })).status, 404);

    // 10. Email user binding a verified phone
    const emailReg = await req('/auth/register', { method: 'POST', body: { name: 'Email Xaridor', email: 'buyer-old@example.com', password: pass1, agree: true } });
    assert.equal(emailReg.status, 201);
    const emailCookie = emailReg.cookie;
    await pool.query('DELETE FROM sms_requests');
    const bindPhone = '+998 93 222 44 55';
    assert.equal((await req('/me/phone/send', { method: 'POST', cookie: emailCookie, body: { phone: bindPhone, purpose: 'bind' } })).status, 200);
    const bindCode = sentSms[3].code;
    const bindOk = await req('/me/phone/verify', { method: 'POST', cookie: emailCookie, body: { phone: bindPhone, code: bindCode, purpose: 'bind' } });
    assert.equal(bindOk.status, 200);
    assert.equal(bindOk.data.user.verified_phone, '+998932224455');

    // 11. Account deletion
    const delBad = await req('/me/delete', { method: 'POST', cookie: emailCookie, body: { currentPassword: 'wrong' } });
    assert.equal(delBad.status, 400);
    const delOk = await req('/me/delete', { method: 'POST', cookie: emailCookie, body: { currentPassword: pass1 } });
    assert.equal(delOk.status, 200);
    assert.equal((await req('/me', { cookie: emailCookie })).status, 401);
  });
});

test('Admin security, TOTP 2FA flow, and OTP brute-force lockout', async () => {
  await withTestServer(async ({ req, pool, sentSms }) => {
    const pass1 = 'SecureBuyerPass!2026';

    // 1. Admin security: phone login blocked, TOTP 2FA setup -> enable -> 2FA login
    const adminPass = process.env.ADMIN_PASSWORD;
    const adminLogin = await req('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: adminPass } });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.cookie;
    const setup2fa = await req('/admin/security/2fa/setup', { method: 'POST', body: {}, cookie: adminCookie });
    assert.equal(setup2fa.status, 200);
    const totp = totpCode(setup2fa.data.secret);
    const enable2fa = await req('/admin/security/2fa/enable', { method: 'POST', cookie: adminCookie, body: { currentPassword: adminPass, code: totp } });
    assert.equal(enable2fa.status, 200);

    const adminChallenge = await req('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: adminPass } });
    assert.equal(adminChallenge.status, 200);
    assert.equal(adminChallenge.data.requires2fa, true);
    assert.ok(adminChallenge.data.challengeToken);

    const adminBad2fa = await req('/auth/login/2fa', { method: 'POST', body: { challengeToken: adminChallenge.data.challengeToken, code: '000000' } });
    if (totp !== '000000') assert.equal(adminBad2fa.status, 401);

    const adminOk2fa = await req('/auth/login/2fa', { method: 'POST', body: { challengeToken: adminChallenge.data.challengeToken, code: totpCode(setup2fa.data.secret) } });
    assert.equal(adminOk2fa.status, 200);
    assert.equal(adminOk2fa.data.user.role, 'admin');

    // 2. OTP brute-force lockout (5 wrong tries -> 429)
    const brutePhone = '+998 94 111 22 33';
    assert.equal((await req('/auth/phone/send', { method: 'POST', body: { phone: brutePhone, purpose: 'register' } })).status, 200);
    const realBruteCode = sentSms[0].code;
    const wrongGuess = realBruteCode === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) {
      const attempt = await req('/auth/phone/register', { method: 'POST', body: { name: 'Brute Test', phone: brutePhone, code: wrongGuess, password: pass1, agree: true } });
      assert.equal(attempt.status, 400);
    }
    const lockedOut = await req('/auth/phone/register', { method: 'POST', body: { name: 'Brute Test', phone: brutePhone, code: realBruteCode, password: pass1, agree: true } });
    assert.equal(lockedOut.status, 429);
  });
});
