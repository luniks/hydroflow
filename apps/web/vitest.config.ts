import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.spec.ts'],
      coverage: {
        provider: 'v8',
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/test/**',
          'src/**/*.spec.ts',
          'src/main.ts',
          'src/env.d.ts',
          'src/domain/types.ts',
        ],
        thresholds: {
          lines: 75,
          functions: 75,
          branches: 70,
          statements: 75,
          'src/domain/**': {
            lines: 100,
            functions: 100,
            branches: 100,
            statements: 100,
          },
        },
      },
    },
  }),
)
