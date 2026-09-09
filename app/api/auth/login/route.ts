import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pool } from '@/lib/db';
import {
  ensureAuthTables,
  verifyPassword,
  generate2FAOTP,
  maskContact,
} from '@/lib/auth';

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
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
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const user = userRes.rows[0];

    // Verify constant-time Scrypt password
    const isMatch = verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // Check if 2FA is active
    if (user.two_factor_enabled) {
      const otpCode = generate2FAOTP();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      const method = (user.two_factor_method || 'email') as 'email' | 'mobile';
      const destination = method === 'mobile' ? (user.phone || user.email) : user.email;

      // Invalidate any previous login OTPs for this user
      await client.query(
        `UPDATE two_factor_otps SET verified = true WHERE user_id = $1 AND purpose = 'login_2fa'`,
        [user.id]
      );

      // Insert fresh OTP
      await client.query(
        `INSERT INTO two_factor_otps (id, user_id, otp_code, destination, method, purpose, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [otpId, user.id, otpCode, destination, method, 'login_2fa', expiresAt]
      );

      // Simulated secure dispatch (Logged to server console for testing)
      console.log(`[Fundflow 2FA Security] Generated OTP for user ${user.email} (${method} -> ${destination}): ${otpCode}`);

      return NextResponse.json({
        requires2FA: true,
        userId: user.id,
        method,
        maskedDestination: maskContact(destination, method),
        message: `A 6-digit verification code was sent to your ${method === 'mobile' ? 'mobile number' : 'email address'}.`,
        // In development/demo, provide the debug code so user is never locked out
        debugOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
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
