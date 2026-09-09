export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureAssetsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      asset_type VARCHAR(50) NOT NULL,
      category VARCHAR(100) DEFAULT 'Investment',
      invested_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      current_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      quantity DECIMAL(16,6) DEFAULT 0,
      unit VARCHAR(50) DEFAULT 'units',
      monthly_contribution DECIMAL(12,2) DEFAULT 0,
      institution VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

// 1. GET: Fetch all assets and portfolio summary metrics
export async function GET() {
  let client;
  try {
    client = await pool.connect();
    await ensureAssetsTable(client);

    const result = await client.query(
      'SELECT * FROM assets ORDER BY current_value DESC, created_at DESC'
    );
    const assets = result.rows || [];

    const totalInvested = assets.reduce((sum: number, a: any) => sum + (Number(a.invested_amount) || 0), 0);
    const totalCurrentValue = assets.reduce((sum: number, a: any) => sum + (Number(a.current_value) || 0), 0);
    const totalMonthlyContribution = assets.reduce((sum: number, a: any) => sum + (Number(a.monthly_contribution) || 0), 0);
    const totalGainLoss = totalCurrentValue - totalInvested;
    const totalGainLossPercentage = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    // Asset allocation breakdown by type
    const allocationByType: Record<string, { totalValue: number; count: number; percentage: number }> = {};
    assets.forEach((a: any) => {
      const type = a.asset_type || 'other';
      const val = Number(a.current_value) || 0;
      if (!allocationByType[type]) {
        allocationByType[type] = { totalValue: 0, count: 0, percentage: 0 };
      }
      allocationByType[type].totalValue += val;
      allocationByType[type].count += 1;
    });

    Object.keys(allocationByType).forEach((type) => {
      allocationByType[type].percentage =
        totalCurrentValue > 0 ? (allocationByType[type].totalValue / totalCurrentValue) * 100 : 0;
    });

    return NextResponse.json({
      assets,
      summary: {
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
        totalMonthlyContribution: Math.round(totalMonthlyContribution * 100) / 100,
        totalGainLoss: Math.round(totalGainLoss * 100) / 100,
        totalGainLossPercentage: Math.round(totalGainLossPercentage * 100) / 100,
        assetCount: assets.length,
        allocationByType,
      },
    });
  } catch (err: any) {
    console.error('Assets GET Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch assets' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Create a new asset holding / SIP
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const {
      name,
      asset_type,
      category,
      invested_amount,
      current_value,
      quantity,
      unit,
      monthly_contribution,
      institution,
      notes,
    } = body;

    if (!name || !asset_type) {
      return NextResponse.json({ error: 'Asset name and asset type are required' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureAssetsTable(client);

    const id = crypto.randomUUID();
    const result = await client.query(
      `INSERT INTO assets (
        id, name, asset_type, category, invested_amount, current_value,
        quantity, unit, monthly_contribution, institution, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        id,
        name.trim(),
        asset_type.toLowerCase().trim(),
        category ? category.trim() : 'Investment',
        parseFloat(invested_amount) || 0,
        parseFloat(current_value) || parseFloat(invested_amount) || 0,
        parseFloat(quantity) || 0,
        unit ? unit.trim() : 'units',
        parseFloat(monthly_contribution) || 0,
        institution ? institution.trim() : '',
        notes ? notes.trim() : '',
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Assets POST Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create asset' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 3. PATCH: Update an asset (current value, invested capital, monthly SIP, etc.)
export async function PATCH(request: Request) {
  let client;
  try {
    const body = await request.json();
    const {
      id,
      name,
      asset_type,
      category,
      invested_amount,
      current_value,
      quantity,
      unit,
      monthly_contribution,
      institution,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureAssetsTable(client);

    const result = await client.query(
      `UPDATE assets
       SET
         name = COALESCE($1, name),
         asset_type = COALESCE($2, asset_type),
         category = COALESCE($3, category),
         invested_amount = COALESCE($4, invested_amount),
         current_value = COALESCE($5, current_value),
         quantity = COALESCE($6, quantity),
         unit = COALESCE($7, unit),
         monthly_contribution = COALESCE($8, monthly_contribution),
         institution = COALESCE($9, institution),
         notes = COALESCE($10, notes),
         updated_at = NOW()
       WHERE id::text = $11::text
       RETURNING *`,
      [
        name ? name.trim() : null,
        asset_type ? asset_type.toLowerCase().trim() : null,
        category ? category.trim() : null,
        invested_amount !== undefined && invested_amount !== null && invested_amount !== '' ? parseFloat(invested_amount) : null,
        current_value !== undefined && current_value !== null && current_value !== '' ? parseFloat(current_value) : null,
        quantity !== undefined && quantity !== null && quantity !== '' ? parseFloat(quantity) : null,
        unit ? unit.trim() : null,
        monthly_contribution !== undefined && monthly_contribution !== null && monthly_contribution !== '' ? parseFloat(monthly_contribution) : null,
        institution ? institution.trim() : null,
        notes !== undefined ? notes.trim() : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Assets PATCH Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update asset' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 4. DELETE: Remove an asset
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureAssetsTable(client);

    await client.query('DELETE FROM assets WHERE id::text = $1::text', [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Assets DELETE Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete asset' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
