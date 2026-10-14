import 'server-only'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function newTotpSecret() {
  return base32Encode(randomBytes(20))
}

function hotp(secret: string, counter: number) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const offset = mac[mac.length - 1] & 15
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

export function verifyTotp(secret: string, input: string) {
  const code = input.replace(/\D/g, '')
  if (code.length !== 6) return false
  const step = Math.floor(Date.now() / 30_000)
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(secret, step + drift))
    if (timingSafeEqual(expected, Buffer.from(code))) return true
  }
  return false
}

export function otpauthUrl(secret: string, account: string) {
  const issuer = 'AL KANKA Panel'
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

function key() {
  const base = process.env.BETTER_AUTH_SECRET || process.env.ADMIN_PASSWORD || ''
  if (!base) throw new Error('Şifreleme anahtarı yok (BETTER_AUTH_SECRET).')
  return createHash('sha256').update(`${base}:panel-totp`).digest()
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
}

export function decryptSecret(value: string) {
  const [iv, tag, data] = value.split('.').map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function hashBackupCode(code: string) {
  return createHash('sha256').update(code.replace(/[^a-z0-9]/gi, '').toLowerCase()).digest('hex')
}

export function newBackupCodes(count = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: count }, () => {
    let s = ''
    for (let i = 0; i < 10; i++) s += chars[randomInt(chars.length)]
    return `${s.slice(0, 5)}-${s.slice(5)}`
  })
}
