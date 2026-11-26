import { resolve } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';
// @ts-expect-error: a plain module, run before Vite starts.
import { writeSimPages } from './scripts/sim-pages.mjs';

// The playground lives at /play. Vite only finds play/index.html for /play/, so /play is sent there too,
// the way vercel.json does in production.
const play: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url === '/play' || req.url?.startsWith('/play?')) req.url = req.url.replace('/play', '/play/index.html');
  // The simulation pages, at /sim and /sim/<id> as Vercel's clean URLs serve them.
  else if (req.url === '/sim' || req.url === '/sim/' || req.url?.match(/^\/sim[?#]/)) req.url = req.url.replace(/^\/sim\/?/, '/sim/index.html');
  else if (req.url?.match(/^\/sim\/[a-z0-9-]+\/?([?#].*)?$/)) req.url = req.url.replace(/^(\/sim\/[a-z0-9-]+)\/?/, '$1.html');
  next();
};
const playRoute: Plugin = {
  name: 'play-route',
  configureServer: (server) => void server.middlewares.use(play),
  configurePreviewServer: (server) => void server.middlewares.use(play),
};

// PyPI's download counts, fetched through the site's own address as vercel.json does: pypistats does not
// answer browsers on other sites. npm's are read straight from its API, which does.
const stats = {
  '/stats/pypi': { target: 'https://pypistats.org', changeOrigin: true, rewrite: () => '/api/packages/soliton-physics/overall?mirrors=false' },
};

// One page per simulation, written from the engine's catalogues before Vite looks for pages.
const simPages: Record<string, string> = await writeSimPages(import.meta.dirname);

export default defineConfig({
  plugins: [playRoute],
  server: { proxy: stats },
  preview: { proxy: stats },
  build: {
    target: 'esnext',
    // The landing page at the root, the playground at /play, and a page per simulation under /sim.
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play/index.html'),
        ...simPages,
      },
    },
  },
  optimizeDeps: { exclude: ['@soliton-physics/engine'] },
});
