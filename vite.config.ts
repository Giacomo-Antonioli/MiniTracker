import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// Tauri (#168) sets TAURI_ENV_PLATFORM while building the desktop/Android app: served from its own root, no service worker.
const tauri = !!process.env.TAURI_ENV_PLATFORM

// base matches the GitHub Pages path: https://<user>.github.io/MiniTracker/
export default defineConfig({
  base: tauri ? '/' : '/MiniTracker/',
  // Tauri's dev window expects a fixed port.
  server: tauri ? { port: 5173, strictPort: true } : undefined,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    !tauri && VitePWA({
      registerType: 'autoUpdate',
      // The scheme library chunk is ~2 MB; keep it in the offline cache (default limit is 2 MiB).
      // The 3D dice (#191) need their physics (wasm) and theme files offline too.
      workbox: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, globPatterns: ['**/*.{js,css,html,svg,png,jpg,json,wasm,webmanifest}'] },
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
    // UI tests render real screens in jsdom; give them room when the whole suite runs in parallel.
    testTimeout: 15_000,
    coverage: {
      include: ['src/domain/**', 'src/data/**'],
      exclude: ['**/*.test.ts', '**/types.ts', '**/fixtures/**', 'src/data/catalogue/convert.ts', 'src/data/catalogue/parse.worker.ts', 'src/data/photos/compress.ts', 'src/data/syncChannel.ts'] /* browser-only glue: covered by e2e/catalogue.spec.ts, e2e/photos.spec.ts and (sync, #161) e2e/sync.spec.ts with the sync screen */,
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
} as any)
