export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseStatementFile } from '@/lib/statement-parser';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let client;

  try {
    const body = await request.json().catch(() => ({}));
    const password = body.password || undefined;

    const authUser = await getSessionUser(request);
    const userId = authUser ? authUser.id : 'bd585d75-ba13-40a0-87c0-e58c45f1aa68';

    client = await pool.connect();

    // 1. Fetch document record scoped to user
    const docRes = await client.query('SELECT * FROM documents WHERE id = $1 AND user_id = $2', [id, userId]);
    if (docRes.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = docRes.rows[0];
    let fileBuffer: Buffer | null = null;

    // 2. Fetch File Buffer (Local Disk or AWS S3)
    if (doc.storage_provider === 'S3' && doc.s3_key) {
      try {
        const bucketName = process.env.AWS_S3_BUCKET_NAME || 'ledgerly-vault';
        const s3Response = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucketName,
            Key: doc.s3_key,
          })
        );
        const byteArray = await s3Response.Body?.transformToByteArray();
        if (byteArray) {
          fileBuffer = Buffer.from(byteArray);
        }
      } catch (s3Err) {
        console.warn('Could not read from S3, trying local fallback:', s3Err);
      }
    }

    // Fallback or primary local read
    if (!fileBuffer && doc.s3_key) {
      const localPath = path.resolve(process.cwd(), doc.s3_key);
      if (fs.existsSync(localPath)) {
        fileBuffer = fs.readFileSync(localPath);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Document file binary is unavailable on server storage.' },
        { status: 404 }
      );
    }

    // 3. Fetch user categorization rules
    let userRules: any[] = [];
    try {
      const rulesRes = await client.query('SELECT keyword, category FROM rules WHERE user_id = $1', [userId]);
      userRules = rulesRes.rows;
    } catch {
      userRules = [];
    }

    // 4. Parse transactions using multi-format engine
    const transactions = await parseStatementFile(fileBuffer, doc.filename, userRules, password);

    let totalIncome = 0;
    let totalExpense = 0;
    let creditCount = 0;
    let debitCount = 0;

    for (const t of transactions) {
      if (t.type === 'income') {
        totalIncome += t.amount;
        creditCount++;
      } else {
        totalExpense += t.amount;
        debitCount++;
      }
    }

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      filename: doc.filename,
      count: transactions.length,
      metrics: {
        totalTransactions: transactions.length,
        creditCount,
        debitCount,
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
      },
      transactions,
    });
  } catch (error: any) {
    console.error('Document Parse API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to parse statement transactions' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
