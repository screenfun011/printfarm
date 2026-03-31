import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/index.ts',
        'src/env.ts',
        'src/lib/**',
        'src/ws/**',
        'src/middleware/**',
        'src/modules/**/router.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
})
