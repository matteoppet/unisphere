import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_REQUESTS = 10;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_REQUESTS = 3;

const ipBuckets = new Map<string, number[]>();
const emailBuckets = new Map<string, number[]>();

const BLOCKED_PATH_PATTERNS = [
  /^\/\.(env|git|vercel|aistudio|DS_Store)/i,
  /^\/(firestore\.rules|server\.ts|server\.js|package\.json|bun\.lock|tsconfig\.json|vercel\.json|vite\.config\.ts|components\.json|metadata\.json)/i,
  /^\/firebase-blueprint.*\.json$/i,
  /^\/api\/.*\.ts$/i,
];

function isBlockedPath(reqPath: string): boolean {
  const normalized = decodeURIComponent(String(reqPath || '')).replace(/\\/g, '/');
  if (normalized.includes('..')) return true;
  return BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function redactEmail(email: string): string {
  const clean = String(email || '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

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

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  let port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const p = parseInt(process.argv[portArgIndex + 1]);
    if (!isNaN(p)) port = p;
  }

  // Global Security Headers & Sensitive File Access Guard
  app.use((req, res, next) => {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.resend.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    if (isBlockedPath(req.path)) {
      return res.status(404).json({ error: 'Not found' });
    }

    next();
  });

  app.use(express.json({ limit: '32kb' }));

  // Email dispatch handler (strictly powered by Resend per Architectural Guardrail 2.4)
  const handleSendEmail = async (req: express.Request, res: express.Response) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || '')).split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown-ip';

    const ipLimit = consumeRateLimit(ipBuckets, clientIp, IP_WINDOW_MS, IP_MAX_REQUESTS);
    if (!ipLimit.allowed) {
      res.setHeader('Retry-After', String(ipLimit.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: `Too many requests from this IP. Please try again in ${ipLimit.retryAfterSeconds}s.`,
      });
    }

    const { email, code } = req.body || {};

    if (
      !email ||
      typeof email !== 'string' ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ success: false, error: 'A valid 6-digit verification code is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailLimit = consumeRateLimit(
      emailBuckets,
      normalizedEmail,
      EMAIL_WINDOW_MS,
      EMAIL_MAX_REQUESTS
    );
    if (!emailLimit.allowed) {
      res.setHeader('Retry-After', String(emailLimit.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: `Too many verification emails requested for this address. Try again in ${emailLimit.retryAfterSeconds}s.`,
      });
    }

    const cleanCode = code.trim();
    const htmlContent = generateEmailHtml(cleanCode, normalizedEmail);
    const textContent = `Your UniSphere verification code is: ${cleanCode}\nThis code will expire in 15 minutes.`;

    if (process.env.RESEND_API_KEY) {
      try {
        const fromEmail =
          process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('onboarding@resend.dev')
            ? process.env.EMAIL_FROM
            : 'UniSphere <noreply@unispherelife.me>';
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [normalizedEmail],
            subject: 'Your UniSphere Verification Code',
            html: htmlContent,
            text: textContent,
          }),
        });

        const data = (await resendResponse.json()) as any;

        if (resendResponse.ok) {
          console.log(`[Email Dispatch] Sent verification email via Resend to ${redactEmail(normalizedEmail)}`);
          return res.json({ success: true, provider: 'resend', id: data?.id || null });
        } else {
          console.warn('[Email Dispatch] Resend API returned non-200 status');
          return res.status(502).json({
            success: false,
            provider: 'resend',
            error: 'Email provider returned an error dispatching the verification message.',
          });
        }
      } catch {
        console.error('[Email Dispatch] Network failure communicating with Resend');
        return res.status(500).json({
          success: false,
          provider: 'resend',
          error: 'Network error communicating with email service.',
        });
      }
    }

    return res.json({
      success: false,
      configured: false,
      provider: 'none',
      message: 'Email service credentials are not configured in this environment.',
    });
  };

  app.post('/api/send-email', handleSendEmail);

  app.get('/api/email-status', (_req, res) => {
    const isConfigured = Boolean(process.env.RESEND_API_KEY);
    res.json({ configured: isConfigured, provider: isConfigured ? 'resend' : 'none' });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        dotfiles: 'deny',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`UniSphere server active on http://0.0.0.0:${port}`);
  });
}

startServer();
