import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'safari >= 15', 'ios >= 15', 'not IE 11'],
    }),
  ],
  build: {
    target: ['es2020', 'safari15'],
  },
  server: {
    port: 3001,
  },
});
