import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// base matches the GitHub Pages path: https://<user>.github.io/MiniTracker/
export default defineConfig({
  base: '/MiniTracker/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MiniTracker',
        short_name: 'MiniTracker',
        description: 'Track your miniature backlog and build armies from what you own',
        theme_color: '#1f1b24',
        background_color: '#1f1b24',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  test: {
    environment: 'node',
    coverage: {
      include: ['src/domain/**', 'src/data/**'],
      exclude: ['**/*.test.ts', '**/types.ts'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
} as any)
