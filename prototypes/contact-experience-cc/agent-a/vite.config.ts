import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the built bundle works from any static folder or the preview server.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});
