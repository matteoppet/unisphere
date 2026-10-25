import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateEmailHtml(code: string, email: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>UniSphere Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color: #4338ca; padding: 24px 32px; text-align: left;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">UniSphere</h1>
        <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 13px;">Academic Degree & Curriculum Workstation</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 600;">Verification Code</h2>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #475569;">
          You requested a verification code for your account (<strong>${email}</strong>). Use the 6-digit confirmation code below to complete your authentication:
        </p>
        
        <!-- Code Display Box -->
        <div style="background-color: #eef2ff; border: 2px dashed #6366f1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #4338ca; display: inline-block;">
            ${code}
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
    <!-- Footer -->
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

  let port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const p = parseInt(process.argv[portArgIndex + 1]);
    if (!isNaN(p)) port = p;
  }

  app.use(express.json());

  // Email dispatch handler
  const handleSendEmail = async (req: express.Request, res: express.Response) => {
    const { email, code } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ success: false, error: 'A valid 6-digit verification code is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const htmlContent = generateEmailHtml(cleanCode, normalizedEmail);
    const textContent = `Your UniSphere verification code is: ${cleanCode}\nThis code will expire in 15 minutes.`;

    // 1. Try Resend API if RESEND_API_KEY is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const fromEmail =
          process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('onboarding@resend.dev')
            ? process.env.EMAIL_FROM
            : 'UniSphere <noreply@unispherelife.me>';
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [normalizedEmail],
            subject: `Your UniSphere Verification Code: ${cleanCode}`,
            html: htmlContent,
            text: textContent,
          }),
        });

        const data = await resendResponse.json() as any;

        if (resendResponse.ok) {
          console.log(`[Email Dispatch] Successfully sent code via Resend to ${normalizedEmail} (ID: ${data.id})`);
          return res.json({ success: true, provider: 'resend', id: data.id });
        } else {
          console.warn('[Email Dispatch] Resend API error:', data);
          return res.status(502).json({
            success: false,
            provider: 'resend',
            error: data.message || 'Resend API returned an error dispatching the email.',
          });
        }
      } catch (err: any) {
        console.error('[Email Dispatch] Resend request failure:', err);
        return res.status(500).json({
          success: false,
          provider: 'resend',
          error: err.message || 'Network error communicating with Resend.',
        });
      }
    }

    // 2. Try SMTP if SMTP_HOST or SMTP_USER is configured
    if (process.env.SMTP_HOST || process.env.SMTP_USER) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const sender = process.env.EMAIL_FROM || process.env.SMTP_USER;
        const info = await transporter.sendMail({
          from: sender,
          to: normalizedEmail,
          subject: `Your UniSphere Verification Code: ${cleanCode}`,
          html: htmlContent,
          text: textContent,
        });

        console.log(`[Email Dispatch] Successfully sent code via SMTP to ${normalizedEmail} (MessageId: ${info.messageId})`);
        return res.json({ success: true, provider: 'smtp', messageId: info.messageId });
      } catch (err: any) {
        console.error('[Email Dispatch] SMTP failure:', err);
        return res.status(502).json({
          success: false,
          provider: 'smtp',
          error: err.message || 'Failed to send verification email via SMTP server.',
        });
      }
    }

    // 3. Fallback when neither Resend nor SMTP is configured in environment
    console.warn(`[Email Dispatch] Code generated for ${normalizedEmail}, but no EMAIL credentials configured in environment.`);
    return res.json({
      success: false,
      configured: false,
      provider: 'none',
      message: 'No email service credentials configured. Please set RESEND_API_KEY or SMTP credentials in your .env file.',
    });
  };

  // Register /api/send-email (and aliases)
  app.post('/api/send-email', handleSendEmail);

  // Status check endpoint
  app.get('/api/email-status', (_req, res) => {
    const isConfigured = Boolean(
      process.env.RESEND_API_KEY ||
      (process.env.SMTP_USER && process.env.SMTP_PASS)
    );
    const provider = process.env.RESEND_API_KEY
      ? 'resend'
      : (process.env.SMTP_USER ? 'smtp' : 'none');

    res.json({ configured: isConfigured, provider });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(
      express.static(path.join(__dirname, 'dist'), {
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
