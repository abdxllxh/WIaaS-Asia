import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the FastAPI backend during development
      '/analytics': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Keep neural speech available in the Vite development build too.
      // Without this, chat works on :5173 but every TTS request returns 404.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Use stable filenames with no content hash — prevents cache-mismatch 404s
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
