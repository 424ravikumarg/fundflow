import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

function cleanEnv(val: string | undefined, fallback: string = ''): string {
  if (!val) return fallback;
  return val.trim().replace(/^["']|["']$/g, '');
}

const s3Region = cleanEnv(process.env.AWS_REGION, 'ap-south-1');
const s3AccessKey = cleanEnv(process.env.AWS_ACCESS_KEY_ID);
const s3SecretKey = cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);

const s3Client = new S3Client({
  region: s3Region,
  credentials: {
    accessKeyId: s3AccessKey,
    secretAccessKey: s3SecretKey,
  },
});

async function ensureSettingsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    INSERT INTO app_settings (key, value)
    VALUES ('baseline_net_worth', '0')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO app_settings (key, value)
    VALUES ('currency', 'USD')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO app_settings (key, value)
    VALUES ('storage_destination', 'local')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO app_settings (key, value)
    VALUES ('local_storage_path', './storage/documents')
    ON CONFLICT (key) DO NOTHING;
  `);
}

// 1. GET: Fetch settings and perform health check across RDS, S3, and Local Storage
export async function GET() {
  let dbStatus = 'disconnected';
  let dbError = '';
  let s3Status = 'disconnected';
  let localStatus = 'disconnected';
  let baselineNetWorth = 0;
  let currency = 'USD';
  let storageDestination = 'local';
  let localStoragePath = './storage/documents';
  let client;

  // Test Database Connection & Load Settings
  try {
    client = await pool.connect();
    await ensureSettingsTable(client);

    const res = await client.query(
      "SELECT key, value FROM app_settings WHERE key IN ('baseline_net_worth', 'currency', 'storage_destination', 'local_storage_path')"
    );

    res.rows.forEach((row: any) => {
      if (row.key === 'baseline_net_worth') {
        baselineNetWorth = parseFloat(row.value) || 0;
      }
      if (row.key === 'currency') {
        currency = row.value || 'USD';
      }
      if (row.key === 'storage_destination') {
        storageDestination = row.value || 'local';
      }
      if (row.key === 'local_storage_path') {
        localStoragePath = row.value || './storage/documents';
      }
    });

    dbStatus = 'connected';
  } catch (err: any) {
    console.error('RDS Health Check Failed:', err);
    dbStatus = 'error';
    dbError = err.message || 'Connection failed';
  } finally {
    if (client) client.release();
  }

  // Test Local Storage Health
  try {
    const resolvedPath = path.resolve(process.cwd(), localStoragePath);
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }
    // Verify write permissions
    const testFile = path.join(resolvedPath, '.health_check');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    localStatus = 'connected';
  } catch (err) {
    console.error('Local Storage Health Check Failed:', err);
    localStatus = 'error';
  }

  // Test S3 Connection
  const bucketName = cleanEnv(process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME, 'ledgerly-vault');
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    s3Status = 'connected';
  } catch (err) {
    console.error('S3 Health Check Failed:', err);
    s3Status = 'error';
  }

  return NextResponse.json({
    settings: {
      baseline_net_worth: baselineNetWorth,
      currency,
      storage_destination: storageDestination,
      local_storage_path: localStoragePath,
    },
    health: {
      rds: {
        status: dbStatus,
        service: 'AWS RDS PostgreSQL',
        database: cleanEnv(process.env.DATABASE_NAME, 'postgres'),
        error: dbError || undefined,
      },
      s3: {
        status: s3Status,
        service: 'AWS S3 Cloud Storage',
        bucket: bucketName,
        region: s3Region,
      },
      local: {
        status: localStatus,
        service: 'Local On-Device Storage',
        path: localStoragePath,
      },
    },
  });
}

// 2. POST: Update settings
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { baseline_net_worth, currency, storage_destination, local_storage_path } = body;

    client = await pool.connect();
    await ensureSettingsTable(client);

    if (baseline_net_worth !== undefined) {
      await client.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('baseline_net_worth', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [String(baseline_net_worth ?? 0)]
      );
    }

    if (currency !== undefined) {
      await client.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('currency', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [String(currency).toUpperCase().trim()]
      );
    }

    if (storage_destination !== undefined) {
      const dest = storage_destination === 's3' ? 's3' : 'local';
      await client.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('storage_destination', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [dest]
      );
    }

    if (local_storage_path !== undefined) {
      await client.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('local_storage_path', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [String(local_storage_path).trim()]
      );
    }

    return NextResponse.json({
      success: true,
      baseline_net_worth,
      currency,
      storage_destination,
      local_storage_path,
    });
  } catch (err: any) {
    console.error('Settings POST Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save settings' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
