import { handler } from '../netlify/functions/api';

export default async function (req: any, res: any) {
  const event = {
    httpMethod: req.method || 'GET',
    path: req.url || '/',
    headers: req.headers || {},
    queryStringParameters: req.query || {},
    body: req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : null,
  };

  try {
    const result = await handler(event as any, {} as any);
    if (!result) {
      res.status(500).json({ status: 'error', message: 'No response from function handler' });
      return;
    }
    res.status(result.statusCode || 200);
    if (result.headers) {
      for (const [key, val] of Object.entries(result.headers)) {
        res.setHeader(key, val as string);
      }
    }
    res.send(result.body);
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
  }
}
