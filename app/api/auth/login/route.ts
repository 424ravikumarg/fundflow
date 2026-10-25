import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pool } from '@/lib/db';
import {
  ensureAuthTables,
  verifyPassword,
  generate2FAOTP,
  maskContact,
} from '@/lib/auth';
import { send2FAEmail, isEmailConfigured } from '@/lib/email';

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { email, password, directOtp } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    client = await pool.connect();
    await ensureAuthTables(client);

    const userRes = await client.query(
      `SELECT id, name, email, phone, password_hash, salt, two_factor_enabled, two_factor_method
       FROM users
       WHERE email = $1`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'No account found with this email address. Please register.' },
        { status: 404 }
      );
    }

    const user = userRes.rows[0];

    // Mode A: Direct Email OTP Request (Passwordless or 1-click email OTP)
    if (directOtp) {
      const otpCode = generate2FAOTP();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await client.query(
        `UPDATE two_factor_otps SET verified = true WHERE user_id = $1 AND purpose = 'login_2fa'`,
        [user.id]
      );

      await client.query(
        `INSERT INTO two_factor_otps (id, user_id, otp_code, destination, method, purpose, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [otpId, user.id, otpCode, cleanEmail, 'email', 'login_2fa', expiresAt]
      );

      // Dispatch real email via Nodemailer/SMTP
      const dispatchResult = await send2FAEmail(cleanEmail, otpCode, user.name);
      const emailConfigured = isEmailConfigured();
      const shouldExposeOtp = !emailConfigured || !dispatchResult.delivered || process.env.NODE_ENV !== 'production';

      return NextResponse.json({
        requires2FA: true,
        userId: user.id,
        method: 'email',
        maskedDestination: maskContact(cleanEmail, 'email'),
        emailConfigured,
        message: emailConfigured
          ? (dispatchResult.delivered
              ? `A 6-digit login verification code was sent to ${maskContact(cleanEmail, 'email')}.`
              : `Email dispatch failed: ${dispatchResult.error || 'Server cannot deliver email'}. Use code below.`)
          : `Live email (SMTP) is not configured yet on server. Verification code: ${otpCode}`,
        debugOtp: shouldExposeOtp ? otpCode : undefined,
      });
    }

    // Mode B: Standard Password Verification
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required.' },
        { status: 400 }
      );
    }

    // Verify constant-time Scrypt password
    const isMatch = verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // Check if 2FA / MFA is active
    if (user.two_factor_enabled) {
      const otpCode = generate2FAOTP();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      const method = (user.two_factor_method || 'email') as 'email' | 'mobile';
      const destination = method === 'mobile' ? (user.phone || user.email) : user.email;

      // Invalidate previous pending OTPs
      await client.query(
        `UPDATE two_factor_otps SET verified = true WHERE user_id = $1 AND purpose = 'login_2fa'`,
        [user.id]
      );

      await client.query(
        `INSERT INTO two_factor_otps (id, user_id, otp_code, destination, method, purpose, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [otpId, user.id, otpCode, destination, method, 'login_2fa', expiresAt]
      );

      // Dispatch real email via Nodemailer/SMTP
      let dispatchResult: { success: boolean; delivered: boolean; error?: string } = { success: true, delivered: false };
      if (method === 'email' || !user.phone) {
        dispatchResult = await send2FAEmail(destination, otpCode, user.name);
      }

      const emailConfigured = isEmailConfigured();
      const shouldExposeOtp = !emailConfigured || !dispatchResult.delivered || process.env.NODE_ENV !== 'production';

      console.log(`[Fundflow 2FA Security] Generated OTP for user ${user.email} (${method} -> ${destination}): ${otpCode}`);

      return NextResponse.json({
        requires2FA: true,
        userId: user.id,
        method,
        maskedDestination: maskContact(destination, method),
        emailConfigured,
        message: emailConfigured
          ? (dispatchResult.delivered
              ? `A 6-digit verification code was sent to your ${method === 'mobile' ? 'mobile number' : 'email address'}.`
              : `Email dispatch failed: ${dispatchResult.error || 'Server cannot deliver email'}. Use code below.`)
          : `Live email (SMTP) is not configured yet on server. Verification code: ${otpCode}`,
        debugOtp: shouldExposeOtp ? otpCode : undefined,
      });
    }

    // Direct Login without 2FA
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await client.query(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, user.id, token, expiresAt]
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        twoFactorEnabled: user.two_factor_enabled,
        twoFactorMethod: user.two_factor_method,
      },
      token,
    });

    response.cookies.set('fundflow_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error('Login API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Login failed' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
