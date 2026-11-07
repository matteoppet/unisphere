import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_REQUESTS = 10;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_REQUESTS = 3;

const ipBuckets = new Map<string, number[]>();
const emailBuckets = new Map<string, number[]>();

function consumeRateLimit(
  store: Map<string, number[]>,
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const normalizedKey = String(key || 'anonymous').trim().toLowerCase();
  const existing = (store.get(normalizedKey) || []).filter((ts) => ts > cutoff);

  if (existing.length >= maxRequests) {
    store.set(normalizedKey, existing);
    const retryAfterMs = Math.max(1000, existing[0] + windowMs - now);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  existing.push(now);
  store.set(normalizedKey, existing);
  return { allowed: true, retryAfterSeconds: 0 };
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applySecurityHeaders(res: any) {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req: any, res: any) {
  applySecurityHeaders(res);

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const forwardedFor = req.headers?.['x-forwarded-for'];
    const clientIp =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || '')).split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown-ip';

    const ipLimit = consumeRateLimit(ipBuckets, clientIp, IP_WINDOW_MS, IP_MAX_REQUESTS);
    if (!ipLimit.allowed) {
      res.setHeader?.('Retry-After', String(ipLimit.retryAfterSeconds));
      return res.status(429).json({
        error: `Too many requests from this IP. Please try again in ${ipLimit.retryAfterSeconds}s.`,
      });
    }

    const { email, code } = req.body || {};

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const cleanCode = String(code || '').trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'A valid 6-digit verification code is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailLimit = consumeRateLimit(
      emailBuckets,
      normalizedEmail,
      EMAIL_WINDOW_MS,
      EMAIL_MAX_REQUESTS
    );
    if (!emailLimit.allowed) {
      res.setHeader?.('Retry-After', String(emailLimit.retryAfterSeconds));
      return res.status(429).json({
        error: `Too many verification emails requested for this address. Try again in ${emailLimit.retryAfterSeconds}s.`,
      });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'RESEND_API_KEY is not configured in environment.',
      });
    }

    const fromEmail = process.env.EMAIL_FROM || 'UniSphere <noreply@unispherelife.me>';
    const safeCode = escapeHtml(cleanCode);

    const data = await resend.emails.send({
      from: fromEmail,
      to: normalizedEmail,
      subject: 'Your UniSphere Verification Code',
      html: `<p>Your verification code is: <strong>${safeCode}</strong></p>`,
    });

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to send email' });
  }
}
