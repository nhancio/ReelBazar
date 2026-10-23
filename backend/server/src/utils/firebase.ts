import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file in the current working directory
dotenv.config();

export function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  const privateKey = process.env.RAVA_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.RAVA_FIREBASE_CLIENT_EMAIL;
  const projectId =
    process.env.RAVA_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'demo-reelbazaar';
  const storageBucket = process.env.RAVA_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  const serviceAccountJson = process.env.RAVA_FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.RAVA_FIREBASE_SERVICE_ACCOUNT_KEY;
  const resolvedPath = serviceAccountPath ? path.resolve(process.cwd(), serviceAccountPath) : null;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.RAVA_FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
    });
  } else if (privateKey && clientEmail) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  } else if (resolvedPath && fs.existsSync(resolvedPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.RAVA_FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
    });
  } else {
    console.warn('Firebase Admin: No service account configured. Using application default credentials.');
    admin.initializeApp({
      projectId,
      storageBucket,
    });
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export const db = () => admin.firestore();
export const storage = () => admin.storage().bucket();
export { admin };
