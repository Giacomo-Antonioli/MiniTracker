import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// base matches the GitHub Pages path: https://<user>.github.io/MiniTracker/
export default defineConfig({
  base: '/MiniTracker/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      include: ['src/domain/**', 'src/data/**'],
      exclude: ['**/*.test.ts', '**/types.ts', '**/fixtures/**', 'src/data/catalogue/convert.ts', 'src/data/catalogue/parse.worker.ts', 'src/data/photos/compress.ts'] /* browser-only glue: covered by e2e/catalogue.spec.ts and e2e/photos.spec.ts */,
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
} as any)
