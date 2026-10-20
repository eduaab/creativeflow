import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5173, host: true, proxy: { '/api': 'http://localhost:3001' } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
