import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules',
        'tests',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'src/lib/types.ts', // Type definitions only, erased at runtime
        'src/lib/server/**', // Server-only, not run in jsdom
        'src/lib/eas.ts', // EAS SDK usage, requires heavy ethers/EAS mocking
        'src/lib/attestation-queries.ts', // Placeholder / not-yet-implemented EAS query paths
      ],
      // Generate coverage even when tests fail
      all: true,
      // Force coverage collection
      enabled: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}) 