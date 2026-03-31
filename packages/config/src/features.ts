import { env } from './env'
import type { Env } from './env'

export const isCloud = () => env.DEPLOYMENT_MODE === 'cloud'
export const isLocal = () => env.DEPLOYMENT_MODE === 'local'

function isLocalEnv(e: Env): e is Extract<Env, { DEPLOYMENT_MODE: 'local' }> {
  return e.DEPLOYMENT_MODE === 'local'
}

export const features = {
  multiTenant: isCloud(),
  billing: isCloud(),
  superAdmin: isCloud(),
  rls: isCloud(),
  cloudConnect: isLocalEnv(env) && env.CLOUD_CONNECT_ENABLED,
  licenseCheck: isLocal(),
} as const

export type Features = typeof features
export type FeatureKey = keyof Features
