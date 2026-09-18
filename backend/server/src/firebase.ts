import { onRequest } from 'firebase-functions/v2/https';
import app from './app';

const region = process.env.FIREBASE_FUNCTION_REGION || 'us-central1';

export const api = onRequest(
  {
    region,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 20,
    invoker: 'public',
  },
  app
);
