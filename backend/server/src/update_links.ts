import { initFirebaseAdmin, db } from './utils/firebase';

async function updateLinks() {
  initFirebaseAdmin();

  const snapshot = await db().collection('reels').get();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.videoUrl && data.videoUrl.endsWith('.MOV')) {
      await doc.ref.update({
        videoUrl: data.videoUrl.replace('.MOV', '.mp4')
      });
      count++;
    }
  }

  console.log(`Updated ${count} video links to .mp4`);
  process.exit(0);
}

updateLinks().catch(console.error);