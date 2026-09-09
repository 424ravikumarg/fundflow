import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pool } from '@/lib/db';
import {
  ensureAuthTables,
  getSessionUser,
  encryptVaultPassword,
} from '@/lib/auth';

// 1. GET: List all credentials in the Password Manager Vault
export async function GET(request: Request) {
  let client;
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    client = await pool.connect();
    await ensureAuthTables(client);

    // Never return raw ciphertext/iv in the general list for security
    const res = await client.query(
      `SELECT id, title, username, url, category, notes, created_at, updated_at
       FROM credentials_vault
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [user.id]
    );

    return NextResponse.json(res.rows || []);
  } catch (err: any) {
    console.error('Credentials GET error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch password vault items' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Encrypt and store a new password credential
export async function POST(request: Request) {
  let client;
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { title, username, password, url, category = 'General', notes } = body;

    if (!title || !username || !password) {
      return NextResponse.json(
        { error: 'Title, username, and password are required.' },
        { status: 400 }
      );
    }

    // Encrypt password using AES-256-GCM authenticated encryption
    const { ciphertext, iv, tag } = encryptVaultPassword(password, user.salt);
    const credentialId = crypto.randomUUID();

    client = await pool.connect();
    await ensureAuthTables(client);

    const result = await client.query(
      `INSERT INTO credentials_vault (id, user_id, title, username, url, category, encrypted_password, iv, auth_tag, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title, username, url, category, notes, created_at, updated_at`,
      [
        credentialId,
        user.id,
        title.trim(),
        username.trim(),
        url ? url.trim() : null,
        category ? category.trim() : 'General',
        ciphertext,
        iv,
        tag,
        notes ? notes.trim() : null,
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Credentials POST error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to save encrypted credential' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH: Update an existing credential
export async function PATCH(request: Request) {
  let client;
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, username, password, url, category, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing credential ID.' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureAuthTables(client);

    // Verify ownership
    const check = await client.query(
      'SELECT id FROM credentials_vault WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Credential not found or unauthorized.' }, { status: 404 });
    }

    if (password && password.trim()) {
      // Re-encrypt updated password with fresh IV
      const { ciphertext, iv, tag } = encryptVaultPassword(password, user.salt);
      const res = await client.query(
        `UPDATE credentials_vault
         SET title = COALESCE($1, title),
             username = COALESCE($2, username),
             url = COALESCE($3, url),
             category = COALESCE($4, category),
             encrypted_password = $5,
             iv = $6,
             auth_tag = $7,
             notes = COALESCE($8, notes),
             updated_at = NOW()
         WHERE id = $9 AND user_id = $10
         RETURNING id, title, username, url, category, notes, created_at, updated_at`,
        [
          title ? title.trim() : null,
          username ? username.trim() : null,
          url !== undefined ? (url ? url.trim() : null) : null,
          category ? category.trim() : null,
          ciphertext,
          iv,
          tag,
          notes !== undefined ? (notes ? notes.trim() : null) : null,
          id,
          user.id,
        ]
      );
      return NextResponse.json(res.rows[0]);
    } else {
      const res = await client.query(
        `UPDATE credentials_vault
         SET title = COALESCE($1, title),
             username = COALESCE($2, username),
             url = COALESCE($3, url),
             category = COALESCE($4, category),
             notes = COALESCE($5, notes),
             updated_at = NOW()
         WHERE id = $6 AND user_id = $7
         RETURNING id, title, username, url, category, notes, created_at, updated_at`,
        [
          title ? title.trim() : null,
          username ? username.trim() : null,
          url !== undefined ? (url ? url.trim() : null) : null,
          category ? category.trim() : null,
          notes !== undefined ? (notes ? notes.trim() : null) : null,
          id,
          user.id,
        ]
      );
      return NextResponse.json(res.rows[0]);
    }
  } catch (err: any) {
    console.error('Credentials PATCH error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update credential' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove credential from vault
export async function DELETE(request: Request) {
  let client;
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing credential ID.' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureAuthTables(client);

    await client.query(
      'DELETE FROM credentials_vault WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );

    return NextResponse.json({ success: true, message: 'Credential deleted successfully.' });
  } catch (err: any) {
    console.error('Credentials DELETE error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete credential' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
