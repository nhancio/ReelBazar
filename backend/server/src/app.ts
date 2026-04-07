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

initFirebaseAdmin();

const app = express();

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

app.use(cors());

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

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/users', usersRouter);
app.use('/api/collaborations', collaborationsRouter);
app.use('/api/upload', uploadRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
