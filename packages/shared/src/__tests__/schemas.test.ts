import { describe, it, expect } from 'vitest'
import { addPrinterSchema, printerModelSchema } from '../schemas/printer'
import { createJobSchema } from '../schemas/job'
import { registerSchema, loginSchema } from '../schemas/user'
import { createTenantSchema } from '../schemas/tenant'
import { wsEventSchema } from '../ws-events'

describe('tenant schemas', () => {
  it('slug mora biti lowercase alphanumeric sa crticama', () => {
    expect(createTenantSchema.safeParse({ name: 'Firma', slug: 'firma-123' }).success).toBe(true)
    expect(createTenantSchema.safeParse({ name: 'Firma', slug: 'Firma' }).success).toBe(false)
    expect(createTenantSchema.safeParse({ name: 'Firma', slug: 'firma firma' }).success).toBe(false)
    expect(createTenantSchema.safeParse({ name: 'Firma', slug: 'firma_123' }).success).toBe(false)
  })

  it('name ne sme biti prazan', () => {
    expect(createTenantSchema.safeParse({ name: '', slug: 'firma' }).success).toBe(false)
  })
})

describe('user schemas', () => {
  it('password mora imati minimum 8 karaktera', () => {
    const result = registerSchema.safeParse({
      email: 'test@test.com',
      password: 'Ab1',
      fullName: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('password mora imati veliko slovo i broj', () => {
    expect(registerSchema.safeParse({
      email: 'test@test.com',
      password: 'password1',
      fullName: 'Test',
    }).success).toBe(false)

    expect(registerSchema.safeParse({
      email: 'test@test.com',
      password: 'Password',
      fullName: 'Test',
    }).success).toBe(false)

    expect(registerSchema.safeParse({
      email: 'test@test.com',
      password: 'Password1',
      fullName: 'Test',
    }).success).toBe(true)
  })

  it('email mora biti validan', () => {
    expect(loginSchema.safeParse({ email: 'nije-email', password: 'test' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'ok@test.com', password: 'test' }).success).toBe(true)
  })
})

describe('printer schemas', () => {
  it('prihvata sve validne Bambu modele', () => {
    const modeli = ['a1', 'a1_mini', 'p1p', 'p1s', 'x1c', 'x1e', 'h2d']
    modeli.forEach(model => {
      expect(printerModelSchema.safeParse(model).success).toBe(true)
    })
  })

  it('odbija nepoznate modele', () => {
    expect(printerModelSchema.safeParse('mk4').success).toBe(false)
  })

  it('ipAddress mora biti validan', () => {
    expect(addPrinterSchema.safeParse({
      name: 'Printer 1',
      model: 'a1',
      serialNumber: 'ABC123',
      ipAddress: '192.168.1.100',
      accessCode: '12345678',
    }).success).toBe(true)

    expect(addPrinterSchema.safeParse({
      name: 'Printer 1',
      model: 'a1',
      serialNumber: 'ABC123',
      ipAddress: 'nije-ip',
      accessCode: '12345678',
    }).success).toBe(false)
  })
})

describe('job schemas', () => {
  it('mora imati bar jedan printer', () => {
    expect(createJobSchema.safeParse({
      fileId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Print',
      printerIds: [],
      copies: 1,
    }).success).toBe(false)

    expect(createJobSchema.safeParse({
      fileId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Print',
      printerIds: ['550e8400-e29b-41d4-a716-446655440001'],
      copies: 1,
    }).success).toBe(true)
  })

  it('copies max je 100', () => {
    expect(createJobSchema.safeParse({
      fileId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Print',
      printerIds: ['550e8400-e29b-41d4-a716-446655440001'],
      copies: 101,
    }).success).toBe(false)
  })
})

describe('ws event schema', () => {
  it('printer.status event prolazi validaciju', () => {
    const event = {
      type: 'printer.status',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      payload: {
        printerId: '550e8400-e29b-41d4-a716-446655440001',
        nozzleTemp: 240.5,
        nozzleTargetTemp: 240,
        bedTemp: 60,
        bedTargetTemp: 60,
        chamberTemp: null,
        printProgress: 45,
        layerCurrent: 120,
        layerTotal: 300,
        timeRemainingSecs: 3600,
        amsSlots: null,
        errorCode: null,
        gcodeState: 'RUNNING',
        updatedAt: new Date().toISOString(),
      },
    }
    expect(wsEventSchema.safeParse(event).success).toBe(true)
  })

  it('nepoznat event type failuje', () => {
    expect(wsEventSchema.safeParse({
      type: 'printer.teleport',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      payload: {},
    }).success).toBe(false)
  })
})
