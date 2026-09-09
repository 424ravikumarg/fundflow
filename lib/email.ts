/**
 * Fundflow Email Dispatcher Service
 * Supports SMTP/HTTP Email APIs (Resend, SendGrid) and console fallback.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  // 1. Try Resend API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Fundflow Security <security@fundflow.app>',
          to,
          subject,
          html,
          text,
        }),
      });
      if (res.ok) {
        console.log(`[Fundflow Email] Sent email via Resend to ${to}`);
        return { success: true };
      }
    } catch (err: any) {
      console.warn('[Fundflow Email] Resend dispatch failed:', err.message);
    }
  }

  // 2. Try SendGrid API if configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.EMAIL_FROM || 'security@fundflow.app', name: 'Fundflow Security' },
          subject,
          content: [
            { type: 'text/html', value: html },
            { type: 'text/plain', value: text || subject },
          ],
        }),
      });
      if (res.ok) {
        console.log(`[Fundflow Email] Sent email via SendGrid to ${to}`);
        return { success: true };
      }
    } catch (err: any) {
      console.warn('[Fundflow Email] SendGrid dispatch failed:', err.message);
    }
  }

  // 3. Fallback: Log formatted 2FA email to server console
  console.log('====================================================');
  console.log(`📨 [Fundflow 2FA Email] Dispatching to: ${to}`);
  console.log(`📌 Subject: ${subject}`);
  if (text) console.log(`💬 Message: ${text}`);
  console.log('====================================================');

  return { success: true };
}

/**
 * Generates and sends a 2FA One-Time Password (OTP) verification email
 */
export async function send2FAEmail(toEmail: string, otpCode: string, userName?: string): Promise<{ success: boolean; error?: string }> {
  const subject = `Your Fundflow Verification Code: ${otpCode}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 20px; }
          .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #ECEEF1; padding: 32px; }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { display: inline-block; width: 40px; height: 40px; line-height: 40px; background: #6558D3; color: #ffffff; border-radius: 10px; font-size: 20px; font-weight: 800; text-align: center; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 12px 0 4px 0; }
          .code-box { background: #F4F3FC; border: 1.5px dashed #6558D3; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0; }
          .code { font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #6558D3; }
          .expiry { font-size: 11px; color: #7E79A8; margin-top: 4px; }
          .text { font-size: 13px; color: #374151; line-height: 1.5; margin: 10px 0; }
          .footer { border-top: 1px solid #F3F4F6; margin-top: 24px; padding-top: 16px; text-align: center; font-size: 11px; color: #9CA3AF; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">F</div>
            <h1 class="title">Two-Factor Verification</h1>
            <p style="font-size: 12px; color: #6B7280; margin: 0;">Hi ${userName || 'there'}, protect your account</p>
          </div>
          <p class="text">Your one-time 6-digit verification code is:</p>
          <div class="code-box">
            <div class="code">${otpCode}</div>
            <div class="expiry">Valid for 5 minutes</div>
          </div>
          <p class="text" style="font-size: 12px; color: #6B7280;">
            Never share this code with anyone. If you did not request this, please change your password.
          </p>
          <div class="footer">
            Fundflow — Smart Cash Flow & Financial Intelligence
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Your Fundflow verification code is: ${otpCode}. Valid for 5 minutes.`;

  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}
