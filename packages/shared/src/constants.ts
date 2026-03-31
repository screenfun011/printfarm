export const PLAN_LIMITS = {
  starter: { maxPrinters: 3 },
  pro: { maxPrinters: 10 },
  enterprise: { maxPrinters: 25 },
} as const

export const ADDON_PRINTER_PRICE_CENTS = 1200

export const TRIAL_DAYS = 14

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000
export const ADMIN_SESSION_DURATION_MS = 4 * 60 * 60 * 1000

export const MAX_FAILED_LOGIN_ATTEMPTS = 5
export const FAILED_LOGIN_LOCKOUT_MINS = 30

export const AI_CONFIDENCE_THRESHOLD = 0.75
export const CAMERA_FRAME_INTERVAL_SECS = 30

export const SOFT_DELETE_RETENTION_DAYS = 30
export const AUDIT_LOG_RETENTION_DAYS = 730
export const CAMERA_SNAPSHOT_RETENTION_DAYS = 7

export const BILLING_RETRY_INTERVALS_DAYS = [0, 3, 7] as const

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024

export const SUPPORTED_FILE_EXTENSIONS = ['.3mf', '.gcode'] as const

export const WS_PING_INTERVAL_MS = 30_000
export const WS_PONG_TIMEOUT_MS = 10_000

export const MQTT_RECONNECT_BASE_MS = 1_000
export const MQTT_RECONNECT_MAX_MS = 60_000

export const PRINTER_OFFLINE_THRESHOLD_SECS = 120
