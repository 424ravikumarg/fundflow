import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  let client;
  try {
    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    
    // Fetch all active rules for authenticated user
    const rulesRes = await client.query('SELECT keyword, category FROM rules WHERE user_id = $1', [userId]);
    const rules = rulesRes.rows;

    let updatedCount = 0;
    for (const rule of rules) {
      const res = await client.query(
        `UPDATE transactions 
         SET category = $1 
         WHERE LOWER(merchant) LIKE '%' || $2 || '%' AND user_id = $3`,
        [rule.category, rule.keyword.toLowerCase(), userId]
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
