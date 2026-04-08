/**
 * cleanupOrphanedFollows.ts
 * Removes follow records that point to non-existent user documents.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function cleanupOrphanedFollows() {
  let removed = 0;
  let checked = 0;

  try {
    console.log('Starting cleanup of orphaned follow records...');

    const followsCollection = db.collection('follows');
    const followsSnapshot = await followsCollection.get();

    console.log(`Found ${followsSnapshot.size} follow records to check`);

    for (const followDoc of followsSnapshot.docs) {
      const { followerId, followingId } = followDoc.data();
      checked++;

      // Check if both users exist
      const [followerDoc, followingDoc] = await Promise.all([
        db.collection('users').doc(followerId).get(),
        db.collection('users').doc(followingId).get(),
      ]);

      if (!followerDoc.exists || !followingDoc.exists) {
        await followDoc.ref.delete();
        removed++;
        console.log(
          `Removed orphaned follow: ${followerId} -> ${followingId} (follower exists: ${followerDoc.exists}, following exists: ${followingDoc.exists})`
        );
      }

      // Log progress every 100 records
      if (checked % 100 === 0) {
        console.log(`Progress: checked ${checked}, removed ${removed}...`);
      }
    }

    console.log(`✓ Cleanup complete: Removed ${removed} orphaned follow records from ${checked} total`);
  } catch (err) {
    console.error('Error during cleanup:', err);
    throw err;
  }
}

cleanupOrphanedFollows().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
