import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import {
  ensureAuthTables,
  getSessionUser,
  verifyPassword,
  hashPassword,
  validateComplexPassword,
} from '@/lib/auth';

// 1. GET: Fetch current user profile
export async function GET(request: Request) {
  let client;
  try {
    const user = await getSessionUser(request);
    if (!user) {
      // Check if there are ANY users in the database
      client = await pool.connect();
      await ensureAuthTables(client);
      const totalUsers = await client.query('SELECT COUNT(*) FROM users');
      const hasAnyUser = parseInt(totalUsers.rows[0].count, 10) > 0;

      return NextResponse.json({
        user: null,
        hasExistingAccounts: hasAnyUser,
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        twoFactorEnabled: user.two_factor_enabled,
        twoFactorMethod: user.two_factor_method,
      },
    });
  } catch (err: any) {
    console.error('Auth /me GET Error:', err);
    return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. PATCH: Account Maintenance (profile update, complex password change, 2FA toggle)
export async function PATCH(request: Request) {
  let client;
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      twoFactorEnabled,
      twoFactorMethod,
      currentPassword,
      newPassword,
    } = body;

    client = await pool.connect();
    await ensureAuthTables(client);

    // Profile updates
    let updatedName = user.name;
    let updatedEmail = user.email;
    let updatedPhone = user.phone;
    let updated2FAEnabled = user.two_factor_enabled;
    let updated2FAMethod = user.two_factor_method;

    if (name && name.trim()) {
      updatedName = name.trim();
    }

    if (phone !== undefined) {
      updatedPhone = phone ? phone.trim() : null;
    }

    if (twoFactorMethod && (twoFactorMethod === 'email' || twoFactorMethod === 'mobile')) {
      updated2FAMethod = twoFactorMethod;
    }

    if (twoFactorEnabled !== undefined) {
      // If enabling 2FA for mobile, ensure phone number is provided
      if (twoFactorEnabled && updated2FAMethod === 'mobile' && !updatedPhone) {
        return NextResponse.json(
          { error: 'A valid mobile number is required to enable SMS-based Two-Factor Authentication.' },
          { status: 400 }
        );
      }
      updated2FAEnabled = Boolean(twoFactorEnabled);
    }

    // Email update (verify uniqueness)
    if (email && email.trim().toLowerCase() !== user.email) {
      const cleanEmail = email.trim().toLowerCase();
      const existing = await client.query('SELECT id FROM users WHERE email = $1 AND id != $2', [
        cleanEmail,
        user.id,
      ]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'This email is already in use by another account.' }, { status: 409 });
      }
      updatedEmail = cleanEmail;
    }

    // Password change with standard complexity enforcement
    let updatedHash = null;
    let updatedSalt = null;

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password.' },
          { status: 400 }
        );
      }

      // Verify current password
      const fullUserRes = await client.query('SELECT password_hash, salt FROM users WHERE id = $1', [user.id]);
      const currentStored = fullUserRes.rows[0];
      const isMatch = verifyPassword(currentPassword, currentStored.password_hash, currentStored.salt);

      if (!isMatch) {
        return NextResponse.json({ error: 'Current password does not match.' }, { status: 403 });
      }

      // Enforce strict complex password validation
      const validation = validateComplexPassword(newPassword);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: 'New password does not meet complex standard rules.',
            details: validation.errors,
          },
          { status: 400 }
        );
      }

      const hashed = hashPassword(newPassword);
      updatedHash = hashed.hash;
      updatedSalt = hashed.salt;
    }

    // Execute PostgreSQL update
    if (updatedHash && updatedSalt) {
      await client.query(
        `UPDATE users
         SET name = $1, email = $2, phone = $3, two_factor_enabled = $4, two_factor_method = $5,
             password_hash = $6, salt = $7, updated_at = NOW()
         WHERE id = $8`,
        [
          updatedName,
          updatedEmail,
          updatedPhone,
          updated2FAEnabled,
          updated2FAMethod,
          updatedHash,
          updatedSalt,
          user.id,
        ]
      );
    } else {
      await client.query(
        `UPDATE users
         SET name = $1, email = $2, phone = $3, two_factor_enabled = $4, two_factor_method = $5, updated_at = NOW()
         WHERE id = $6`,
        [
          updatedName,
          updatedEmail,
          updatedPhone,
          updated2FAEnabled,
          updated2FAMethod,
          user.id,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account details and security preferences updated successfully.',
      user: {
        id: user.id,
        name: updatedName,
        email: updatedEmail,
        phone: updatedPhone,
        twoFactorEnabled: updated2FAEnabled,
        twoFactorMethod: updated2FAMethod,
      },
    });
  } catch (err: any) {
    console.error('Auth /me PATCH Error:', err);
    return NextResponse.json(
      { error: err.message || 'Account update failed.' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 3. DELETE: Logout (Invalidate active session)
export async function DELETE(request: Request) {
  let client;
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/fundflow_session=([^;]+)/);
    const token = match ? match[1].trim() : null;

    if (token) {
      client = await pool.connect();
      await client.query('DELETE FROM sessions WHERE token = $1', [token]);
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    response.cookies.set('fundflow_session', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    console.error('Logout error:', err);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
