export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  let client;
  try {
    const { idToken, phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cleanPhone = phoneNumber.replace(/\s+/g, '');

    client = await pool.connect();

    // Check if user exists with this phone
    let userRes = await client.query('SELECT * FROM users WHERE phone = $1', [cleanPhone]);
    let user = userRes.rows[0];

    if (!user) {
      // Auto-register phone user
      const userId = crypto.randomUUID();
      const defaultName = `User ${cleanPhone.slice(-4)}`;
      const dummyPasswordHash = crypto.randomBytes(32).toString('hex');

      const insertRes = await client.query(
        `INSERT INTO users (id, name, email, password_hash, phone, two_factor_enabled, two_factor_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, phone, two_factor_enabled, two_factor_method`,
        [userId, defaultName, `${cleanPhone}@fundflow.local`, dummyPasswordHash, cleanPhone, false, 'mobile']
      );
      user = insertRes.rows[0];
    }

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await client.query(
      `INSERT INTO user_sessions (id, user_id, session_token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), user.id, sessionToken, expiresAt]
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
    });

    response.cookies.set('fundflow_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return response;
  } catch (err: any) {
    console.error('Firebase Phone Auth Error:', err);
    return NextResponse.json(
      { error: err.message || 'Invalid or expired phone verification' },
      { status: 401 }
    );
  } finally {
    if (client) client.release();
  }
}
