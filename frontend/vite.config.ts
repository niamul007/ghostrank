import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Anything the frontend calls under /api is forwarded to the Express
      // backend on :4000. Lets the frontend call relative paths ("/api/...")
      // in both dev (proxied) and prod (same-origin or VITE_API_URL) without
      // branching, and sidesteps CORS entirely in dev.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
