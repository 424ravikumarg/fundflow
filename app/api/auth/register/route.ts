import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pool } from '@/lib/db';
import {
  ensureAuthTables,
  validateComplexPassword,
  hashPassword,
} from '@/lib/auth';

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { name, email, phone, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanPhone = phone ? String(phone).trim() : null;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Enforce strict complex password standards
    const validation = validateComplexPassword(password);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Password does not meet standard complexity requirements.',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await ensureAuthTables(client);

    // Check if email is already taken
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    // Generate Scrypt hash with unique salt
    const { hash, salt } = hashPassword(password);
    const userId = crypto.randomUUID();

    await client.query(
      `INSERT INTO users (id, name, email, phone, password_hash, salt, two_factor_enabled, two_factor_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, cleanName, cleanEmail, cleanPhone, hash, salt, false, 'email']
    );

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await client.query(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, userId, token, expiresAt]
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        twoFactorEnabled: false,
        twoFactorMethod: 'email',
      },
      token,
    });

    // Set secure HTTP-only cookie
    response.cookies.set('fundflow_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error('Register API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Registration failed' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
