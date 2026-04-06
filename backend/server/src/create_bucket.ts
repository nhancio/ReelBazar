import { Storage } from '@google-cloud/storage';
import path from 'path';

async function run() {
  const storage = new Storage({ keyFilename: path.resolve(__dirname, '../serviceAccountKey.json') });
  try {
    const [bucket] = await storage.createBucket('reelbaazar.appspot.com', {
      location: 'US',
    });
    console.log(`Bucket ${bucket.name} created.`);
  } catch (e) {
    console.error(e);
  }
}
run();
