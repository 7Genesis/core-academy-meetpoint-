import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        generatedCode: 'es2015',
        compact: true,
      },
    },
  },
  esbuild: {
    legalComments: 'none',
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy':
        'camera=(), microphone=(), geolocation=(self), payment=(self), usb=()',
    },
  },
});
