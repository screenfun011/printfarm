import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAdminAuthService, AdminAuthError } from '../service.js'
import type { Database } from '../../../lib/db.js'

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('../../../lib/totp.js', () => ({
  authenticator: {
    verify: vi.fn().mockReturnValue(true),
  },
}))

const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440000'
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001'
const META = { ip: '127.0.0.1', userAgent: 'test-agent' }

const mockAdmin = {
  id: ADMIN_ID,
  email: 'admin@printfarm.com',
  fullName: 'Super Admin',
  passwordHash: 'hashed_password',
  totpEnabled: false,
  totpSecret: 'SECRET',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
}

const mockSession = { id: SESSION_ID }

function makeDb(queryResults: unknown[][]): Database {
  let callIndex = 0
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const result = queryResults[callIndex++] ?? []
      return Promise.resolve(result)
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => {
      const result = queryResults[callIndex++] ?? []
      return Promise.resolve(result)
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
  return chain as unknown as Database
}

describe('createAdminAuthService — login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uspješno se loguje sa email i lozinkom (TOTP onemogućen)', async () => {
    const db = makeDb([
      [mockAdmin],   // find admin by email (limit)
      [mockSession], // insert session (returning)
    ])
    const service = createAdminAuthService({ db })
    const result = await service.login({ email: 'admin@printfarm.com', password: 'Password1' }, META)

    expect('token' in result).toBe(true)
    if ('token' in result) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).admin.email).toBe('admin@printfarm.com')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).admin.id).toBe(ADMIN_ID)
    }
  })

  it('vraća requireTotp ako je TOTP omogućen a kod nije prosleđen', async () => {
    const db = makeDb([[{ ...mockAdmin, totpEnabled: true }]])
    const service = createAdminAuthService({ db })
    const result = await service.login({ email: 'admin@printfarm.com', password: 'Password1' }, META)
    expect(result).toEqual({ requireTotp: true })
  })

  it('uspješno se loguje sa TOTP kodom', async () => {
    const db = makeDb([
      [{ ...mockAdmin, totpEnabled: true }],
      [mockSession], // insert session (returning)
    ])
    const service = createAdminAuthService({ db })
    const result = await service.login(
      { email: 'admin@printfarm.com', password: 'Password1', totpCode: '123456' },
      META,
    )
    expect('token' in result).toBe(true)
  })

  it('baca 401 ako admin ne postoji', async () => {
    const db = makeDb([[]])
    const service = createAdminAuthService({ db })
    await expect(
      service.login({ email: 'ne@postoji.com', password: 'Password1' }, META),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('baca 401 za pogrešnu lozinku', async () => {
    const bcrypt = await import('bcryptjs')
    vi.mocked(bcrypt.default.compare as (a: string, b: string) => Promise<boolean>)
      .mockResolvedValueOnce(false)

    const db = makeDb([[mockAdmin]])
    const service = createAdminAuthService({ db })
    await expect(
      service.login({ email: 'admin@printfarm.com', password: 'WrongPass' }, META),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('baca 403 za neaktivan nalog', async () => {
    const db = makeDb([[{ ...mockAdmin, isActive: false }]])
    const service = createAdminAuthService({ db })
    await expect(
      service.login({ email: 'admin@printfarm.com', password: 'Password1' }, META),
    ).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE', status: 403 })
  })

  it('baca 401 za neispravan TOTP kod', async () => {
    const { authenticator } = await import('../../../lib/totp.js')
    vi.mocked(authenticator.verify).mockReturnValueOnce(false)

    const db = makeDb([[{ ...mockAdmin, totpEnabled: true }]])
    const service = createAdminAuthService({ db })
    await expect(
      service.login({ email: 'admin@printfarm.com', password: 'Password1', totpCode: '000000' }, META),
    ).rejects.toMatchObject({ code: 'TOTP_INVALID', status: 401 })
  })
})

describe('createAdminAuthService — logout', () => {
  it('briše sesiju', async () => {
    const db = makeDb([])
    const service = createAdminAuthService({ db })
    await service.logout('token123')
    expect(db.delete).toHaveBeenCalled()
  })
})

describe('createAdminAuthService — me', () => {
  it('vraća podatke o super adminu', async () => {
    const db = makeDb([[mockAdmin]])
    const service = createAdminAuthService({ db })
    const result = await service.me(ADMIN_ID)
    expect(result.id).toBe(ADMIN_ID)
    expect(result.email).toBe('admin@printfarm.com')
  })

  it('baca 404 ako admin ne postoji', async () => {
    const db = makeDb([[]])
    const service = createAdminAuthService({ db })
    await expect(service.me(ADMIN_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('AdminAuthError', () => {
  it('ima code, message, status', () => {
    const err = new AdminAuthError('TEST', 'Poruka', 422)
    expect(err.code).toBe('TEST')
    expect(err.message).toBe('Poruka')
    expect(err.status).toBe(422)
    expect(err.name).toBe('AdminAuthError')
  })

  it('default status je 400', () => {
    const err = new AdminAuthError('CODE', 'msg')
    expect(err.status).toBe(400)
  })
})
