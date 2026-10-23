import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './app';

const region = process.env.RAVA_FIREBASE_FUNCTION_REGION || 'us-central1';
const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');
const razorpayWebhookSecret = defineSecret('RAZORPAY_WEBHOOK_SECRET');

export const api = onRequest(
  {
    region,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 20,
    invoker: 'public',
    secrets: [razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret],
  },
  app
);
