import { Resend } from 'resend';

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

function generateEmailHtml(code: string, email: string): string {
  const safeCode = escapeHtml(code);
  const safeEmail = escapeHtml(email);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>UniSphere Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="background-color: #4338ca; padding: 24px 32px; text-align: left;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">UniSphere</h1>
        <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 13px;">Academic Degree & Curriculum Workstation</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 600;">Verification Code</h2>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #475569;">
          You requested a verification code for your account (<strong>${safeEmail}</strong>). Use the 6-digit confirmation code below to complete your authentication:
        </p>
        <div style="background-color: #eef2ff; border: 2px dashed #6366f1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #4338ca; display: inline-block;">
            ${safeCode}
          </span>
          <p style="margin: 8px 0 0 0; font-size: 11px; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
            Valid for 15 minutes
          </p>
        </div>
        <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
          If you did not initiate this request or have already registered, you can safely disregard this email. Never disclose this single-use code to anyone.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f1f5f9; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">
          UniSphere Campus Identity Protocol &bull; Single Sign-On Gateway
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function applySecurityHeaders(res: any) {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cache-Control', 'no-store');
}

function parseRequestBody(rawBody: any): Record<string, any> {
  if (!rawBody) return {};
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  }
  if (typeof rawBody === 'object') return rawBody;
  return {};
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

    const body = parseRequestBody(req.body);
    const { email, code } = body;

    if (
      !email ||
      typeof email !== 'string' ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
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

    const apiKey = String(process.env.RESEND_API_KEY || '')
      .replace(/^["']+|["']+$/g, '')
      .trim();

    if (!apiKey) {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Email service is not configured in this environment.',
      });
    }

    const resend = new Resend(apiKey);
    const envFrom = String(process.env.EMAIL_FROM || '')
      .replace(/^["']+|["']+$/g, '')
      .trim();
    const primaryFrom =
      envFrom && !envFrom.includes('onboarding@resend.dev')
        ? envFrom
        : 'UniSphere <noreply@unispherelife.me>';

    const candidateSenders = Array.from(
      new Set(
        [
          primaryFrom,
          'UniSphere <noreply@unispherelife.me>',
          envFrom,
          'UniSphere <onboarding@resend.dev>',
        ].filter(Boolean)
      )
    );

    const htmlContent = generateEmailHtml(cleanCode, normalizedEmail);
    const textContent = `Your UniSphere verification code is: ${cleanCode}\nThis code will expire in 15 minutes.`;

    let lastError: any = null;
    for (const sender of candidateSenders) {
      const result = await resend.emails.send({
        from: sender,
        to: normalizedEmail,
        subject: 'Your UniSphere Verification Code',
        html: htmlContent,
        text: textContent,
      });

      if (!(result as any)?.error) {
        return res.status(200).json({
          success: true,
          id: (result as any)?.data?.id || (result as any)?.id || null,
        });
      }
      lastError = (result as any)?.error;
    }

    return res.status(502).json({
      success: false,
      error:
        typeof lastError?.message === 'string'
          ? lastError.message
          : 'Email provider could not deliver the verification message.',
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch verification email.',
    });
  }
}
