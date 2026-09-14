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

  // 1. API Route Handler (MUST BE BEFORE VITE / STATIC MIDDLEWARES, NEVER CALLS next())
  app.all(['/api', '/api/*'], async (req, res) => {
    try {
      const cleanPath = req.originalUrl.split('?')[0];
      const event: any = {
        path: cleanPath,
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: req.query,
        body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : (typeof req.body === 'string' ? req.body : null),
      };

      const response = await netlifyApiHandler(event, {} as any);
      if (response && typeof response === 'object') {
        if (response.headers) {
          for (const [key, val] of Object.entries(response.headers)) {
            res.setHeader(key, String(val));
          }
        }
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.status(response.statusCode || 200).send(response.body);
      } else {
        res.status(500).setHeader('Content-Type', 'application/json').json({ status: 'error', message: 'Invalid response from function' });
      }
    } catch (err: any) {
      console.error('[API Proxy Error]', err);
      res.status(500).setHeader('Content-Type', 'application/json').json({
        status: 'error',
        message: err.message || 'Internal Server Error'
      });
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
