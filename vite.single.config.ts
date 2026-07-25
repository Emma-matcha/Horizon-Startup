import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile({ removeViteModuleLoader: true }),
  ],
  publicDir: false,
  define: {
    'import.meta.env.VITE_VOSK_MODEL_PATH': JSON.stringify('embedded:vosk'),
  },
  resolve: {
    alias: {
      '@picovoice/rhino-web': fileURLToPath(
        new URL('./node_modules/@picovoice/rhino-web/dist/esm/index.js', import.meta.url),
      ),
      '@picovoice/web-voice-processor': fileURLToPath(
        new URL(
          './node_modules/@picovoice/web-voice-processor/dist/esm/index.js',
          import.meta.url,
        ),
      ),
    },
  },
  build: {
    outDir: '.single-html-build',
    emptyOutDir: true,
  },
})
