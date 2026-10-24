export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  detectRecurringSubscriptions,
  RawTransaction,
} from '@/lib/recurring-detector';

export async function GET(request: Request) {
  let client;
  try {
    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();

    // 1. Fetch all expense transactions for authenticated user
    const txResult = await client.query(`
      SELECT 
        id::text, 
        amount, 
        merchant, 
        category, 
        date::text, 
        type 
      FROM transactions 
      WHERE type = 'expense' AND user_id = $1
      ORDER BY date ASC
    `, [userId]);

    // 2. Fetch existing active subscription names for deduplication
    const subResult = await client.query(`
      SELECT name FROM subscriptions WHERE status != 'cancelled' AND user_id = $1
    `, [userId]);
    const existingNames: string[] = subResult.rows.map((row: any) => row.name);

    const transactions: RawTransaction[] = txResult.rows.map((row: any) => ({
      id: row.id,
      amount: parseFloat(row.amount) || 0,
      merchant: row.merchant || '',
      category: row.category || 'General',
      date: row.date,
      type: 'expense',
    }));

    // 3. Execute intelligent recurring detection
    const detected = detectRecurringSubscriptions(transactions, existingNames);

    return NextResponse.json({
      success: true,
      count: detected.length,
      detected,
    });
  } catch (error: any) {
    console.error('Recurring Detection API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to detect recurring patterns' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
