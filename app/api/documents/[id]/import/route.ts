export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
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

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();

    // Check document ownership & get filename
    let docFilename = 'Imported Statement';
    const docRes = await client.query('SELECT filename FROM documents WHERE id = $1 AND user_id = $2', [docId, userId]);
    if (docRes.rows.length > 0) {
      docFilename = docRes.rows[0].filename;
    }

    let insertedCount = 0;
    let duplicateCount = 0;

    for (const t of transactions) {
      const id = crypto.randomUUID();
      const cleanMerchant = t.merchant.trim();
      const amount = Math.round(Number(t.amount) * 100) / 100;
      const type = t.type === 'income' ? 'income' : 'expense';
      const category = t.category || 'General';
      const source = t.source || `Import: ${docFilename}`;
      const date = t.date;

      const fingerprint = crypto
        .createHash('sha256')
        .update(`${date}_${amount}_${type}_${cleanMerchant.toLowerCase()}`)
        .digest('hex');

      // Check for exact duplicate fingerprint or matching transaction row for this user
      const dupCheck = await client.query(
        `SELECT 1 FROM transactions 
         WHERE user_id = $1 
           AND (fingerprint = $2 
             OR (date = $3 AND amount = $4 AND type = $5 AND LOWER(merchant) = LOWER($6))) 
         LIMIT 1`,
        [userId, fingerprint, date, amount, type, cleanMerchant]
      );

      if (dupCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO transactions (id, user_id, amount, merchant, source, category, date, type, fingerprint, filename)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, userId, amount, cleanMerchant, source, category, date, type, fingerprint, docFilename]
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
