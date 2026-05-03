/**
 * AES-256-GCM token encryption for OAuth access/refresh tokens stored in the DB.
 *
 * Requires TOKEN_ENCRYPTION_KEY env var — 64 hex characters (32 bytes).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * State signing uses OAUTH_STATE_SECRET (falls back to CRON_SECRET in dev).
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const ENCRYPTED_PREFIX = 'enc:v1:'; // Distinguishes encrypted values from legacy plaintext

function getEncryptionKey(): Buffer | null {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[token-encryption] TOKEN_ENCRYPTION_KEY is required in production. ' +
        'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    console.warn(
      '[token-encryption] TOKEN_ENCRYPTION_KEY not set. Storing tokens as plaintext in development. ' +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
    return null;
  }
  if (hex.length !== 64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `[token-encryption] TOKEN_ENCRYPTION_KEY is ${hex.length} chars — must be exactly 64 hex chars (32 bytes). ` +
        'Fix this env var before deploying.'
      );
    }
    console.error(
      `[token-encryption] TOKEN_ENCRYPTION_KEY is ${hex.length} chars — must be exactly 64 hex chars (32 bytes). ` +
      'Falling back to plaintext token storage. Fix this env var immediately.'
    );
    return null;
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Decrypt a token previously encrypted with encryptToken.
 * Handles legacy plaintext tokens (no enc:v1: prefix) transparently.
 */
export function decryptToken(ciphertext: string): string {
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext; // legacy plaintext — no key was set when stored
  }

  const key = getEncryptionKey();
  if (!key) {
    // Key not configured — can't decrypt; return raw so callers surface an auth error
    return ciphertext;
  }

  const rest = ciphertext.slice(ENCRYPTED_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) {
    throw new Error('[token-encryption] Invalid encrypted token format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Encrypt a plaintext token string with AES-256-GCM.
 * Returns: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  // If no encryption key is configured, fall back to plaintext storage.
  // This keeps OAuth flows working during bootstrap, with a warning logged.
  if (!key) {
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}


// ─── OAuth State Signing ───────────────────────────────────────────────────────

function getStateSecret(): string {
  return process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET || '';
}

/**
 * Encode and HMAC-sign OAuth state so it can't be tampered with.
 * Returns: "<base64url_payload>.<hmac_hex>"
 * Falls back to unsigned base64url in dev if no secret is configured.
 */
export function signState(payload: Record<string, string>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = getStateSecret();

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[token-encryption] OAUTH_STATE_SECRET is required in production. Set it to prevent OAuth CSRF attacks.');
    }
    return encoded;
  }

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('hex');

  return `${encoded}.${hmac}`;
}

/**
 * Verify the HMAC and decode the state payload.
 * Returns null if the signature is invalid or the payload can't be parsed.
 */
export function verifyState(signedState: string): Record<string, string> | null {
  const secret = getStateSecret();

  if (!secret) {
    // Dev mode — try to decode without signature
    try {
      const raw = signedState.includes('.')
        ? signedState.substring(0, signedState.lastIndexOf('.'))
        : signedState;
      return JSON.parse(Buffer.from(raw, 'base64url').toString());
    } catch {
      return null;
    }
  }

  const lastDot = signedState.lastIndexOf('.');
  if (lastDot === -1) {
    // No signature — reject in production
    return null;
  }

  const encoded = signedState.substring(0, lastDot);
  const receivedSig = signedState.substring(lastDot + 1);

  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(receivedSig, 'hex');
    const expBuf = Buffer.from(expectedHmac, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch {
    return null;
  }
}
