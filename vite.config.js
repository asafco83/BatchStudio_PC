import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const saveConfigPlugin = {
  name: 'save-config',
  configureServer(server) {
    server.middlewares.use('/api/compliance-files', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const dir = path.resolve('public/compliance');
        const files = fs.existsSync(dir)
          ? fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(f))
          : [];
        res.end(JSON.stringify(files));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify([]));
      }
    });

    server.middlewares.use('/api/safezone-files', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const dir = path.resolve('public/safezones');
        const files = fs.existsSync(dir)
          ? fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(f))
          : [];
        res.end(JSON.stringify(files));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify([]));
      }
    });

    server.middlewares.use('/api/save-config', (req, res) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'GET') {
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const formatted = JSON.stringify(parsed, null, 2);
            const configPath = path.resolve('public/config.json');
            fs.writeFileSync(configPath, formatted, 'utf-8');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    });
  }
};

export default defineConfig({
  base: './',
  plugins: [react(), saveConfigPlugin],
  server: {
    host: 'localhost',
    strictPort: true,
  },
  test: {
    globals: false,
    environment: 'node',
  },
});
