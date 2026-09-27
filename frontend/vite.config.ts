/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    minify: 'esbuild',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 900,
    assetsInlineLimit: 4096,
    cssMinify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (id.includes('/src/pages/')) return 'page-' + id.split('/pages/')[1].split('/')[0].replace(/\.tsx$/, '');
            return;
          }
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/node_modules[\\/]@reduxjs[\\/]|node_modules[\\/]react-redux[\\/]/.test(id)) return 'redux-vendor';
          if (/node_modules[\\/]react-router(-dom)?[\\/]/.test(id)) return 'router-vendor';
          if (/node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons-vendor';
          if (/node_modules[\\/]framer-motion[\\/]/.test(id)) return 'motion-vendor';
          if (/node_modules[\\/]three[\\/]/.test(id)) return 'three-vendor';
          if (/node_modules[\\/]katex[\\/]|node_modules[\\/]react-katex[\\/]/.test(id)) return 'katex-vendor';
          if (/node_modules[\\/]highlight.js[\\/]/.test(id)) return 'highlight-vendor';
          return 'vendor';
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react', '@reduxjs/toolkit', 'react-redux']
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../tests/frontend/**/*.{test,spec}.{ts,tsx}']
  }
});
