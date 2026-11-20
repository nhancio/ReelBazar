import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './app';

const region = process.env.RAVA_FIREBASE_FUNCTION_REGION || 'us-central1';
// ponytail: RAZORPAY_KEY_ID / RAZORPAY_WEBHOOK_SECRET not in Secret Manager yet — bind only
// secrets that exist so deploy succeeds; re-add via defineSecret after secrets:set.
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');
const instagramAppId = defineSecret('INSTAGRAM_APP_ID');
const instagramAppSecret = defineSecret('INSTAGRAM_APP_SECRET');
const instagramLoginConfigId = defineSecret('INSTAGRAM_LOGIN_CONFIG_ID');
const instagramRedirectUri = defineSecret('INSTAGRAM_REDIRECT_URI');

export const api = onRequest(
  {
    region,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 20,
    invoker: 'public',
    secrets: [
      razorpayKeySecret,
      instagramAppId,
      instagramAppSecret,
      instagramLoginConfigId,
      instagramRedirectUri,
    ],
  },
  app
);
