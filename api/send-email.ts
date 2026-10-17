import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract the target email and code sent from your React frontend
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const fromEmail = process.env.EMAIL_FROM || 'UniSphere <noreply@unispherelife.me>';

    const data = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Your UniSphere Verification Code',
      html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    });

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to send email' });
  }
}
