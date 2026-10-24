import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

async function ensureTableExists(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY,
      user_id UUID,
      name VARCHAR(255) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
      category VARCHAR(100) NOT NULL DEFAULT 'General',
      next_billing_date DATE NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'user_id'
      ) THEN 
        ALTER TABLE subscriptions ADD COLUMN user_id UUID; 
      END IF; 
    END $$;
  `);
}

// 1. GET: Fetch all recurring subscriptions
export async function GET(request: Request) {
  let client;
  try {
    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY next_billing_date ASC',
      [userId]
    );
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Subscriptions GET Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch subscriptions' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Add a new subscription
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { name, amount, billing_cycle, category, next_billing_date, status } = body;

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    const id = crypto.randomUUID();

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `INSERT INTO subscriptions (id, user_id, name, amount, billing_cycle, category, next_billing_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, userId, name, amount, billing_cycle || 'monthly', category || 'General', next_billing_date, status || 'active']
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Subscriptions POST Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create subscription' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH: Update an existing subscription
export async function PATCH(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { id, name, amount, billing_cycle, category, next_billing_date, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `UPDATE subscriptions 
       SET 
         name = COALESCE($1, name),
         amount = COALESCE($2, amount),
         billing_cycle = COALESCE($3, billing_cycle),
         category = COALESCE($4, category),
         next_billing_date = COALESCE($5, next_billing_date),
         status = COALESCE($6, status)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [
        name !== undefined ? name.trim() : null,
        amount !== undefined ? parseFloat(amount) : null,
        billing_cycle !== undefined ? billing_cycle : null,
        category !== undefined ? category.trim() : null,
        next_billing_date !== undefined ? next_billing_date : null,
        status !== undefined ? status : null,
        id,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Subscriptions PATCH Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update subscription' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove a subscription
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await client.query('DELETE FROM subscriptions WHERE id = $1 AND user_id = $2', [id, userId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Subscriptions DELETE Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete subscription' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
