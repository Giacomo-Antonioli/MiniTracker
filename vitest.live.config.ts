import { defineConfig } from 'vitest/config'

// Separate config: live tests hit the network and only run on demand / on schedule.
export default defineConfig({
  test: { include: ['tools/**/*.live.test.ts'], testTimeout: 120_000, hookTimeout: 120_000 },
})
