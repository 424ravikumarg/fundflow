import crypto from 'crypto';
import { pool } from '@/lib/db';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number; // 0 to 4
}

/**
 * Enforces strict complex password standards:
 * - Minimum 10 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one numeric digit (0-9)
 * - At least one special symbol (!@#$%^&* etc.)
 */
export function validateComplexPassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  if (!password || password.length < 10) {
    errors.push('Password must be at least 10 characters long.');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter (A-Z).');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter (a-z).');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must include at least one numeric digit (0-9).');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?~`]/.test(password)) {
    errors.push('Password must include at least one special character (!@#$%^&* etc.).');
  } else {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(4, score),
  };
}

/**
 * Cryptographically secure password hashing using Scrypt with unique 16-byte salt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Constant-time password verification to protect against timing attacks
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    return crypto.timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Master encryption key for Password Manager Vault credentials.
 * Uses AES-256-GCM authenticated encryption.
 */
const VAULT_MASTER_SECRET = process.env.VAULT_SECRET_KEY || 'fundflow-secure-vault-master-key-32b';

function getVaultKey(userSalt: string): Buffer {
  return crypto.scryptSync(VAULT_MASTER_SECRET, userSalt, 32);
}

/**
 * Encrypts a stored password using AES-256-GCM.
 * Output includes ciphertext, initialization vector (IV), and GCM authentication tag.
 */
export function encryptVaultPassword(plainPassword: string, userSalt: string): {
  ciphertext: string;
  iv: string;
  tag: string;
} {
  const key = getVaultKey(userSalt);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainPassword, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypts a stored password using AES-256-GCM with authentication tag validation.
 */
export function decryptVaultPassword(
  ciphertext: string,
  ivHex: string,
  tagHex: string,
  userSalt: string
): string {
  const key = getVaultKey(userSalt);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a random 6-digit numeric OTP for 2FA
 */
export function generate2FAOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Masks destination phone/email for security
 */
export function maskContact(value: string, method: 'email' | 'mobile'): string {
  if (method === 'email') {
    const [name, domain] = value.split('@');
    if (!name || !domain) return value;
    const visible = name.slice(0, 2);
    return `${visible}***@${domain}`;
  } else {
    const clean = value.replace(/\s+/g, '');
    if (clean.length <= 4) return clean;
    const last4 = clean.slice(-4);
    return `******${last4}`;
  }
}

/**
 * Ensures all Auth & Credentials tables exist in PostgreSQL
 */
export async function ensureAuthTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      password_hash VARCHAR(255) NOT NULL,
      salt VARCHAR(255) NOT NULL,
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      two_factor_method VARCHAR(20) DEFAULT 'email',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS two_factor_otps (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      otp_code VARCHAR(10) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      method VARCHAR(20) NOT NULL,
      purpose VARCHAR(50) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS credentials_vault (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL,
      url VARCHAR(500),
      category VARCHAR(100) DEFAULT 'General',
      encrypted_password TEXT NOT NULL,
      iv VARCHAR(64) NOT NULL,
      auth_tag VARCHAR(64) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

/**
 * Extracts and verifies the authenticated user from cookies or Authorization header
 */
export async function getSessionUser(request: Request): Promise<{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  two_factor_enabled: boolean;
  two_factor_method: 'email' | 'mobile';
  salt: string;
} | null> {
  const authHeader = request.headers.get('authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/fundflow_session=([^;]+)/);
    if (match) token = match[1].trim();
  }

  if (!token) return null;

  let client;
  try {
    client = await pool.connect();
    await ensureAuthTables(client);

    const res = await client.query(
      `SELECT u.id, u.name, u.email, u.phone, u.two_factor_enabled, u.two_factor_method, u.salt
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    console.error('getSessionUser error:', err);
    return null;
  } finally {
    if (client) client.release();
  }
}
