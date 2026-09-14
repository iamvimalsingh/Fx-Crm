import { handler } from '../netlify/functions/api';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export default async function (req: any, res: any) {
  // Handle CORS preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    res.status(200);
    for (const [key, val] of Object.entries(corsHeaders)) {
      res.setHeader(key, val);
    }
    res.end();
    return;
  }

  // 1. Extract raw path taking into account Vercel rewrites (__path query parameter, x-matched-path, x-invoke-path, originalUrl, url)
  let rawPath =
    (req.headers && (req.headers['x-matched-path'] as string)) ||
    (req.headers && (req.headers['x-invoke-path'] as string)) ||
    (req.query && req.query.__path ? `/api/${req.query.__path}` : null) ||
    req.originalUrl ||
    req.url ||
    '/';

  // Strip query string if present
  if (rawPath.includes('?')) {
    rawPath = rawPath.split('?')[0];
  }

  // 2. Strip duplicate /api prefixes safely so /api/auth/login, /api/api/auth/login, and /auth/login all route correctly
  let cleanSubPath = rawPath.replace(/^(\/api)+/, '');
  if (!cleanSubPath.startsWith('/')) {
    cleanSubPath = '/' + cleanSubPath;
  }
  const resolvedPath = '/api' + cleanSubPath;

  // Clean query object (remove internal rewrite parameter __path if present)
  const queryParams: Record<string, any> = { ...(req.query || {}) };
  delete queryParams.__path;

  // 3. Construct Netlify/Lambda compatible event
  const event = {
    httpMethod: req.method || 'GET',
    path: resolvedPath,
    headers: req.headers || {},
    queryStringParameters: queryParams,
    body: req.body
      ? typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body)
      : null,
  };

  try {
    const result = await handler(event as any, {} as any);
    if (!result) {
      res.status(500);
      for (const [key, val] of Object.entries(corsHeaders)) {
        res.setHeader(key, val);
      }
      res.setHeader('Content-Type', 'application/json');
      res.json({ status: 'error', message: 'No response from function handler' });
      return;
    }

    res.status(result.statusCode || 200);

    // Merge CORS headers and result headers (default to application/json if not explicitly set)
    const finalHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(result.headers || {}),
    };

    for (const [key, val] of Object.entries(finalHeaders)) {
      if (val !== undefined && val !== null) {
        res.setHeader(key, String(val));
      }
    }

    res.send(result.body);
  } catch (err: any) {
    res.status(500);
    for (const [key, val] of Object.entries(corsHeaders)) {
      res.setHeader(key, val);
    }
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'error', message: err.message || 'Internal Server Error' });
  }
}
