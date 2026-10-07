import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /api/* se redirige al backend local (monitoring-api en :4000).
// En producción, nginx hace el proxy interno hacia monitoring-api:4000.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
