import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0, value = 0, output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Noto‘g‘ri Base32 kalit.');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret, stepOffset = 0, nowMs = Date.now()) {
  const key = base32Decode(secret);
  const counter = Math.floor(nowMs / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret, code, nowMs = Date.now()) {
  const clean = String(code ?? '').trim();
  if (!secret || !/^\d{6}$/.test(clean)) return false;
  const actual = Buffer.from(clean, 'utf8');
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(totpCode(secret, offset, nowMs), 'utf8');
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return true;
  }
  return false;
}

export function otpauthUri({ issuer = 'Marketuz', account, secret }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function deviceLabelFromUa(ua) {
  const s = String(ua || '');
  if (!s) return 'Noma’lum qurilma';
  const os = /Android/i.test(s) ? 'Android'
    : /iPhone|iPad|iOS/i.test(s) ? 'iOS'
    : /Windows/i.test(s) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(s) ? 'macOS'
    : /Linux/i.test(s) ? 'Linux' : 'Qurilma';
  const browser = /Edg\//i.test(s) ? 'Edge'
    : /Chrome\//i.test(s) ? 'Chrome'
    : /Firefox\//i.test(s) ? 'Firefox'
    : /Safari\//i.test(s) ? 'Safari'
    : /Telegram/i.test(s) ? 'Telegram' : 'Brauzer';
  return `${os} · ${browser}`.slice(0, 80);
}

export function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function signPayload(payloadObj, secret) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
}

export function verifySignedPayload(token, secret) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!obj || typeof obj !== 'object' || !obj.exp || obj.exp <= Date.now()) return null;
    return obj;
  } catch {
    return null;
  }
}

export function passwordStrength(password) {
  const s = String(password || '');
  if (s.length < 10 || s.length > 128) return { ok: false, score: 0, label: 'Juda qisqa' };
  let score = 1;
  if (s.length >= 12) score++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  const common = ['1234567890', 'password123', 'qwerty12345', 'abcdefghij', '0000000000'];
  if (common.includes(s.toLowerCase()) || /^(.)\1+$/.test(s)) return { ok: false, score: 0, label: 'Juda oddiy parol' };
  const label = score >= 4 ? 'Kuchli' : score >= 3 ? 'Yaxshi' : 'O‘rtacha';
  return { ok: true, score, label };
}

export async function logSecurityEvent(dbOrPool, { userId = null, eventType, severity = 'info', req = null, details = {} }) {
  if (!dbOrPool) return;
  const ip = String(req?.ip || '').slice(0, 64);
  const ua = String(req?.get?.('user-agent') || '').slice(0, 240);
  try {
    await dbOrPool.query(
      'INSERT INTO security_events(user_id, event_type, severity, ip, user_agent, details) VALUES($1,$2,$3,$4,$5,$6)',
      [userId, String(eventType).slice(0, 48), severity, ip, ua, JSON.stringify(details || {})]
    );
  } catch (e) {
    console.error('Security event log failed:', e.message);
  }
}

export async function logAudit(dbOrPool, { actorId = null, action, targetType = '', targetId = '', req = null, details = {} }) {
  if (!dbOrPool) return;
  const ip = String(req?.ip || '').slice(0, 64);
  try {
    await dbOrPool.query(
      'INSERT INTO audit_logs(actor_id, action, target_type, target_id, ip, details) VALUES($1,$2,$3,$4,$5,$6)',
      [actorId, String(action).slice(0, 64), String(targetType).slice(0, 40), String(targetId).slice(0, 80), ip, JSON.stringify(details || {})]
    );
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

export async function checkAuthLockout(pool, { kind, identifier, ip }) {
  if (!pool) return;
  const { rows: [stats] } = await pool.query(
    `SELECT
      count(*) FILTER (WHERE kind=$1 AND identifier=$2 AND success=false)::int AS id_fails,
      count(*) FILTER (WHERE ip=$3 AND success=false)::int AS ip_fails
     FROM auth_attempts
     WHERE created_at > now() - interval '15 minutes' AND (identifier=$2 OR ip=$3)`,
    [kind, String(identifier).slice(0, 200), String(ip || '').slice(0, 64)]
  );
  if (stats.id_fails >= 10 || stats.ip_fails >= 30) {
    await logSecurityEvent(pool, {
      eventType: 'auth_lockout_triggered',
      severity: 'warning',
      req: { ip },
      details: { kind, identifier: String(identifier).slice(0, 64), idFails: stats.id_fails, ipFails: stats.ip_fails }
    });
    const err = new Error('Juda ko‘p muvaffaqiyatsiz urinish. 15 daqiqadan keyin qayta urinib ko‘ring.');
    err.status = 429;
    throw err;
  }
}

export async function recordAuthAttempt(pool, { kind, identifier, ip, success, userId = null, req = null }) {
  if (!pool) return;
  const safeId = String(identifier || '').slice(0, 200);
  const safeIp = String(ip || '').slice(0, 64);
  await pool.query(
    'INSERT INTO auth_attempts(kind, identifier, ip, success) VALUES($1,$2,$3,$4)',
    [kind, safeId, safeIp, !!success]
  ).catch(() => {});
  if (success && userId) {
    const { rows: [recent] } = await pool.query(
      "SELECT count(*)::int AS fails FROM auth_attempts WHERE kind=$1 AND identifier=$2 AND success=false AND created_at > now() - interval '30 minutes'",
      [kind, safeId]
    ).catch(() => ({ rows: [{ fails: 0 }] }));
    if (recent?.fails >= 3) {
      await logSecurityEvent(pool, {
        userId,
        eventType: 'login_after_multiple_failures',
        severity: 'warning',
        req,
        details: { kind, recentFails: recent.fails }
      });
    }
  }
}

export function createRateLimiter({ windowMs = 15 * 60_000, max = 30, keyFn = req => `${req.ip || 'ip'}:${req.user?.id || 'anon'}`, message = 'Juda ko‘p so‘rov yuborildi. Birozdan keyin urinib ko‘ring.' } = {}) {
  const hits = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
  }, Math.max(60_000, windowMs));
  cleanup.unref?.();
  return (req, res, next) => {
    const key = String(keyFn(req) || 'default').slice(0, 128);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.until <= now) {
      entry = { count: 0, until: now + windowMs };
      hits.set(key, entry);
    }
    if (++entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}
