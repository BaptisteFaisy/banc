import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Site public de Banc (statique).
 *
 * `npm run site:build` est lancé depuis la racine du dépôt : la racine Vite est
 * donc figée ici (le dossier du fichier de configuration), pas sur le cwd.
 *
 * Public sur GitHub Pages du dépôt `BaptisteFaisy/banc` → base `/banc/`,
 * artefact `site/dist` (voir `.github/workflows/site.yml`).
 *
 * §21 : `permissions.external.images: []` — aucune ressource distante. Tout est
 * en ligne ou dans `site/public/`.
 */
const racine = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: racine,
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
