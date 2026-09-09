import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'transactions';

  let client;
  try {
    client = await pool.connect();
    let csvContent = '';
    const NL = String.fromCharCode(10);

    if (type === 'transactions') {
      const res = await client.query(
        "SELECT to_char(date, 'YYYY-MM-DD') as date, merchant, amount, type, category, source FROM transactions ORDER BY date DESC"
      );
      csvContent = 'Date,Merchant,Amount,Type,Category,Source' + NL;
      csvContent += res.rows
        .map((r) => {
          const dateStr = r.date || '';
          const merchantStr = (r.merchant || '').replace(/"/g, '""');
          const typeStr = (r.type || '').replace(/"/g, '""');
          const categoryStr = (r.category || '').replace(/"/g, '""');
          const sourceStr = (r.source || '').replace(/"/g, '""');
          return `"${dateStr}","${merchantStr}",${r.amount || 0},"${typeStr}","${categoryStr}","${sourceStr}"`;
        })
        .join(NL);
    } else if (type === 'subscriptions') {
      const res = await client.query(
        'SELECT name, amount, billing_cycle, category, to_char(next_billing_date, \'YYYY-MM-DD\') as next_billing_date, status FROM subscriptions ORDER BY next_billing_date ASC'
      );
      csvContent = 'Name,Amount,Billing Cycle,Category,Next Billing Date,Status' + NL;
      csvContent += res.rows
        .map((r) => {
          const nameStr = (r.name || '').replace(/"/g, '""');
          const catStr = (r.category || '').replace(/"/g, '""');
          const statusStr = (r.status || '').replace(/"/g, '""');
          return `"${nameStr}",${r.amount || 0},"${r.billing_cycle}","${catStr}","${r.next_billing_date}","${statusStr}"`;
        })
        .join(NL);
    } else if (type === 'budgets') {
      const res = await client.query('SELECT category, monthly_limit FROM budgets ORDER BY category ASC');
      csvContent = 'Category,Monthly Limit,Spent,Remaining' + NL;
      csvContent += res.rows
        .map((r) => {
          const catStr = (r.category || '').replace(/"/g, '""');
          return `"${catStr}",${r.monthly_limit || 0},0,${r.monthly_limit || 0}`;
        })
        .join(NL);
    } else {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fundflow-${type}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err: any) {
    console.error('Export Error:', err);
    return NextResponse.json({ error: 'Failed to generate CSV export' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
