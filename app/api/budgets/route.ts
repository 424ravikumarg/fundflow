import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

async function ensureTableExists(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id UUID PRIMARY KEY,
      user_id UUID,
      category VARCHAR(100) NOT NULL,
      monthly_limit NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'budgets' AND column_name = 'user_id'
      ) THEN 
        ALTER TABLE budgets ADD COLUMN user_id UUID; 
      END IF; 

      ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_key;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'budgets_user_category_key'
      ) THEN
        ALTER TABLE budgets ADD CONSTRAINT budgets_user_category_key UNIQUE (user_id, category);
      END IF;
    END $$;
  `);
}

// 1. GET: Fetch budgets aggregated with actual CURRENT MONTH transaction spending
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month'); // e.g. "2026-08"

  let client;
  try {
    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(`
      SELECT 
        b.id,
        b.category,
        b.monthly_limit,
        COALESCE(
          SUM(
            CASE 
              WHEN t.type = 'expense' 
                   AND (
                     CASE 
                       WHEN $1::text IS NOT NULL THEN TO_CHAR(t.date::date, 'YYYY-MM') = $1::text
                       ELSE DATE_TRUNC('month', t.date::date) = DATE_TRUNC('month', CURRENT_DATE)
                     END
                   )
              THEN t.amount 
              ELSE 0 
            END
          ), 0
        ) AS spent
      FROM budgets b
      LEFT JOIN transactions t ON LOWER(b.category) = LOWER(t.category) AND t.user_id = $2
      WHERE b.user_id = $2
      GROUP BY b.id, b.category, b.monthly_limit
      ORDER BY b.category ASC;
    `, [monthParam || null, userId]);

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Budgets GET Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch budgets' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Create or update a budget limit
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { category, monthly_limit } = body;

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    const id = crypto.randomUUID();

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `INSERT INTO budgets (id, user_id, category, monthly_limit)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category) 
       DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit
       RETURNING *`,
      [id, userId, category.trim(), parseFloat(monthly_limit)]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Budgets POST Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to save budget' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH: Update existing budget by ID
export async function PATCH(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { id, category, monthly_limit } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing budget ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `UPDATE budgets 
       SET 
         category = COALESCE($1, category),
         monthly_limit = COALESCE($2, monthly_limit)
       WHERE id::text = $3::text AND user_id = $4
       RETURNING *`,
      [
        category !== undefined ? category.trim() : null,
        monthly_limit !== undefined ? parseFloat(monthly_limit) : null,
        id,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Budgets PATCH Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update budget' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove a budget
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing budget ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await client.query('DELETE FROM budgets WHERE id::text = $1::text AND user_id = $2', [id, userId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Budgets DELETE Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete budget' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
