import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The screening service (backend/) runs on port 8000; the browser reaches it through this proxy.
const proxy = { '/api': 'http://127.0.0.1:8000' }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
