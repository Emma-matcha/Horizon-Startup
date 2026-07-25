import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@picovoice/rhino-web': fileURLToPath(
        new URL('./node_modules/@picovoice/rhino-web/dist/esm/index.js', import.meta.url)
      ),
      '@picovoice/web-voice-processor': fileURLToPath(
        new URL(
          './node_modules/@picovoice/web-voice-processor/dist/esm/index.js',
          import.meta.url
        )
      )
    }
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/domain/**/*.ts',
        'src/data/**/*.ts',
        'src/voice/contracts.ts',
        'src/voice/embeddedModel.ts',
        'src/voice/vosk.ts',
        'src/voice/webSpeech.ts'
      ],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.d.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
})
