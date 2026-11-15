import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Stamps dist/sw.js with a per-build id (hash of the emitted file names) and
 * the list of hashed JS/CSS files, so each deploy gets a fresh cache name and
 * old caches are pruned on activate.
 */
function swVersion(): Plugin {
  let outDir = 'dist';
  let assets: string[] = [];
  return {
    name: 'fyb-sw-version',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && /\.(js|css)$/.test(f))
        .sort()
        .map((f) => `/${f}`);
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const buildId = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12);
      const src = readFileSync(swPath, 'utf8');
      const out = src
        .replace("'__FYB_BUILD_ID__'", JSON.stringify(buildId))
        .replace('/*__FYB_BUILD_ASSETS__*/[]', JSON.stringify(assets));
      if (out === src) throw new Error('fyb-sw-version: placeholders not found in sw.js');
      writeFileSync(swPath, out);
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersion()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    target: 'es2015',
    cssTarget: 'chrome61',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'maps': ['@vis.gl/react-google-maps', '@googlemaps/markerclusterer'],
          'supabase': ['@supabase/supabase-js'],
          'icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
