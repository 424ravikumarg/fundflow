import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pool } from '@/lib/db';
import { ensureAuthTables, generate2FAOTP, maskContact } from '@/lib/auth';

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { userId, purpose = 'login_2fa', method: requestedMethod } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureAuthTables(client);

    const userRes = await client.query(
      `SELECT id, name, email, phone, two_factor_enabled, two_factor_method
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    const user = userRes.rows[0];
    const method = (requestedMethod || user.two_factor_method || 'email') as 'email' | 'mobile';

    if (method === 'mobile' && !user.phone) {
      return NextResponse.json(
        { error: 'No mobile number associated with this account. Please use email or update phone in settings.' },
        { status: 400 }
      );
    }

    const destination = method === 'mobile' ? user.phone : user.email;
    const otpCode = generate2FAOTP();
    const otpId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate previous pending OTPs
    await client.query(
      `UPDATE two_factor_otps SET verified = true WHERE user_id = $1 AND purpose = $2`,
      [user.id, purpose]
    );

    await client.query(
      `INSERT INTO two_factor_otps (id, user_id, otp_code, destination, method, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [otpId, user.id, otpCode, destination, method, purpose, expiresAt]
    );

    console.log(`[Fundflow 2FA Security] Dispatched new OTP for ${user.email} (${method} -> ${destination}): ${otpCode}`);

    return NextResponse.json({
      success: true,
      method,
      maskedDestination: maskContact(destination, method),
      message: `A new 6-digit code was sent to ${maskContact(destination, method)}.`,
      debugOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
    });
  } catch (err: any) {
    console.error('Request OTP Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch OTP' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
