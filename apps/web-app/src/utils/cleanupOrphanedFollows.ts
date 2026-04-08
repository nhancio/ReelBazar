import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';

/**
 * Removes follow records that point to non-existent user documents.
 * Run this once to clean up orphaned data from deleted accounts.
 */
export async function cleanupOrphanedFollows(): Promise<{ removed: number; checked: number }> {
  let removed = 0;
  let checked = 0;

  try {
    console.log('Starting cleanup of orphaned follow records...');
    
    // Get all follow records
    const followsSnapshot = await getDocs(collection(db, 'follows'));
    console.log(`Found ${followsSnapshot.docs.length} follow records to check`);

    // Check each follow record
    for (const followDoc of followsSnapshot.docs) {
      const { followerId, followingId } = followDoc.data();
      checked++;

      // Check if both users exist
      const [followerExists, followingExists] = await Promise.all([
        getDoc(doc(db, 'users', followerId)).then(d => d.exists()),
        getDoc(doc(db, 'users', followingId)).then(d => d.exists()),
      ]);

      if (!followerExists || !followingExists) {
        await deleteDoc(doc(db, 'follows', followDoc.id));
        removed++;
        console.log(`Removed orphaned follow: ${followerId} -> ${followingId}`);
      }
    }

    console.log(`✓ Cleanup complete: Removed ${removed} orphaned follow records from ${checked} total`);
    return { removed, checked };
  } catch (err) {
    console.error('Error during cleanup:', err);
    throw err;
  }
}
