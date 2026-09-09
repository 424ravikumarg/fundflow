import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST() {
  let client;
  try {
    client = await pool.connect();
    
    // Fetch all active rules
    const rulesRes = await client.query('SELECT keyword, category FROM rules');
    const rules = rulesRes.rows;

    let updatedCount = 0;
    for (const rule of rules) {
      const res = await client.query(
        `UPDATE transactions 
         SET category = $1 
         WHERE LOWER(merchant) LIKE '%' || $2 || '%'`,
        [rule.category, rule.keyword.toLowerCase()]
      );
      updatedCount += res.rowCount || 0;
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error('Apply Rules Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to apply rules' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
