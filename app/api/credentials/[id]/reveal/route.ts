import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import {
  ensureAuthTables,
  getSessionUser,
  decryptVaultPassword,
} from '@/lib/auth';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  let client;
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing credential ID' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureAuthTables(client);

    const res = await client.query(
      `SELECT encrypted_password, iv, auth_tag
       FROM credentials_vault
       WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Credential not found or unauthorized' },
        { status: 404 }
      );
    }

    const { encrypted_password, iv, auth_tag } = res.rows[0];

    // Decrypt on-demand using authenticated AES-256-GCM decipher
    const decryptedPassword = decryptVaultPassword(
      encrypted_password,
      iv,
      auth_tag,
      user.salt
    );

    return NextResponse.json({
      success: true,
      password: decryptedPassword,
    });
  } catch (err: any) {
    console.error('Reveal Password Error:', err);
    return NextResponse.json(
      { error: err.message || 'Decryption failed' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
