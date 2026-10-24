import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

async function ensureTableExists(client: any) {
  await client.query(`
    DO $$ 
    BEGIN 
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rules' AND column_name = 'whentext'
      ) THEN 
        DROP TABLE rules CASCADE; 
      END IF; 
    END $$;

    CREATE TABLE IF NOT EXISTS rules (
      id UUID PRIMARY KEY,
      user_id UUID,
      keyword VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rules' AND column_name = 'user_id'
      ) THEN 
        ALTER TABLE rules ADD COLUMN user_id UUID; 
      END IF; 
    END $$;
  `);
}

// 1. GET: Fetch all categorization rules
export async function GET(request: Request) {
  let client;
  try {
    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query('SELECT * FROM rules WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    console.error('Rules GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch rules' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Create or update a rule
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { keyword, category } = body;

    if (!keyword || !category) {
      return NextResponse.json(
        { error: 'Keyword and category are required' },
        { status: 400 }
      );
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    const id = crypto.randomUUID();
    const cleanKeyword = keyword.trim().toLowerCase();
    const cleanCategory = category.trim();

    client = await pool.connect();
    await ensureTableExists(client);

    const existing = await client.query(
      'SELECT id FROM rules WHERE LOWER(keyword) = $1 AND user_id = $2',
      [cleanKeyword, userId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await client.query(
        'UPDATE rules SET category = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
        [cleanCategory, existing.rows[0].id, userId]
      );
    } else {
      result = await client.query(
        'INSERT INTO rules (id, user_id, keyword, category) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, userId, cleanKeyword, cleanCategory]
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Rules POST Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save rule' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH: Update a rule by ID
export async function PATCH(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { id, keyword, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `UPDATE rules 
       SET 
         keyword = COALESCE($1, keyword),
         category = COALESCE($2, category)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [
        keyword !== undefined ? keyword.trim().toLowerCase() : null,
        category !== undefined ? category.trim() : null,
        id,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Rules PATCH Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update rule' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove a rule
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await client.query('DELETE FROM rules WHERE id = $1 AND user_id = $2', [id, userId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Rules DELETE Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete rule' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
