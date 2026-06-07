// Per-tenant credential encryption. The master key lives OUTSIDE the database
// (PAYMENT_ENC_KEY env / secret manager), never in the repo. Credentials are
// encrypted on write (Tenants.paymentConfig.credentials beforeChange) and
// decrypted only at point of use. See references/payments.md.
import crypto from 'node:crypto'

function key(): Buffer {
  const hex = process.env.PAYMENT_ENC_KEY
  if (!hex) throw new Error('PAYMENT_ENC_KEY is not set (need 32 bytes hex)')
  const k = Buffer.from(hex, 'hex')
  if (k.length !== 32) throw new Error('PAYMENT_ENC_KEY must be 32 bytes (64 hex chars)')
  return k
}

/** Encrypt a JSON-serializable credentials object -> base64 string. */
export function encryptCredentials(plain: unknown): string {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(JSON.stringify(plain), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')
}

/** Decrypt a base64 string produced by encryptCredentials back to the object. */
export function decryptCredentials<T = Record<string, unknown>>(blob: string): T {
  const buf = Buffer.from(blob, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  const dec = Buffer.concat([d.update(data), d.final()]).toString('utf8')
  return JSON.parse(dec) as T
}
