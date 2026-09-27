import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite's dev/preview server rejects any request whose Host header isn't
  // localhost/127.0.0.1 or explicitly allowed here (DNS-rebinding
  // protection) — without this, a request arriving via Cloudflare with
  // Host: education-dev.myntiqtech.com gets blocked/misbehaves even
  // though the server itself is reachable. Leading-dot pattern covers
  // every myntiqtech.com subdomain (dev/integration/preprod/prod) in one
  // entry rather than enumerating each.
  server: {
    port: 5180,
    strictPort: true,
    allowedHosts: ['.myntiqtech.com'],
  },
  preview: {
    port: 5180,
    strictPort: true,
    allowedHosts: ['.myntiqtech.com'],
  },
})
