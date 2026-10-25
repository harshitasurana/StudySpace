import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    sourcemap: false,
  },

  server: {
    host: '0.0.0.0',
    port: 5190,
    strictPort: true,
    allowedHosts: true,
    sourcemapIgnoreList: () => false
  },

  optimizeDeps: {
    esbuildOptions: { sourcemap: false },
  },
})