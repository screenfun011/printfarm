import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthService, AuthServiceError } from '../service'
import type { Database } from '@printfarm/db'

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn().mockResolvedValue(true),
}))

vi.mock('otplib', () => ({
  authenticator: {
    verify: vi.fn().mockReturnValue(true),
    generateSecret: vi.fn().mockReturnValue('MOCK_TOTP_SECRET'),
    keyuri: vi.fn().mockReturnValue('otpauth://totp/PrintFarm:test@example.com?secret=MOCK_TOTP_SECRET'),
  },
}))

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440001'
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002'

const META = { ip: '127.0.0.1', userAgent: 'test-agent' }

const mockUser = {
  id: USER_ID,
  email: 'test@example.com',
  fullName: 'Test User',
  passwordHash: 'hashed_password',
  totpEnabled: false,
  totpSecret: null,
  avatarUrl: null,
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
}

const mockTenant = {
  id: TENANT_ID,
  name: "Test User's Farm",
}

const mockTenantUser = {
  tenantId: TENANT_ID,
  role: 'owner' as const,
}

const mockSession = { id: SESSION_ID }

function makeDb(queryResults: unknown[][]): Database {
  let callIndex = 0

  function queryChain(resolvedValue?: unknown[]) {
    const results = resolvedValue ?? queryResults[callIndex++] ?? []
    const chain: Record<string, unknown> = {}
    const methods = [
      'select', 'insert', 'update', 'delete',
      'from', 'where', 'innerJoin', 'limit',
      'orderBy', 'set', 'values', 'returning',
    ]
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    chain['returning'] = vi.fn().mockResolvedValue(results)
    chain['then'] = vi.fn().mockImplementation(
      (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(results)),
    )
    return chain
  }

  const db = {
    select: vi.fn().mockImplementation(() => queryChain()),
    insert: vi.fn().mockImplementation(() => queryChain()),
    update: vi.fn().mockImplementation(() => queryChain()),
    delete: vi.fn().mockImplementation(() => queryChain()),
  }

  return db as unknown as Database
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authService.register', () => {
  it('kreira korisnika, tenant i sesiju — vraća token i user', async () => {
    const db = makeDb([
      [],                // email check → ne postoji
      [mockTenant],      // insert tenant
      [mockUser],        // insert user
      [],                // insert tenant_user
      [mockSession],     // insert session
    ])
    const service = createAuthService({ db })
    const result = await service.register(
      { email: 'test@example.com', password: 'Password1', fullName: 'Test User' },
      META,
    )
    expect(result.token).toBeDefined()
    expect(result.user.email).toBe('test@example.com')
    expect(result.user.role).toBe('owner')
    expect(db.insert).toHaveBeenCalledTimes(4) // tenant, user, tenant_user, session
  })

  it('baca 409 ako email već postoji', async () => {
    const db = makeDb([
      [mockUser],  // email check → postoji
    ])
    const service = createAuthService({ db })
    await expect(
      service.register({ email: 'test@example.com', password: 'Password1', fullName: 'Test User' }, META),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN', status: 409 })
  })
})

