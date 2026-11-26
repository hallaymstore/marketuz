import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  checkAuthLockout,
  logSecurityEvent,
  passwordStrength,
  recordAuthAttempt
} from './security.js';

export const OTP_TTL_MINUTES = 5;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
export const VALID_OTP_PURPOSES = new Set(['register', 'reset', 'bind', 'change_phone']);

export function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (raw.length > 32 || !/^\+?[\d ()-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 9) digits = '998' + digits;
  return /^998\d{9}$/.test(digits) ? digits : null;
}

export function formatPhone(value) {
  const digits = normalizePhone(value);
  if (!digits) return '';
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

export function otpSecretValue() {
  return process.env.OTP_SECRET || '';
}

export function isMockSmsAllowed() {
  return process.env.NODE_ENV !== 'production' && process.env.SMS_MOCK === 'true';
}

export const eskizConfigured = () =>
  process.env.SMS_ENABLED === 'true' &&
  !!(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD && otpSecretValue().length >= 32);

export const telegramOtpConfigured = () =>
  !!(process.env.TELEGRAM_BOT_TOKEN && otpSecretValue().length >= 32);

export const otpMode = () =>
  eskizConfigured() ? 'sms' : telegramOtpConfigured() ? 'telegram' : isMockSmsAllowed() ? 'mock' : 'none';

export const smsReady = () =>
  eskizConfigured() || telegramOtpConfigured() || (isMockSmsAllowed() && otpSecretValue().length >= 32);

let token = null;
let tokenUntil = 0;
const devSmsInbox = [];

function recordDevSms({ phone, code, purpose, message }) {
  if (!isMockSmsAllowed()) return;
  devSmsInbox.unshift({
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    phone: '+' + phone,
    code,
    purpose,
    message,
    createdAt: new Date().toISOString()
  });
  if (devSmsInbox.length > 25) devSmsInbox.length = 25;
  console.log(`[DEV MOCK SMS] ${'+' + phone} (${purpose}): ${code}`);
}

async function eskizRequest(path, { method = 'POST', fields = null, bearer = null } = {}) {
  const response = await fetch('https://notify.eskiz.uz/api/' + path, {
    method,
    headers: bearer ? { Authorization: 'Bearer ' + bearer } : {},
    body: fields ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(12_000)
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return { ok: response.ok, status: response.status, payload };
}

async function getEskizToken(forceLogin = false) {
  const now = Date.now();
  if (!forceLogin && token && now < tokenUntil) return token;
  if (!forceLogin && token && now >= tokenUntil) {
    try {
      const refreshed = await eskizRequest('auth/refresh', { method: 'PATCH', bearer: token });
      if (refreshed.ok && refreshed.payload?.data?.token) {
        token = refreshed.payload.data.token;
        tokenUntil = now + 20 * 24 * 60 * 60 * 1000;
        return token;
      }
    } catch {
      token = null;
    }
  }
  const login = await eskizRequest('auth/login', {
    method: 'POST',
    fields: { email: process.env.ESKIZ_EMAIL, password: process.env.ESKIZ_PASSWORD }
  });
  const nextToken = login.payload?.data?.token;
  if (!login.ok || !nextToken) throw new Error('SMS provider authentication failed');
  token = nextToken;
  tokenUntil = now + 20 * 24 * 60 * 60 * 1000;
  return token;
}

export function smsMessageFor(purpose, code) {
  if (purpose === 'reset') return `MarketUZ parolni tiklash kodi: ${code}. Kodni hech kimga bermang.`;
  if (purpose === 'bind' || purpose === 'change_phone') return `MarketUZ telefon raqamini tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`;
  return `MarketUZ tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`;
}

async function sendViaEskiz({ phone, code, purpose }) {
  const message = smsMessageFor(purpose, code);
  const from = process.env.ESKIZ_SENDER || '4546';
  let bearer = await getEskizToken(false);
  let res = await eskizRequest('message/sms/send', {
    method: 'POST',
    bearer,
    fields: { mobile_phone: phone, message, from }
  });
  if (res.status === 401) {
    token = null;
    bearer = await getEskizToken(true);
    res = await eskizRequest('message/sms/send', {
      method: 'POST',
      bearer,
      fields: { mobile_phone: phone, message, from }
    });
  }
  const st = String(res.payload?.status || '').toLowerCase();
  if (!res.ok || !['waiting', 'success', 'accepted'].includes(st)) {
    throw new Error('SMS provider rejected request');
  }
  return {
    providerId: String(res.payload?.id || res.payload?.data?.id || ''),
    status: st || 'queued'
  };
}

export function otpDigest(phone, code, secret, purpose = 'register') {
  return createHmac('sha256', secret).update(`${purpose}:${phone}:${code}`).digest('hex');
}

function safeHexEqual(aHex, bHex) {
  if (typeof aHex !== 'string' || typeof bHex !== 'string') return false;
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function mountPhoneAuth(
  app,
  { pool, requireDb, auth, rateAuth, route, fail, hashPassword, verifyPassword, createSession, revokeUserSessions, smsTransport = null, telegramTransport = null, getTelegramBotUsername = () => '' }
) {
  const activeReady = () => smsReady() || (process.env.NODE_ENV !== 'production' && typeof smsTransport === 'function');

  const ready = () => {
    if (!activeReady()) throw fail(503, 'SMS yoki Telegram OTP xizmati hozircha sozlanmagan.');
  };

  const phoneOf = value => {
    const phone = normalizePhone(value);
    if (!phone) throw fail(400, 'Telefon raqamini +998 XX XXX XX XX ko‘rinishida kiriting.');
    return phone;
  };

  const botUrlFor = (purpose = 'register') => {
    const uname = String(getTelegramBotUsername?.() || process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
    return uname ? `https://t.me/${uname}?start=otp_${purpose}` : '';
  };

  const sendViaTelegram = async ({ phone, code, purpose }) => {
    const link = (await pool.query('SELECT chat_id FROM telegram_phone_links WHERE phone=$1', [phone])).rows[0];
    if (!link) {
      throw Object.assign(
        fail(409, 'Avval Telegram botimizga kirib "Telefon raqamimni ulashish" tugmasini bosing, so‘ng kod olishni bosing.'),
        { extra: { needsTelegramLink: true, botUrl: botUrlFor(purpose) } }
      );
    }
    const text = `Marketuz tasdiqlash kodi: <b>${code}</b>\n\nKod 5 daqiqa amal qiladi. Uni hech kimga bermang.`;
    if (process.env.NODE_ENV !== 'production' && typeof telegramTransport === 'function') {
      return telegramTransport({ phone, code, purpose, chatId: link.chat_id, text });
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: link.chat_id, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(12_000)
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) {
      throw new Error('Telegram OTP delivery failed');
    }
    return { providerId: String(payload.result?.message_id || 'tg'), status: 'telegram', channel: 'telegram' };
  };

  const dispatchSms = async ({ phone, code, purpose }) => {
    if (process.env.NODE_ENV !== 'production' && typeof smsTransport === 'function') {
      return smsTransport({ phone, code, purpose, message: smsMessageFor(purpose, code) });
    }
    if (isMockSmsAllowed()) {
      const msg = smsMessageFor(purpose, code);
      recordDevSms({ phone, code, purpose, message: msg });
      return { providerId: `mock-${Date.now()}`, status: 'mock', channel: 'mock' };
    }
    if (eskizConfigured()) {
      const out = await sendViaEskiz({ phone, code, purpose });
      return { ...out, channel: 'sms' };
    }
    if (telegramOtpConfigured()) {
      const out = await sendViaTelegram({ phone, code, purpose });
      return { ...out, channel: 'telegram' };
    }
    throw fail(503, 'OTP xizmati sozlanmagan.');
  };

  async function issueOtp({ phone, purpose, ip, skipProvider = false }) {
    const usesTelegramOnly =
      !skipProvider &&
      !(process.env.NODE_ENV !== 'production' && typeof smsTransport === 'function') &&
      !isMockSmsAllowed() &&
      !eskizConfigured() &&
      telegramOtpConfigured();
    if (usesTelegramOnly) {
      const linked = await pool.query('SELECT chat_id FROM telegram_phone_links WHERE phone=$1', [phone]);
      if (!linked.rowCount) {
        if (purpose === 'reset') {
          return { ok: true, retryAfter: OTP_RESEND_SECONDS, channel: 'telegram' };
        }
        throw Object.assign(
          fail(409, 'Avval Telegram botimizga kirib "Telefon raqamimni ulashish" tugmasini bosing, so‘ng kod olishni bosing.'),
          { extra: { needsTelegramLink: true, botUrl: botUrlFor(purpose) } }
        );
      }
    }
    const secret = otpSecretValue();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const digest = otpDigest(phone, code, secret, purpose);
    const db = await pool.connect();
    let reqId;
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['sms-ip:' + ip]);
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['sms-phone:' + phone]);
      const { rows: [limits] } = await db.query(
        `SELECT
          count(*) FILTER (WHERE phone=$1)::int AS phone_count,
          count(*) FILTER (WHERE ip=$2)::int AS ip_count,
          count(*) FILTER (WHERE phone=$1 AND created_at > now() - interval '60 seconds')::int AS recent
         FROM sms_requests
         WHERE created_at > now() - interval '1 day' AND (phone=$1 OR ip=$2)`,
        [phone, ip]
      );
      if (limits.recent || limits.phone_count >= 5 || limits.ip_count >= 20) {
        throw fail(429, 'SMS yuborish limiti. Birozdan keyin qayta urinib ko‘ring.');
      }
      const inserted = await db.query(
        'INSERT INTO sms_requests(phone, ip, purpose, status) VALUES($1,$2,$3,$4) RETURNING id',
        [phone, ip, purpose, skipProvider ? 'skipped' : 'queued']
      );
      reqId = inserted.rows[0].id;
      if (!skipProvider) {
        await db.query(
          `INSERT INTO phone_otps(phone, purpose, digest, expires_at, attempts, created_at)
           VALUES($1, $2, $3, now() + interval '5 minutes', 0, now())
           ON CONFLICT(phone, purpose) DO UPDATE
             SET digest=excluded.digest, expires_at=excluded.expires_at, attempts=0, created_at=now()`,
          [phone, purpose, digest]
        );
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }

    if (skipProvider) return { ok: true, retryAfter: OTP_RESEND_SECONDS };

    try {
      const sent = await dispatchSms({ phone, code, purpose });
      await pool.query(
        'UPDATE sms_requests SET status=$1, provider_id=$2 WHERE id=$3',
        [String(sent?.status || 'sent').slice(0, 20), String(sent?.providerId || '').slice(0, 120), reqId]
      ).catch(() => {});
      return { ok: true, retryAfter: OTP_RESEND_SECONDS, channel: sent?.channel || 'sms' };
    } catch (err) {
      await pool.query(
        'DELETE FROM phone_otps WHERE phone=$1 AND purpose=$2 AND digest=$3',
        [phone, purpose, digest]
      ).catch(() => {});
      await pool.query("UPDATE sms_requests SET status='failed' WHERE id=$1", [reqId]).catch(() => {});
      if (err?.status) throw err;
      throw fail(502, 'Tasdiqlash kodi yuborilmadi. Keyinroq urinib ko‘ring.');
    }
  }

  async function verifyOtpInTx(db, { phone, purpose, code }) {
    if (!/^\d{6}$/.test(code)) throw fail(400, '6 xonali SMS kodni kiriting.');
    const { rows: [otp] } = await db.query(
      'SELECT * FROM phone_otps WHERE phone=$1 AND purpose=$2 FOR UPDATE',
      [phone, purpose]
    );
    if (!otp || new Date(otp.expires_at) <= new Date()) {
      throw fail(400, 'SMS kod muddati tugagan yoki topilmadi. Yangi kod oling.');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw fail(429, 'Kod kiritish urinishlari tugadi. Yangi SMS kod so‘rang.');
    }
    const expected = otpDigest(phone, code, otpSecretValue(), purpose);
    if (!safeHexEqual(otp.digest, expected)) {
      const nextAttempts = otp.attempts + 1;
      await db.query('UPDATE phone_otps SET attempts=$1 WHERE phone=$2 AND purpose=$3', [nextAttempts, phone, purpose]);
      await db.query('COMMIT');
      const left = OTP_MAX_ATTEMPTS - nextAttempts;
      throw fail(
        400,
        left > 0
          ? `SMS kod noto‘g‘ri. Yana ${left} ta urinish qoldi.`
          : 'Urinishlar soni tugadi. Yangi SMS kod so‘rang.'
      );
    }
    await db.query('DELETE FROM phone_otps WHERE phone=$1 AND purpose=$2', [phone, purpose]);
  }

  app.get('/api/auth/phone/status', (req, res) =>
    res.json({ enabled: !!pool && activeReady(), mock: isMockSmsAllowed() })
  );

  app.get('/api/auth/phone/dev-inbox', (req, res) => {
    if (!isMockSmsAllowed()) return res.status(404).json({ error: 'Topilmadi.' });
    const phone = normalizePhone(req.query.phone || '');
    const messages = phone
      ? devSmsInbox.filter(m => m.phone === '+' + phone).slice(0, 5)
      : devSmsInbox.slice(0, 5);
    res.json({ messages });
  });

  app.post('/api/auth/phone/send', requireDb, rateAuth, route(async (req, res) => {
    ready();
    const purpose = ['register', 'reset'].includes(req.body?.purpose) ? req.body.purpose : 'register';
    const phone = phoneOf(req.body?.phone);
    const ip = req.ip || 'unknown';

    let skipProvider = false;
    if (purpose === 'reset') {
      // Prevent account enumeration: check active non-admin user silently.
      const found = await pool.query(
        "SELECT id FROM users WHERE verified_phone=$1 AND role!='admin' AND deleted_at IS NULL",
        ['+' + phone]
      );
      skipProvider = !found.rowCount;
    }

    const result = await issueOtp({ phone, purpose, ip, skipProvider });
    const viaTg = result.channel === 'telegram';
    res.json({
      ...result,
      message: purpose === 'reset'
        ? (viaTg ? 'Agar bu raqam tizimda mavjud va Telegram botga ulangan bo‘lsa, kod yuborildi.' : 'Agar bu raqam tizimda mavjud bo‘lsa, SMS kod yuborildi.')
        : (viaTg ? 'Tasdiqlash kodi Telegram botingizga yuborildi.' : 'Tasdiqlash kodi SMS orqali yuborildi.')
    });
  }));

  app.post('/api/auth/phone/register', requireDb, rateAuth, route(async (req, res) => {
    ready();
    const phone = phoneOf(req.body?.phone);
    const code = String(req.body?.code ?? '').trim();
    const name = String(req.body?.name ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (name.length < 2 || name.length > 100 || req.body?.agree !== true) {
      throw fail(400, 'Ism va foydalanish shartlariga rozilikni tekshiring.');
    }
    const strength = passwordStrength(password);
    if (!strength.ok) throw fail(400, 'Parol kamida 10 belgili va ishonchli bo‘lsin.');

    const db = await pool.connect();
    let user;
    let committed = false;
    try {
      await db.query('BEGIN');
      await verifyOtpInTx(db, { phone, purpose: 'register', code });
      const result = await db.query(
        `INSERT INTO users(full_name, email, phone, verified_phone, password_hash)
         VALUES($1, $2, $3, $3, $4)
         RETURNING id, full_name, email, phone, verified_phone, role, seller_status, avatar_url, cover_url, bio, personalization_enabled, totp_enabled`,
        [name, `phone-${phone}@marketuz.invalid`, '+' + phone, await hashPassword(password)]
      );
      user = result.rows[0];
      await db.query('COMMIT');
      committed = true;
    } catch (e) {
      if (!committed) await db.query('ROLLBACK').catch(() => {});
      if (e.code === '23505') throw fail(409, 'Bu telefon raqami bilan hisob allaqachon mavjud. Parol bilan kiring.');
      throw e;
    } finally {
      db.release();
    }
    await createSession(req, res, user.id);
    await logSecurityEvent(pool, { userId: user.id, eventType: 'phone_registered', req, details: { phone: '+' + phone } });
    res.status(201).json({ user });
  }));

  app.post('/api/auth/phone/login', requireDb, rateAuth, route(async (req, res) => {
    const phone = phoneOf(req.body?.phone);
    const password = String(req.body?.password ?? '');
    const ip = req.ip || 'unknown';
    await checkAuthLockout(pool, { kind: 'phone_login', identifier: '+' + phone, ip });
    if (!password || password.length > 128) throw fail(401, 'Telefon yoki parol noto‘g‘ri.');

    const { rows: [user] } = await pool.query(
      `SELECT id, full_name, email, phone, verified_phone, role, seller_status, avatar_url, cover_url, bio, personalization_enabled, totp_enabled, password_hash
       FROM users WHERE verified_phone=$1 AND role!='admin' AND deleted_at IS NULL`,
      ['+' + phone]
    );
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await recordAuthAttempt(pool, { kind: 'phone_login', identifier: '+' + phone, ip, success: false });
      throw fail(401, 'Telefon yoki parol noto‘g‘ri.');
    }
    await recordAuthAttempt(pool, { kind: 'phone_login', identifier: '+' + phone, ip, success: true, userId: user.id, req });
    await pool.query('UPDATE users SET last_login_at=now(), last_login_ip=$1 WHERE id=$2', [ip.slice(0, 64), user.id]).catch(() => {});
    delete user.password_hash;
    await createSession(req, res, user.id);
    res.json({ user });
  }));

  app.post('/api/auth/phone/reset-password', requireDb, rateAuth, route(async (req, res) => {
    ready();
    const phone = phoneOf(req.body?.phone);
    const code = String(req.body?.code ?? '').trim();
    const newPassword = String(req.body?.newPassword ?? '');
    const strength = passwordStrength(newPassword);
    if (!strength.ok) throw fail(400, 'Yangi parol kamida 10 belgili va ishonchli bo‘lsin.');

    const db = await pool.connect();
    let userId = null;
    let committed = false;
    try {
      await db.query('BEGIN');
      await verifyOtpInTx(db, { phone, purpose: 'reset', code });
      const found = await db.query(
        "SELECT id FROM users WHERE verified_phone=$1 AND role!='admin' AND deleted_at IS NULL FOR UPDATE",
        ['+' + phone]
      );
      if (!found.rowCount) throw fail(400, 'SMS kod muddati tugagan yoki topilmadi.');
      userId = found.rows[0].id;
      await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(newPassword), userId]);
      await db.query('COMMIT');
      committed = true;
    } catch (e) {
      if (!committed) await db.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      db.release();
    }
    await revokeUserSessions(userId);
    await logSecurityEvent(pool, { userId, eventType: 'password_reset_sms', severity: 'warning', req, details: { phone: '+' + phone } });
    res.json({ ok: true, message: 'Parol muvaffaqiyatli yangilandi. Barcha qurilmalardagi eski sessiyalar yopildi.' });
  }));

  app.post('/api/me/phone/send', requireDb, auth, rateAuth, route(async (req, res) => {
    ready();
    if (req.user.role === 'admin') throw fail(403, 'Administrator hisobiga telefon orqali kirish bog‘lanmaydi.');
    const phone = phoneOf(req.body?.phone);
    const purpose = req.body?.purpose === 'change_phone' ? 'change_phone' : 'bind';
    if (purpose === 'bind' && req.user.verified_phone) {
      throw fail(409, 'Hisobingizga tasdiqlangan raqam bog‘langan. Raqamni almashtirish bo‘limidan foydalaning.');
    }
    if (purpose === 'change_phone') {
      if (!req.user.verified_phone) throw fail(400, 'Avval telefon raqamingizni tasdiqlang.');
      if (req.user.verified_phone === '+' + phone) throw fail(400, 'Yangi telefon raqami joriy raqamdan farq qilishi kerak.');
      const currentPassword = String(req.body?.currentPassword ?? '');
      const { rows } = await pool.query('SELECT password_hash, telegram_id FROM users WHERE id=$1', [req.user.id]);
      if (!rows[0] || (!rows[0].telegram_id && !(await verifyPassword(currentPassword, rows[0].password_hash)))) {
        throw fail(400, 'Joriy parol noto‘g‘ri.');
      }
      if (rows[0].telegram_id && currentPassword && !(await verifyPassword(currentPassword, rows[0].password_hash))) {
        throw fail(400, 'Joriy parol noto‘g‘ri.');
      }
    }
    const taken = await pool.query('SELECT id FROM users WHERE verified_phone=$1 AND id<>$2', ['+' + phone, req.user.id]);
    if (taken.rowCount) throw fail(409, 'Bu telefon raqami boshqa hisobga biriktirilgan.');

    const result = await issueOtp({ phone, purpose, ip: req.ip || 'unknown' });
    res.json({
      ...result,
      message: result.channel === 'telegram' ? 'Tasdiqlash kodi Telegram botingizga yuborildi.' : 'Tasdiqlash kodi yangi raqamga yuborildi.'
    });
  }));

  app.post('/api/me/phone/verify', requireDb, auth, rateAuth, route(async (req, res) => {
    ready();
    if (req.user.role === 'admin') throw fail(403, 'Administrator hisobiga telefon orqali kirish bog‘lanmaydi.');
    const phone = phoneOf(req.body?.phone);
    const code = String(req.body?.code ?? '').trim();
    const purpose = req.body?.purpose === 'change_phone' ? 'change_phone' : 'bind';
    if (purpose === 'bind' && req.user.verified_phone) throw fail(409, 'Tasdiqlangan raqam allaqachon mavjud.');
    if (purpose === 'change_phone' && !req.user.verified_phone) throw fail(400, 'Avval telefon raqamingizni tasdiqlang.');

    const db = await pool.connect();
    let updatedUser;
    let committed = false;
    try {
      await db.query('BEGIN');
      await verifyOtpInTx(db, { phone, purpose, code });
      const taken = await db.query('SELECT id FROM users WHERE verified_phone=$1 AND id<>$2', ['+' + phone, req.user.id]);
      if (taken.rowCount) throw fail(409, 'Bu telefon raqami boshqa hisobga biriktirilgan.');
      const resUser = await db.query(
        `UPDATE users
         SET verified_phone=$1,
             phone=CASE WHEN phone IS NULL OR phone='' OR phone=verified_phone THEN $1 ELSE phone END
         WHERE id=$2
         RETURNING id, full_name, email, phone, verified_phone, role, seller_status, avatar_url, cover_url, bio, personalization_enabled, totp_enabled`,
        ['+' + phone, req.user.id]
      );
      updatedUser = resUser.rows[0];
      await db.query('COMMIT');
      committed = true;
    } catch (e) {
      if (!committed) await db.query('ROLLBACK').catch(() => {});
      if (e.code === '23505') throw fail(409, 'Bu telefon raqami boshqa hisobga biriktirilgan.');
      throw e;
    } finally {
      db.release();
    }
    if (purpose === 'change_phone') {
      await revokeUserSessions(req.user.id, req.sessionId);
    }
    await logSecurityEvent(pool, {
      userId: req.user.id,
      eventType: purpose === 'change_phone' ? 'phone_changed' : 'phone_bound',
      severity: purpose === 'change_phone' ? 'warning' : 'info',
      req,
      details: { phone: '+' + phone }
    });
    res.json({ user: updatedUser });
  }));
}
