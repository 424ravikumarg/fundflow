import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

async function ensureLoansTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS loans (
      id UUID PRIMARY KEY,
      user_id UUID,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'borrowed',
      lender VARCHAR(255) NOT NULL,
      principal_amount NUMERIC(12, 2) NOT NULL,
      remaining_amount NUMERIC(12, 2) NOT NULL,
      interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
      monthly_emi NUMERIC(12, 2) NOT NULL DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loans' AND column_name = 'user_id'
      ) THEN 
        ALTER TABLE loans ADD COLUMN user_id UUID; 
      END IF; 
    END $$;
  `);
}

// 1. GET: Fetch all loans
export async function GET(request: Request) {
  let client;
  try {
    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureLoansTable(client);

    const result = await client.query(
      'SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    console.error('Loans GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch loans' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Create a new loan entry
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const {
      name,
      type = 'borrowed',
      lender,
      principal_amount,
      remaining_amount,
      interest_rate = 0,
      monthly_emi = 0,
      start_date,
      end_date,
      status = 'active',
    } = body;

    if (!name || !principal_amount || !start_date) {
      return NextResponse.json(
        { error: 'Name, principal amount, and start date are required' },
        { status: 400 }
      );
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    const id = crypto.randomUUID();
    const remaining = remaining_amount !== undefined ? remaining_amount : principal_amount;

    client = await pool.connect();
    await ensureLoansTable(client);

    const result = await client.query(
      `INSERT INTO loans (
        id, user_id, name, type, lender, principal_amount, remaining_amount, 
        interest_rate, monthly_emi, start_date, end_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        id,
        userId,
        name.trim(),
        type,
        lender ? lender.trim() : 'Bank / Lender',
        parseFloat(principal_amount),
        parseFloat(remaining),
        parseFloat(interest_rate) || 0,
        parseFloat(monthly_emi) || 0,
        start_date,
        end_date || null,
        status,
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Loans POST Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create loan' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH: Update full loan details OR log a payment
export async function PATCH(request: Request) {
  let client;
  try {
    const body = await request.json();
    const {
      id,
      name,
      type,
      lender,
      principal_amount,
      remaining_amount,
      interest_rate,
      monthly_emi,
      start_date,
      end_date,
      status,
      payment_made,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing loan ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await ensureLoansTable(client);

    let updatedRow;

    if (payment_made !== undefined) {
      const currentRes = await client.query('SELECT remaining_amount FROM loans WHERE id::text = $1::text AND user_id = $2', [id, userId]);
      if (currentRes.rows.length === 0) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      const newRemaining = Math.max(0, parseFloat(currentRes.rows[0].remaining_amount) - parseFloat(payment_made));
      const newStatus = newRemaining === 0 ? 'paid_off' : 'active';

      const updateRes = await client.query(
        'UPDATE loans SET remaining_amount = $1, status = $2 WHERE id::text = $3::text AND user_id = $4 RETURNING *',
        [newRemaining, newStatus, id, userId]
      );
      updatedRow = updateRes.rows[0];
    } else {
      const updateRes = await client.query(
        `UPDATE loans 
         SET 
           name = COALESCE($1, name),
           type = COALESCE($2, type),
           lender = COALESCE($3, lender),
           principal_amount = COALESCE($4, principal_amount),
           remaining_amount = COALESCE($5, remaining_amount),
           interest_rate = COALESCE($6, interest_rate),
           monthly_emi = COALESCE($7, monthly_emi),
           start_date = COALESCE($8, start_date),
           end_date = $9,
           status = COALESCE($10, status)
         WHERE id::text = $11::text AND user_id = $12
         RETURNING *`,
        [
          name !== undefined ? name.trim() : null,
          type !== undefined ? type : null,
          lender !== undefined ? lender.trim() : null,
          principal_amount !== undefined ? parseFloat(principal_amount) : null,
          remaining_amount !== undefined ? parseFloat(remaining_amount) : null,
          interest_rate !== undefined ? parseFloat(interest_rate) : null,
          monthly_emi !== undefined ? parseFloat(monthly_emi) : null,
          start_date !== undefined ? start_date : null,
          end_date || null,
          status !== undefined ? status : null,
          id,
          userId,
        ]
      );

      if (updateRes.rows.length === 0) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }
      updatedRow = updateRes.rows[0];
    }

    return NextResponse.json(updatedRow);
  } catch (error: any) {
    console.error('Loans PATCH Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update loan' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove a loan
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing loan ID' }, { status: 400 });
    }

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();
    await client.query('DELETE FROM loans WHERE id::text = $1::text AND user_id = $2', [id, userId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Loans DELETE Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete loan' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
