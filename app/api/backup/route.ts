export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  let client;
  try {
    client = await pool.connect();

    const [
      txnsRes,
      subsRes,
      budgetsRes,
      loansRes,
      goalsRes,
      rulesRes,
      settingsRes,
      filesRes,
    ] = await Promise.all([
      client.query("SELECT * FROM transactions ORDER BY date DESC"),
      client.query("SELECT * FROM subscriptions ORDER BY next_billing_date ASC"),
      client.query("SELECT * FROM budgets ORDER BY category ASC"),
      client.query("SELECT * FROM loans ORDER BY created_at DESC"),
      client.query("SELECT * FROM goals ORDER BY created_at DESC"),
      client.query("SELECT * FROM rules ORDER BY created_at DESC"),
      client.query("SELECT * FROM app_settings"),
      client.query("SELECT * FROM uploaded_files ORDER BY created_at DESC"),
    ]);

    const backupData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      app: 'Fundflow',
      data: {
        transactions: txnsRes.rows || [],
        subscriptions: subsRes.rows || [],
        budgets: budgetsRes.rows || [],
        loans: loansRes.rows || [],
        goals: goalsRes.rows || [],
        rules: rulesRes.rows || [],
        settings: settingsRes.rows || [],
        uploaded_files: filesRes.rows || [],
      },
      counts: {
        transactions: txnsRes.rowCount || 0,
        subscriptions: subsRes.rowCount || 0,
        budgets: budgetsRes.rowCount || 0,
        loans: loansRes.rowCount || 0,
        goals: goalsRes.rowCount || 0,
        rules: rulesRes.rowCount || 0,
      },
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const filename = `fundflow-full-backup-${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Database Backup Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to export backup' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: Request) {
  let client;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No backup file provided' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || !parsed.data) {
      return NextResponse.json({ error: 'Invalid backup file structure' }, { status: 400 });
    }

    client = await pool.connect();
    let restoredCounts = {
      transactions: 0,
      subscriptions: 0,
      budgets: 0,
      loans: 0,
      goals: 0,
      rules: 0,
    };

    // Restore transactions
    if (Array.isArray(parsed.data.transactions)) {
      for (const t of parsed.data.transactions) {
        await client.query(
          `INSERT INTO transactions (id, amount, merchant, source, category, date, type, fingerprint, filename, file_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [t.id, t.amount, t.merchant, t.source, t.category, t.date, t.type, t.fingerprint, t.filename, t.file_id]
        );
        restoredCounts.transactions++;
      }
    }

    // Restore subscriptions
    if (Array.isArray(parsed.data.subscriptions)) {
      for (const s of parsed.data.subscriptions) {
        await client.query(
          `INSERT INTO subscriptions (id, name, amount, billing_cycle, category, next_billing_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [s.id, s.name, s.amount, s.billing_cycle, s.category, s.next_billing_date, s.status]
        );
        restoredCounts.subscriptions++;
      }
    }

    // Restore budgets
    if (Array.isArray(parsed.data.budgets)) {
      for (const b of parsed.data.budgets) {
        await client.query(
          `INSERT INTO budgets (id, category, monthly_limit)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [b.id, b.category, b.monthly_limit]
        );
        restoredCounts.budgets++;
      }
    }

    // Restore loans
    if (Array.isArray(parsed.data.loans)) {
      for (const l of parsed.data.loans) {
        await client.query(
          `INSERT INTO loans (id, name, type, lender, principal_amount, remaining_amount, interest_rate, monthly_emi, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [l.id, l.name, l.type, l.lender, l.principal_amount, l.remaining_amount, l.interest_rate, l.monthly_emi, l.start_date, l.end_date, l.status]
        );
        restoredCounts.loans++;
      }
    }

    // Restore goals
    if (Array.isArray(parsed.data.goals)) {
      for (const g of parsed.data.goals) {
        await client.query(
          `INSERT INTO goals (id, name, target_amount, current_amount, target_date, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [g.id, g.name, g.target_amount, g.current_amount, g.target_date, g.status]
        );
        restoredCounts.goals++;
      }
    }

    // Restore rules
    if (Array.isArray(parsed.data.rules)) {
      for (const r of parsed.data.rules) {
        await client.query(
          `INSERT INTO rules (id, keyword, category)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, r.keyword, r.category]
        );
        restoredCounts.rules++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Backup restored successfully',
      restoredCounts,
    });
  } catch (err: any) {
    console.error('Backup Restore Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to restore backup' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
