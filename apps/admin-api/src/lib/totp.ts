import { createHmac, randomBytes } from 'node:crypto'

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, '').toUpperCase()
  let bits = 0, value = 0
  const output: number[] = []
  for (const char of clean) {
    const idx = B32_ALPHABET.indexOf(char)
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += B32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function generateToken(secret: string, timestampMs = Date.now()): string {
  const key = base32Decode(secret)
  const counter = Math.floor(timestampMs / 1000 / 30)
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = (hmac[hmac.length - 1] as number) & 0xf
  const code =
    (((hmac[offset] as number) & 0x7f) << 24) |
    ((hmac[offset + 1] as number) << 16) |
    ((hmac[offset + 2] as number) << 8) |
    (hmac[offset + 3] as number)
  return String(code % 1_000_000).padStart(6, '0')
}

export const authenticator = {
  generateSecret(): string {
    return base32Encode(randomBytes(20))
  },
  verify({ token, secret }: { token: string; secret: string }): boolean {
    const now = Date.now()
    for (const offset of [-1, 0, 1]) {
      if (generateToken(secret, now + offset * 30_000) === token) return true
    }
    return false
  },
  keyuri(accountName: string, issuer: string, secret: string): string {
    const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params}`
  },
}
