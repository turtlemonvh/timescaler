import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  BACKGROUND_COLOR,
  THEME_COLOR,
} from './app.config.js';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
      workbox: {
        // Default globPatterns is js/css/html/ico/png/svg only — misses the
        // vendored woff2 fonts, which would then need a network request on
        // first load after any cache eviction, contradicting the "no
        // network font requests" offline requirement.
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2,glb,webm,mp4}'],
        // drei's loaders reference draco/basis decoders that this app never
        // loads (models are meshopt-compressed); keep them out of the offline cache.
        globIgnores: ['**/draco_*', '**/basis_*'],
        // The six animal models are ~650 KB each; workbox's default 2 MiB
        // per-file cap would otherwise drop a future larger one silently.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
        description: APP_DESCRIPTION,
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: false,
    env: {
      TZ: 'America/New_York',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp,claude}/**',
    ],
  },
});
