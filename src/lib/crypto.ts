import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || ''
  if (!key) throw new Error('ENCRYPTION_KEY is not set in environment')
  // Use first 32 bytes of hex key (64 hex chars = 32 bytes)
  return Buffer.from(key.slice(0, 64), 'hex')
}

/**
 * Encrypt a plaintext string. Returns base64 string with iv:authTag:ciphertext format.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Format: iv(hex):authTag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an encrypted string (base64 format iv:authTag:ciphertext).
 */
export function decrypt(encryptedData: string): string {
  const key = getKey()
  const parts = encryptedData.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const ciphertext = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Mask an encrypted key for display (shows only last 4 chars).
 */
export function maskKey(encryptedData: string): string {
  try {
    const plain = decrypt(encryptedData)
    if (plain.length <= 4) return '****'
    return '*'.repeat(plain.length - 4) + plain.slice(-4)
  } catch {
    return '****'
  }
}
