import { Pool, types } from 'pg';

// CRITICAL FIX: Force node-postgres to return DATE (OID 1082) as a plain YYYY-MM-DD string
// instead of creating a JavaScript Date object at local midnight (which gets shifted to previous day in UTC!)
types.setTypeParser(1082, (val: string) => val);

// This prevents Next.js hot-reloads from crashing your database with too many connections
const globalForPg = global as unknown as { pool: Pool };

export const pool =
  globalForPg.pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for secure AWS RDS connections
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pool = pool;
