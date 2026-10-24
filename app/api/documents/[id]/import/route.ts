export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import crypto from 'crypto';

interface ImportTxnPayload {
  date: string;
  merchant: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  source?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: docId } = await params;
  let client;

  try {
    const body = await request.json();
    const transactions: ImportTxnPayload[] = body.transactions;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions provided for import' },
        { status: 400 }
      );
    }

    client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY,
        amount NUMERIC(12, 2) NOT NULL,
        merchant VARCHAR(255) NOT NULL,
        source VARCHAR(255) DEFAULT 'Imported Statement',
        category VARCHAR(100) DEFAULT 'General',
        date DATE NOT NULL,
        type VARCHAR(50) NOT NULL,
        fingerprint VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    let insertedCount = 0;
    let duplicateCount = 0;

    for (const t of transactions) {
      const id = crypto.randomUUID();
      const cleanMerchant = t.merchant.trim();
      const amount = Math.round(Number(t.amount) * 100) / 100;
      const type = t.type === 'income' ? 'income' : 'expense';
      const category = t.category || 'General';
      const source = t.source || 'Vault Statement';
      const date = t.date;

      const fingerprint = crypto
        .createHash('sha256')
        .update(`${date}_${amount}_${type}_${cleanMerchant.toLowerCase()}`)
        .digest('hex');

      // Check for exact duplicate fingerprint or matching transaction row
      const dupCheck = await client.query(
        `SELECT 1 FROM transactions 
         WHERE fingerprint = $1 
            OR (date = $2 AND amount = $3 AND type = $4 AND LOWER(merchant) = LOWER($5)) 
         LIMIT 1`,
        [fingerprint, date, amount, type, cleanMerchant]
      );

      if (dupCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO transactions (id, amount, merchant, source, category, date, type, fingerprint)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, amount, cleanMerchant, source, category, date, type, fingerprint]
        );
        insertedCount++;
      } else {
        duplicateCount++;
      }
    }

    return NextResponse.json({
      success: true,
      documentId: docId,
      totalReceived: transactions.length,
      insertedCount,
      duplicateCount,
      message: `Successfully imported ${insertedCount} transaction(s) (${duplicateCount} duplicate(s) skipped).`,
    });
  } catch (error: any) {
    console.error('Document Import Transactions API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to import transactions' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
