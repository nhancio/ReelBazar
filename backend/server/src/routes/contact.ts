import { Router } from 'express';

export const contactRouter = Router();

contactRouter.post('/', (req, res) => {
  const { name, email, message } = req.body as {
    name?: string;
    email?: string;
    message?: string;
  };

  const n = typeof name === 'string' ? name.trim() : '';
  const em = typeof email === 'string' ? email.trim() : '';
  const msg = typeof message === 'string' ? message.trim() : '';

  if (!n || !em || !msg) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  if (em.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (n.length > 200 || msg.length > 8000) {
    return res.status(400).json({ error: 'Field too long.' });
  }

  console.log('[contact]', { name: n, email: em, message: msg.slice(0, 500) });

  res.status(201).json({ ok: true });
});
