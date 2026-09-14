import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handler as netlifyApiHandler } from './netlify/functions/api';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Mount Netlify Functions handler to /api/* in dev/preview
  app.all('/api/*', async (req, res) => {
    try {
      const event: any = {
        path: req.originalUrl,
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: req.query,
        body: req.body ? JSON.stringify(req.body) : null,
      };

      const response = await netlifyApiHandler(event, {} as any);
      if (response && typeof response === 'object') {
        if (response.headers) {
          for (const [key, val] of Object.entries(response.headers)) {
            res.setHeader(key, String(val));
          }
        }
        res.status(response.statusCode || 200).send(response.body);
      } else {
        res.status(500).json({ error: 'Invalid response from function' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Netlify-Native CRM Server running on port ${PORT}`);
  });
}

startServer();
