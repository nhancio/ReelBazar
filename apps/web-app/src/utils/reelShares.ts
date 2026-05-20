import {
  doc,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';

export async function recordReelShare(reelId: string, userId: string): Promise<boolean> {
  const reelRef = doc(db, 'reels', reelId);
  const shareRef = doc(db, 'reelShares', `${userId}_${reelId}`);
  const now = new Date().toISOString();

  return runTransaction(db, async (transaction) => {
    const shareDoc = await transaction.get(shareRef);
    if (shareDoc.exists()) {
      return false;
    }

    transaction.set(shareRef, {
      userId,
      reelId,
      createdAt: now,
      lastSharedAt: now,
    });
    transaction.update(reelRef, {
      sharesCount: increment(1),
      updatedAt: now,
    });

    return true;
  });
}
