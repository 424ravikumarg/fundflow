export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import fs from 'fs';
import path from 'path';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

async function ensureDocumentsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      mimetype VARCHAR(255) DEFAULT 'application/octet-stream',
      s3_key VARCHAR(255),
      file_type VARCHAR(50),
      file_size INT,
      parsed_text TEXT,
      storage_provider VARCHAR(50) DEFAULT 'LOCAL',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'storage_provider'
      ) THEN 
        ALTER TABLE documents ADD COLUMN storage_provider VARCHAR(50) DEFAULT 'LOCAL'; 
      END IF; 
    END $$;
  `);
}

// 1. GET: List all uploaded documents
export async function GET() {
  let client;
  try {
    client = await pool.connect();
    await ensureDocumentsTable(client);

    const result = await client.query(`
      SELECT 
        id, 
        filename, 
        s3_key, 
        COALESCE(file_type, 'DOC') AS file_type, 
        COALESCE(file_size, 0) AS file_size, 
        COALESCE(storage_provider, 'LOCAL') AS storage_provider,
        parsed_text, 
        created_at 
      FROM documents 
      ORDER BY created_at DESC
    `);
    return NextResponse.json(result.rows || []);
  } catch (err: any) {
    console.error('Documents GET Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch documents' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. POST: Upload, Store Locally or in S3, and Extract Text & Transactions
export async function POST(request: Request) {
  let client;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = file.name;
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const mimetype = file.type || 'application/octet-stream';

    const NL = String.fromCharCode(10);
    const DBL_NL = String.fromCharCode(10, 10);

    let parsedText = '';

    // --- Isolated Format Parsers ---
    if (extension === 'pdf') {
      try {
        const { text } = await extractText(new Uint8Array(bytes));
        const combinedText = Array.isArray(text) ? text.join(DBL_NL) : String(text || '');
        parsedText = combinedText.trim() || 'No selectable text found in this PDF (it may be a scanned image).';
      } catch (pdfErr: any) {
        console.error('PDF Parse Warning:', pdfErr);
        parsedText = `[PDF extraction notice: ${pdfErr.message || 'Scanned or encrypted PDF'}]`;
      }
    } else if (['xlsx', 'xls', 'csv'].includes(extension)) {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const parsedSheets: string[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(sheet);
          if (csvData.trim()) {
            parsedSheets.push(`--- Sheet: ${sheetName} ---` + NL + csvData.trim());
          }
        });

        parsedText = parsedSheets.join(DBL_NL) || 'Spreadsheet is empty.';
      } catch (xlsxErr: any) {
        console.error('Spreadsheet Parse Warning:', xlsxErr);
        parsedText = `[Spreadsheet extraction notice: ${xlsxErr.message}]`;
      }
    } else if (extension === 'docx') {
      try {
        const docResult = await mammoth.extractRawText({ buffer });
        parsedText = docResult.value?.trim() || 'Word document is empty.';
      } catch (docErr: any) {
        console.error('Word Parse Warning:', docErr);
        parsedText = `[Word extraction notice: ${docErr.message}]`;
      }
    } else if (extension === 'txt') {
      parsedText = buffer.toString('utf-8');
    } else {
      parsedText = `File format: ${extension.toUpperCase()}. Automatic text extraction is not supported for this file type.`;
    }

    client = await pool.connect();
    await ensureDocumentsTable(client);

    // Check user's storage destination preference from app_settings
    let storageDestination = 'local';
    try {
      const settingRes = await client.query("SELECT value FROM app_settings WHERE key = 'storage_destination'");
      if (settingRes.rows.length > 0) {
        storageDestination = settingRes.rows[0].value.toLowerCase();
      }
    } catch {
      // default to local
    }

    let storageKey = '';
    let storageProvider = 'LOCAL';

    if (storageDestination === 's3') {
      // --- Upload to AWS S3 Vault ---
      storageProvider = 'S3';
      storageKey = `documents/${Date.now()}-${filename.replace(/\s+/g, '_')}`;
      const bucketName = process.env.AWS_S3_BUCKET_NAME || 'ledgerly-vault';

      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: storageKey,
            Body: buffer,
            ContentType: mimetype,
          })
        );
      } catch (s3Err) {
        console.warn('S3 upload fallback to local storage:', s3Err);
        // Fallback to local if S3 fails
        storageProvider = 'LOCAL';
      }
    }

    if (storageProvider === 'LOCAL') {
      // --- Save to Local Storage ---
      const localDir = path.resolve(process.cwd(), 'storage', 'documents');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const safeFilename = `${Date.now()}-${filename.replace(/\s+/g, '_')}`;
      const localFilePath = path.join(localDir, safeFilename);
      fs.writeFileSync(localFilePath, buffer);
      storageKey = `storage/documents/${safeFilename}`;
    }

    // --- Persist Metadata and Extracted Text in PostgreSQL ---
    const id = crypto.randomUUID();
    const result = await client.query(
      `INSERT INTO documents (id, filename, mimetype, s3_key, file_type, file_size, parsed_text, storage_provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, filename, mimetype, storageKey, extension.toUpperCase(), buffer.length, parsedText, storageProvider]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Document Processing Error:', err);
    return NextResponse.json(
      { error: err.message || 'File processing failed' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// 3. DELETE: Remove a document
export async function DELETE(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureDocumentsTable(client);

    const docRes = await client.query('SELECT s3_key, storage_provider FROM documents WHERE id = $1', [id]);
    if (docRes.rows.length > 0) {
      const doc = docRes.rows[0];
      if (doc.storage_provider === 'LOCAL' && doc.s3_key) {
        try {
          const absPath = path.resolve(process.cwd(), doc.s3_key);
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } catch (e) {
          console.warn('Failed to remove local file:', e);
        }
      } else if (doc.storage_provider === 'S3' && doc.s3_key) {
        try {
          const bucketName = process.env.AWS_S3_BUCKET_NAME || 'ledgerly-vault';
          await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: doc.s3_key }));
        } catch (e) {
          console.warn('Failed to delete S3 object:', e);
        }
      }
    }

    await client.query('DELETE FROM documents WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Documents DELETE Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete document' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
