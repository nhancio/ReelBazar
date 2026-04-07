/**
 * Vercel serverless entry — all HTTP traffic is rewritten here (see vercel.json).
 * Local dev still uses src/index.ts + app.listen().
 */
import serverless from 'serverless-http';
import app from '../src/app';

export default serverless(app);
