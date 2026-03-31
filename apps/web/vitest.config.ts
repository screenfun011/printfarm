import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/lib/**'],
      exclude: ['src/lib/api-client.ts', 'src/lib/ws-client.ts', 'src/routeTree.gen.ts'],
      thresholds: { lines: 85, functions: 85 },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
