import { Router } from 'express';
import { createRateLimit } from '../middleware/rateLimit';
import { ValidationError, normalizeOptionalEmail, normalizeString } from '../utils/validation';

export const contactRouter = Router();
const contactRateLimit = createRateLimit({
  keyPrefix: 'contact-submit',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many contact form submissions. Please try again later.',
});

contactRouter.post('/', contactRateLimit, (req, res) => {
  try {
    const { name, email, message } = req.body as {
      name?: string;
      email?: string;
      message?: string;
    };

    const n = normalizeString(name, { minLength: 2, maxLength: 200 });
    const em = normalizeOptionalEmail(email);
    const msg = normalizeString(message, { minLength: 5, maxLength: 8000, preserveNewlines: true });

    if (!n || !em || !msg) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    console.log('[contact]', { name: n, email: em, message: msg.slice(0, 500) });

    res.status(201).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      error: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});
