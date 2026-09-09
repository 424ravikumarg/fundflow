import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pool } from '@/lib/db';
import { ensureAuthTables } from '@/lib/auth';

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { userId, otpCode, purpose = 'login_2fa' } = body;

    if (!userId || !otpCode) {
      return NextResponse.json(
        { error: 'User ID and verification code are required.' },
        { status: 400 }
      );
    }

    const cleanOtp = String(otpCode).trim();

    client = await pool.connect();
    await ensureAuthTables(client);

    // Look for valid matching OTP
    const otpRes = await client.query(
      `SELECT id, user_id, purpose, expires_at, verified
       FROM two_factor_otps
       WHERE user_id = $1 AND otp_code = $2 AND purpose = $3 AND verified = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, cleanOtp, purpose]
    );

    if (otpRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a new code.' },
        { status: 400 }
      );
    }

    const matchedOtp = otpRes.rows[0];

    // Mark OTP as used
    await client.query(
      `UPDATE two_factor_otps SET verified = true WHERE id = $1`,
      [matchedOtp.id]
    );

    // Fetch user details
    const userRes = await client.query(
      `SELECT id, name, email, phone, two_factor_enabled, two_factor_method
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    const user = userRes.rows[0];

    // If this was a 2FA setup verification, activate 2FA now
    if (purpose === 'setup_2fa') {
      await client.query(
        `UPDATE users SET two_factor_enabled = true, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      user.two_factor_enabled = true;
    }

    // Generate authenticated session token
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, user.id, token, expiresAt]
    );

    const response = NextResponse.json({
      success: true,
      message: purpose === 'setup_2fa' ? 'Two-Factor Authentication verified and enabled!' : 'Login verification successful.',
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
    console.error('Verify 2FA Error:', err);
    return NextResponse.json(
      { error: err.message || 'Verification failed' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