describe('authService.login', () => {
  it('vraća token i user za ispravne kredencijale', async () => {
    const db = makeDb([
      [mockUser],       // find by email
      [mockTenantUser], // find tenant_user
      [],               // update lastLoginAt
      [mockSession],    // insert session
    ])
    const service = createAuthService({ db })
    const result = await service.login({ email: 'test@example.com', password: 'Password1' }, META)
    expect('token' in result).toBe(true)
    if ('token' in result) {
      expect(result.user.email).toBe('test@example.com')
    }
  })

  it('baca 401 ako korisnik ne postoji', async () => {
    const db = makeDb([[]])
    const service = createAuthService({ db })
    await expect(
      service.login({ email: 'ne@postoji.com', password: 'Password1' }, META),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('baca 401 za pogrešnu lozinku', async () => {
    const { compare } = await import('bcryptjs')
    vi.mocked(compare).mockResolvedValueOnce(false)

    const db = makeDb([[mockUser]])
    const service = createAuthService({ db })
    await expect(
      service.login({ email: 'test@example.com', password: 'WrongPass1' }, META),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('vraća requireTotp ako je TOTP omogućen a kod nije prosleđen', async () => {
    const db = makeDb([
      [{ ...mockUser, totpEnabled: true, totpSecret: 'SECRET' }],
    ])
    const service = createAuthService({ db })
    const result = await service.login({ email: 'test@example.com', password: 'Password1' }, META)
    expect(result).toEqual({ requireTotp: true })
  })

  it('baca 401 za neispravan TOTP kod', async () => {
    const { authenticator } = await import('otplib')
    vi.mocked(authenticator.verify).mockReturnValueOnce(false)

    const db = makeDb([
      [{ ...mockUser, totpEnabled: true, totpSecret: 'SECRET' }],
    ])
    const service = createAuthService({ db })
    await expect(
      service.login({ email: 'test@example.com', password: 'Password1', totpCode: '000000' }, META),
    ).rejects.toMatchObject({ code: 'TOTP_INVALID', status: 401 })
  })

  it('baca 401 ako user nema tenant', async () => {
    const db = makeDb([
      [mockUser],  // find by email
      [],          // find tenant_user → nema
    ])
    const service = createAuthService({ db })
    await expect(
      service.login({ email: 'test@example.com', password: 'Password1' }, META),
    ).rejects.toMatchObject({ status: 401 })
  })
})

describe('authService.logout', () => {
  it('briše sesiju iz baze', async () => {
    const db = makeDb([[]])
    const service = createAuthService({ db })
    await service.logout(SESSION_ID)
    expect(db.delete).toHaveBeenCalled()
  })
})

describe('authService.me', () => {
  it('vraća korisnika sa rolom', async () => {
    const db = makeDb([
      [{
        id: USER_ID,
        email: 'test@example.com',
        fullName: 'Test User',
        avatarUrl: null,
        totpEnabled: false,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: new Date('2024-01-01'),
        role: 'owner',
      }],
    ])
    const service = createAuthService({ db })
    const result = await service.me(USER_ID, TENANT_ID)
    expect(result.email).toBe('test@example.com')
    expect(result.role).toBe('owner')
    expect(result.tenantId).toBe(TENANT_ID)
  })

  it('baca 404 ako korisnik nije pronađen', async () => {
    const db = makeDb([[]])
    const service = createAuthService({ db })
    await expect(service.me(USER_ID, TENANT_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('authService.setupTotp', () => {
  it('generiše secret i URI, čuva u bazi', async () => {
    const db = makeDb([
      [{ email: 'test@example.com', totpEnabled: false }],  // find user
      [],  // update totpSecret
    ])
    const service = createAuthService({ db })
    const result = await service.setupTotp(USER_ID)
    expect(result.secret).toBe('MOCK_TOTP_SECRET')
    expect(result.uri).toContain('otpauth://totp')
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 409 ako je TOTP već omogućen', async () => {
    const db = makeDb([
      [{ email: 'test@example.com', totpEnabled: true }],
    ])
    const service = createAuthService({ db })
    await expect(service.setupTotp(USER_ID)).rejects.toMatchObject({ code: 'TOTP_ALREADY_ENABLED', status: 409 })
  })

  it('baca 404 ako korisnik nije pronađen', async () => {
    const db = makeDb([[]])
    const service = createAuthService({ db })
    await expect(service.setupTotp(USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('authService.verifyTotp', () => {
  it('aktivira TOTP za ispravan kod', async () => {
    const db = makeDb([
      [{ totpSecret: 'SECRET', totpEnabled: false }],
      [],
    ])
    const service = createAuthService({ db })
    await service.verifyTotp(USER_ID, '123456')
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 400 ako TOTP nije podešen', async () => {
    const db = makeDb([
      [{ totpSecret: null, totpEnabled: false }],
    ])
    const service = createAuthService({ db })
    await expect(service.verifyTotp(USER_ID, '123456')).rejects.toMatchObject({ code: 'TOTP_NOT_SETUP', status: 400 })
  })

  it('baca 400 za neispravan kod', async () => {
    const { authenticator } = await import('otplib')
    vi.mocked(authenticator.verify).mockReturnValueOnce(false)

    const db = makeDb([
      [{ totpSecret: 'SECRET', totpEnabled: false }],
    ])
    const service = createAuthService({ db })
    await expect(service.verifyTotp(USER_ID, '000000')).rejects.toMatchObject({ code: 'TOTP_INVALID', status: 400 })
  })
})

describe('AuthServiceError', () => {
  it('ima code, message, status i name', () => {
    const err = new AuthServiceError('TEST_CODE', 'Test poruka', 422)
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('Test poruka')
    expect(err.status).toBe(422)
    expect(err.name).toBe('AuthServiceError')
    expect(err instanceof Error).toBe(true)
  })

  it('default status je 400', () => {
    const err = new AuthServiceError('CODE', 'msg')
    expect(err.status).toBe(400)
  })
})
