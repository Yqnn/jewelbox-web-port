import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/jewelbox-web-port/',
  build: {
    outDir: 'docs',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Jewelbox',
        short_name: 'Jewelbox',
        description: 'Jewelbox - Classic Mac-style Jewelbox',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-256x256.png',
            sizes: '256x256',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ico,webmanifest,wav}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
