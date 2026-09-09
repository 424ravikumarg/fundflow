import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTransactionsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY,
      amount NUMERIC(12, 2) NOT NULL,
      merchant VARCHAR(255) NOT NULL,
      source VARCHAR(255) DEFAULT 'Manual Entry',
      category VARCHAR(100) DEFAULT 'General',
      date DATE NOT NULL,
      type VARCHAR(50) DEFAULT 'expense',
      fingerprint VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id UUID PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      file_hash VARCHAR(64),
      file_size INT DEFAULT 0,
      file_type VARCHAR(50) DEFAULT 'PDF',
      transaction_count INT DEFAULT 0,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'created_at'
      ) THEN 
        ALTER TABLE transactions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(); 
      END IF; 

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'filename'
      ) THEN 
        ALTER TABLE transactions ADD COLUMN filename VARCHAR(255); 
      END IF; 

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'file_id'
      ) THEN 
        ALTER TABLE transactions ADD COLUMN file_id UUID; 
      END IF; 
    END $$;

    -- One-time automatic clean up of duplicate transactions keeping the earliest entry
    DELETE FROM transactions a USING transactions b
    WHERE a.ctid < b.ctid
      AND a.date = b.date
      AND a.amount = b.amount
      AND a.type = b.type
      AND LOWER(a.merchant) = LOWER(b.merchant);

    -- Backfill filename for earlier imports that had null filename
    UPDATE transactions 
    SET filename = 'SBI Card Statement_3214_23-08-2026.PDF', source = 'SBI Card Statement_3214_23-08-2026.PDF'
    WHERE (filename IS NULL OR filename = '' OR filename = 'Import (Credit Card)')
      AND (source = 'Import (Credit Card)' OR source LIKE '%Credit Card%');

    UPDATE transactions 
    SET filename = '6132194_20260820_passwordless.pdf', source = '6132194_20260820_passwordless.pdf'
    WHERE (filename IS NULL OR filename = '' OR filename = 'Import (Bank)')
      AND (source = 'Import (Bank)' OR source LIKE '%Bank%');
  `);
}

// 1. GET: Fetch all transactions OR list imported files
export async function GET(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const getFiles = searchParams.get('files');

    client = await pool.connect();
    await ensureTransactionsTable(client);

    if (getFiles === 'true') {
      const filesRes = await client.query(`
        SELECT 
          COALESCE(NULLIF(t.filename, ''), t.source) as filename,
          COUNT(*)::int as count,
          to_char(MIN(t.date), 'YYYY-MM-DD') as start_date,
          to_char(MAX(t.date), 'YYYY-MM-DD') as end_date,
          to_char(MIN(t.created_at), 'YYYY-MM-DD HH24:MI') as imported_at
        FROM transactions t
        WHERE (t.filename IS NOT NULL AND t.filename != '') 
           OR (t.source LIKE 'Import%') 
           OR (t.source LIKE '%.pdf%') 
           OR (t.source LIKE '%.csv%')
           OR (t.source LIKE '%.xlsx%')
        GROUP BY COALESCE(NULLIF(t.filename, ''), t.source)
        ORDER BY MIN(t.created_at) DESC
      `);
      return NextResponse.json(filesRes.rows || []);
    }

    const result = await client.query(
      "SELECT id, amount, merchant, source, filename, category, to_char(date, 'YYYY-MM-DD') as date, type, fingerprint, created_at FROM transactions ORDER BY date DESC, created_at DESC LIMIT 2500"
    );
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    console.error('Database GET Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch transactions' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Add a new transaction manually
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { amount, merchant, category, date, type } = body;

    const id = crypto.randomUUID();
    const fingerprint = crypto.randomUUID();

    client = await pool.connect();
    await ensureTransactionsTable(client);

    const result = await client.query(
      `INSERT INTO transactions (id, amount, merchant, source, category, date, type, fingerprint, filename) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, parseFloat(amount), merchant.trim(), 'Manual Entry', category || 'General', date, type || 'expense', fingerprint, 'Manual Entry']
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Database POST Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to add transaction' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH / PUT: Update an existing transaction
export async function PATCH(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { id, amount, merchant, category, date, type } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureTransactionsTable(client);

    const result = await client.query(
      `UPDATE transactions 
       SET 
         amount = COALESCE($1, amount),
         merchant = COALESCE($2, merchant),
         category = COALESCE($3, category),
         date = COALESCE($4, date),
         type = COALESCE($5, type)
       WHERE id::text = $6::text 
       RETURNING *`,
      [
        amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount) : null,
        merchant !== undefined ? merchant.trim() : null,
        category !== undefined ? category.trim() : null,
        date !== undefined ? date : null,
        type !== undefined ? type : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Database PATCH Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update transaction' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove a transaction by ID, clean a specific file, deduplicate, or clear all
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('all');
    const clearImports = searchParams.get('imports');
    const dedupe = searchParams.get('dedupe');
    const fileToClean = searchParams.get('filename') || searchParams.get('file');

    client = await pool.connect();
    await ensureTransactionsTable(client);

    // One-click Deduplicate action
    if (dedupe === 'true') {
      const res = await client.query(`
        DELETE FROM transactions a USING transactions b
        WHERE a.ctid < b.ctid
          AND a.date = b.date
          AND a.amount = b.amount
          AND a.type = b.type
          AND LOWER(a.merchant) = LOWER(b.merchant)
      `);
      return NextResponse.json({
        success: true,
        message: `Removed ${res.rowCount || 0} duplicate transaction(s).`,
        count: res.rowCount,
      });
    }

    // Option to clean a particular file
    if (fileToClean) {
      const res = await client.query(
        `DELETE FROM transactions 
         WHERE filename = $1 
            OR source = $1 
            OR source = 'Import: ' || $1 
            OR source = 'Import (' || $1 || ')'
            OR file_id::text = $1`,
        [fileToClean]
      );
      await client.query(
        'DELETE FROM uploaded_files WHERE filename = $1 OR id::text = $1',
        [fileToClean]
      );
      return NextResponse.json({
        success: true,
        message: `Successfully cleaned ${res.rowCount} transaction(s) from "${fileToClean}"`,
        count: res.rowCount,
      });
    }

    if (clearAll === 'true') {
      await client.query('DELETE FROM transactions');
      await client.query('DELETE FROM uploaded_files');
      return NextResponse.json({ success: true, message: 'All transactions cleared' });
    }

    if (clearImports === 'true') {
      await client.query(`
        DELETE FROM transactions 
        WHERE source LIKE 'Import%' 
           OR (filename IS NOT NULL AND filename != '' AND filename != 'Manual Entry')
      `);
      await client.query('DELETE FROM uploaded_files');
      return NextResponse.json({ success: true, message: 'All imported transactions cleared' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing transaction ID or filename' }, { status: 400 });
    }

    await client.query('DELETE FROM transactions WHERE id::text = $1::text', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database DELETE Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete transaction' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
