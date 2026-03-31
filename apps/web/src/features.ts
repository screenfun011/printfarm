// Jedini izvor feature flags-ova u web app-u
// Ne čitati import.meta.env.VITE_DEPLOYMENT_MODE direktno

const mode = (import.meta.env.VITE_DEPLOYMENT_MODE ?? 'cloud') as 'cloud' | 'local'

export const features = {
  multiTenant: mode === 'cloud',
  billing: mode === 'cloud',
  superAdmin: mode === 'cloud',
  cloudConnect: mode === 'local',
  licenseCheck: mode === 'local',
} as const

export type Features = typeof features
