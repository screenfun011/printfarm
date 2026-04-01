// Jedini izvor feature flags-ova u mobile app-u
// Ne čitati process.env.EXPO_PUBLIC_DEPLOYMENT_MODE direktno

const mode = (process.env.EXPO_PUBLIC_DEPLOYMENT_MODE ?? 'cloud') as 'cloud' | 'local'

export const features = {
  multiTenant: mode === 'cloud',
  billing: mode === 'cloud',
  superAdmin: mode === 'cloud',
  cloudConnect: mode === 'local',
  licenseCheck: mode === 'local',
} as const

export type Features = typeof features
