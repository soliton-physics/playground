import { resolve } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';

// The playground lives at /play. Vite only finds play/index.html for /play/, so /play is sent there too,
// the way vercel.json does in production.
const play: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url === '/play' || req.url?.startsWith('/play?')) req.url = req.url.replace('/play', '/play/index.html');
  next();
};
const playRoute: Plugin = {
  name: 'play-route',
  configureServer: (server) => void server.middlewares.use(play),
  configurePreviewServer: (server) => void server.middlewares.use(play),
};

// The download counts on the landing page, fetched through the site's own address as vercel.json does.
const stats = {
  '/stats/npm': { target: 'https://api.npmjs.org', changeOrigin: true, rewrite: () => '/downloads/point/2020-01-01:2100-01-01/@soliton-physics/engine' },
  '/stats/pypi': { target: 'https://pypistats.org', changeOrigin: true, rewrite: () => '/api/packages/soliton-physics/overall?mirrors=false' },
};

export default defineConfig({
  plugins: [playRoute],
  server: { proxy: stats },
  preview: { proxy: stats },
  build: {
    target: 'esnext',
    // Two pages: the landing page at the root, the playground at /play.
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play/index.html'),
      },
    },
  },
  optimizeDeps: { exclude: ['@soliton-physics/engine'] },
});
