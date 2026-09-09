import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTableExists(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      target_amount NUMERIC(12, 2) NOT NULL,
      current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      target_date DATE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

// 1. GET: Fetch all goals
export async function GET() {
  let client;
  try {
    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query('SELECT * FROM goals ORDER BY target_date ASC');
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    console.error('Goals GET Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch goals' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Create a new goal
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { name, target_amount, current_amount, target_date } = body;

    const id = crypto.randomUUID();

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `INSERT INTO goals (id, name, target_amount, current_amount, target_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, name.trim(), parseFloat(target_amount), parseFloat(current_amount) || 0, target_date]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Goals POST Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create goal' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH: Update an existing goal
export async function PATCH(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { id, name, target_amount, current_amount, target_date } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing goal ID' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `UPDATE goals 
       SET 
         name = COALESCE($1, name),
         target_amount = COALESCE($2, target_amount),
         current_amount = COALESCE($3, current_amount),
         target_date = COALESCE($4, target_date)
       WHERE id = $5 
       RETURNING *`,
      [
        name !== undefined ? name.trim() : null,
        target_amount !== undefined ? parseFloat(target_amount) : null,
        current_amount !== undefined ? parseFloat(current_amount) : null,
        target_date !== undefined ? target_date : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Goals PATCH Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update goal' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove a goal
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing goal ID' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('DELETE FROM goals WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Goals DELETE Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete goal' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
