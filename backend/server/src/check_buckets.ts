import { Storage } from '@google-cloud/storage';
import path from 'path';

async function run() {
  const storage = new Storage({ keyFilename: path.resolve(__dirname, '../serviceAccountKey.json') });
  const [buckets] = await storage.getBuckets();
  console.log("Buckets:");
  buckets.forEach(b => console.log(b.name));
}
run();
