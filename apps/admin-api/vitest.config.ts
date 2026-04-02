import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/modules/**/*.ts'],
      exclude: ['src/modules/**/*.test.ts', 'src/modules/**/router.ts', 'src/modules/**/schema.ts', 'src/modules/**/types.ts'],
      thresholds: { lines: 85, functions: 85 },
    },
  },
})
