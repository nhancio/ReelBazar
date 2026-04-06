import express from 'express';
import cors from 'cors';
import { initFirebaseAdmin } from './utils/firebase';
import { authRouter } from './routes/auth';
import { reelsRouter } from './routes/reels';
import { usersRouter } from './routes/users';
import { collaborationsRouter } from './routes/collaborations';
import { uploadRouter } from './routes/upload';

initFirebaseAdmin();

const app = express();

app.use(cors());
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
