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
      'https://app.rava.one',
      'https://rava.one',
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
if (process.env.NODE_ENV !== 'production') {
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

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/reels', reelsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/collaborations', collaborationsRouter);
apiRouter.use('/upload', uploadRouter);
apiRouter.use('/contact', contactRouter);

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
