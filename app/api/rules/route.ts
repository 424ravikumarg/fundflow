import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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
      keyword VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

// 1. GET: Fetch all categorization rules
export async function GET() {
  let client;
  try {
    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query('SELECT * FROM rules ORDER BY created_at DESC');
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

    const id = crypto.randomUUID();
    const cleanKeyword = keyword.trim().toLowerCase();
    const cleanCategory = category.trim();

    client = await pool.connect();
    await ensureTableExists(client);

    const existing = await client.query(
      'SELECT id FROM rules WHERE LOWER(keyword) = $1',
      [cleanKeyword]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await client.query(
        'UPDATE rules SET category = $1 WHERE id = $2 RETURNING *',
        [cleanCategory, existing.rows[0].id]
      );
    } else {
      result = await client.query(
        'INSERT INTO rules (id, keyword, category) VALUES ($1, $2, $3) RETURNING *',
        [id, cleanKeyword, cleanCategory]
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

    client = await pool.connect();
    await ensureTableExists(client);

    const result = await client.query(
      `UPDATE rules 
       SET 
         keyword = COALESCE($1, keyword),
         category = COALESCE($2, category)
       WHERE id = $3 
       RETURNING *`,
      [
        keyword !== undefined ? keyword.trim().toLowerCase() : null,
        category !== undefined ? category.trim() : null,
        id,
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

    client = await pool.connect();
    await client.query('DELETE FROM rules WHERE id = $1', [id]);

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
