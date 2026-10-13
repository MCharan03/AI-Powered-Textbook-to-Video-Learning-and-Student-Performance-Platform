import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
      '/pipeline': 'http://127.0.0.1:8000',
      '/learn': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
});
