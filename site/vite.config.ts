import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Public site for the Banc test bench (GitHub Pages: BaptisteFaisy/banc).
// Static build only: no remote assets, everything served from the bundle.
export default defineConfig({
  base: '/banc/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5178,
  },
});
