import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  test: {
    include: ['tests/core/**/*.test.ts'],
    environment: 'node',
  },
});
