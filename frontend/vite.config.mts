import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  process.env = {
    ...process.env,
    ...loadEnv(mode, '../secret'),
  };

  return {
    base: process.env.VITE_APP_BASE_PATH,
    optimizeDeps: {
      exclude: [
        'workbox-window',
        'workbox-cacheable-response',
        'workbox-expiration',
        'workbox-precaching',
        'workbox-routing',
        'workbox-strategies'
      ]
    },
    plugins: [
      // ValidateEnv({
      //   VITE_BACKEND_URL: Schema.string(),
      //   VITE_APP_BASE_PATH: Schema.string(),
      // }),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        injectRegister: false,
        srcDir: 'src',
        filename: 'service-worker.ts',
        injectManifest: {
          maximumFileSizeToCacheInBytes: 3000000
        },
        manifest: {
          short_name: 'Ligla chat',
          name: 'Ligla chat',
          icons: [
            {
              src: 'icons/icon-48x48.png',
              sizes: '48x48',
              type: 'image/png',
            },
            {
              src: 'icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png',
            },
            {
              src: 'icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png',
            },
            {
              src: 'icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png',
            },
            {
              src: 'icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
            },
            {
              src: 'icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png',
            },
            {
              src: 'icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-256x256.png',
              sizes: '256x256',
              type: 'image/png',
            },
            {
              src: 'icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
          start_url: process.env.VITE_APP_BASE_PATH,
          display: 'standalone',
          theme_color: '#000000',
          background_color: '#ffffff',
        },
        devOptions: {
          enabled: process.env.NODE_ENV === 'development',
          type: 'module',
        },
      }),
      svgr(),
    ],
    server: {
      port: Number(process.env.FRONT_PORT) || 8001,
      host: true,
    },
    resolve: {
      alias: {
        '~': path.join(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'build',
    },
  };
});
