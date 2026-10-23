import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { initFirebaseAdmin } from './utils/firebase';
import { authRouter } from './routes/auth';
import { reelsRouter } from './routes/reels';
import { usersRouter } from './routes/users';
import { collaborationsRouter } from './routes/collaborations';
import { uploadRouter } from './routes/upload';
import { contactRouter } from './routes/contact';
import { streaksRouter } from './routes/streaks';
import { commentsRouter } from './routes/comments';
import { productsRouter } from './routes/products';
import { ordersRouter, razorpayWebhookHandler } from './routes/orders';
import { payoutsRouter } from './routes/payouts';
import { moderationRouter } from './routes/moderation';
import { isProductionRuntime } from './orderLogic';

initFirebaseAdmin();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ??
    [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
      'http://localhost:5173',
      'https://reelbaazar.web.app',
      'https://reelbaazar.firebaseapp.com',
      'https://reelbaazar-landing.web.app',
      'https://reelbaazar-landing.firebaseapp.com',
      'https://app.rava.one',
      'https://rava.one',
      'https://www.rava.one',
    ].join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

function resolveMonorepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, 'package.json');
    try {
      if (fs.existsSync(pkg)) {
        const j = JSON.parse(fs.readFileSync(pkg, 'utf8')) as { name?: string };
        if (j.name === 'reelbazaar') return dir;
      }
    } catch {
      /* continue */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '../../..');
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/** Dev-only: append Cursor debug NDJSON (web app proxies /api here). */
if (!isProductionRuntime(process.env)) {
  app.post(
    '/api/__debug/ingest',
    express.raw({ type: 'application/json', limit: '512kb' }),
    (req, res) => {
      try {
        const root = resolveMonorepoRoot();
        const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8').trim() : '';
        if (body) {
          const primary = path.join(root, '.cursor', 'debug-eff5be.log');
          const mirror = path.join(root, 'apps', 'web-app', 'debug-eff5be.ndjson');
          for (const logFile of [primary, mirror]) {
            fs.mkdirSync(path.dirname(logFile), { recursive: true });
            fs.appendFileSync(logFile, `${body}\n`, 'utf8');
          }
          console.error('[__debug/ingest] wrote', primary, body.slice(0, 100));
        }
      } catch (e) {
        console.error('[__debug/ingest]', e);
      }
      res.status(204).end();
    }
  );
}

// Razorpay webhook needs the raw payload for signature verification, so it is
// mounted before the JSON body parser.
const razorpayWebhookRaw = express.raw({ type: 'application/json', limit: '512kb' });
app.post('/api/orders/webhook/razorpay', razorpayWebhookRaw, razorpayWebhookHandler);
app.post('/api/v1/orders/webhook/razorpay', razorpayWebhookRaw, razorpayWebhookHandler);
app.post('/api/orders/webhook', razorpayWebhookRaw, razorpayWebhookHandler);
app.post('/api/v1/orders/webhook', razorpayWebhookRaw, razorpayWebhookHandler);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Rava Creator Commerce API',
    version: '1.0.0',
    description: 'Creator Video Commerce, Reels, Collaborations, and Product Orders API',
  },
  servers: [{ url: '/', description: 'Rava API Server' }],
  tags: [
    { name: 'Health', description: 'API Health Check' },
    { name: 'Auth', description: 'Authentication and user accounts' },
    { name: 'Reels', description: 'Video reels and engagement' },
    { name: 'Products', description: 'Creator store products' },
    { name: 'Orders', description: 'Order placement and webhooks' },
    { name: 'Collaborations', description: 'Brand and creator collabs' },
    { name: 'Upload', description: 'Media asset uploads' },
    { name: 'Payouts', description: 'Creator payout processing' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Service Health Check',
        responses: { 200: { description: 'Status OK' } },
      },
    },
    '/api/reels': {
      get: {
        tags: ['Reels'],
        summary: 'List Video Reels',
        responses: { 200: { description: 'Reels list' } },
      },
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List Store Products',
        responses: { 200: { description: 'Products array' } },
      },
    },
    '/api/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List Customer Orders',
        responses: { 200: { description: 'Orders list' } },
      },
    },
    '/api/collaborations': {
      get: {
        tags: ['Collaborations'],
        summary: 'List Creator Collaborations',
        responses: { 200: { description: 'Collabs list' } },
      },
    },
  },
};

const swaggerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Rava Creator Commerce API - Swagger UI</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
<style>body { margin: 0; padding: 0; }</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.ui = SwaggerUIBundle({
  url: '/openapi.json',
  dom_id: '#swagger-ui',
  layout: 'BaseLayout',
  deepLinking: true,
  showExtensions: true,
  showCommonExtensions: true,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset]
});
</script>
</body>
</html>`;

app.get('/openapi.json', (_req, res) => res.json(openapiSpec));
app.get(['/api/docs', '/api/docs/'], (_req, res) => res.send(swaggerHtml));

const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/reels', reelsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/collaborations', collaborationsRouter);
apiRouter.use('/upload', uploadRouter);
apiRouter.use('/contact', contactRouter);
apiRouter.use('/streaks', streaksRouter);
apiRouter.use('/comments', commentsRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/payouts', payoutsRouter);
apiRouter.use('/moderation', moderationRouter);

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ message: err.message });
  }

  console.error('Unhandled application error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
