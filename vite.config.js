import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Site 100 % local : les JSON de public/data et les médias de public/assets
// sont servis tels quels, sans appel réseau externe.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: '127.0.0.1', strictPort: true },
  preview: { port: 4173, host: '127.0.0.1', strictPort: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1600 },
})
