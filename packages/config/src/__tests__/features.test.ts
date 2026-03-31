import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('feature flags', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('cloud mode aktivira cloud feature-e', async () => {
    vi.doMock('../env', () => ({
      env: { DEPLOYMENT_MODE: 'cloud' },
    }))

    const { features, isCloud, isLocal } = await import('../features')

    expect(isCloud()).toBe(true)
    expect(isLocal()).toBe(false)
    expect(features.multiTenant).toBe(true)
    expect(features.billing).toBe(true)
    expect(features.superAdmin).toBe(true)
    expect(features.rls).toBe(true)
    expect(features.licenseCheck).toBe(false)
    expect(features.cloudConnect).toBe(false)
  })

  it('local mode aktivira local feature-e', async () => {
    vi.doMock('../env', () => ({
      env: { DEPLOYMENT_MODE: 'local', CLOUD_CONNECT_ENABLED: false },
    }))

    const { features, isCloud, isLocal } = await import('../features')

    expect(isCloud()).toBe(false)
    expect(isLocal()).toBe(true)
    expect(features.multiTenant).toBe(false)
    expect(features.billing).toBe(false)
    expect(features.superAdmin).toBe(false)
    expect(features.rls).toBe(false)
    expect(features.licenseCheck).toBe(true)
    expect(features.cloudConnect).toBe(false)
  })

  it('local + cloud connect aktivan kada je CLOUD_CONNECT_ENABLED true', async () => {
    vi.doMock('../env', () => ({
      env: { DEPLOYMENT_MODE: 'local', CLOUD_CONNECT_ENABLED: true },
    }))

    const { features } = await import('../features')
    expect(features.cloudConnect).toBe(true)
  })
})
