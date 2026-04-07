import { admin, db, initFirebaseAdmin } from './utils/firebase';

initFirebaseAdmin();

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function listAuthUids(): Promise<Set<string>> {
  const uids = new Set<string>();
  let pageToken: string | undefined = undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    page.users.forEach((u) => uids.add(u.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return uids;
}

async function deleteByFieldIn(
  collectionName: string,
  field: string,
  ids: string[],
  apply: boolean
): Promise<number> {
  let affected = 0;
  for (const group of chunk(ids, 10)) {
    const snap = await db().collection(collectionName).where(field, 'in', group).get();
    if (snap.empty) continue;
    if (apply) {
      for (const docs of chunk(snap.docs, 450)) {
        const batch = db().batch();
        docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    affected += snap.size;
  }
  return affected;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allowZeroAuth = process.argv.includes('--allow-zero-auth');
  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY RUN (no changes)'}`);

  const authUids = await listAuthUids();
  console.log(`Auth users found: ${authUids.size}`);
  if (authUids.size === 0 && !allowZeroAuth) {
    throw new Error(
      'Safety stop: Firebase Auth returned 0 users. Refusing to continue. ' +
        'Check FIREBASE_PROJECT_ID / service account. If intentional, pass --allow-zero-auth.'
    );
  }

  const usersSnap = await db().collection('users').get();
  const usersToDelete: string[] = [];

  usersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as { firebaseUid?: string | null };
    const firebaseUid = (data.firebaseUid || '').trim();
    if (!firebaseUid || !authUids.has(firebaseUid)) usersToDelete.push(docSnap.id);
  });

  const usersToKeep = usersSnap.size - usersToDelete.length;
  console.log(`Firestore users total: ${usersSnap.size}`);
  console.log(`Keep users        : ${usersToKeep}`);
  console.log(`Delete users      : ${usersToDelete.length}`);

  if (usersToDelete.length === 0) {
    console.log('No dangling users found.');
    return;
  }

  const followsFollower = await deleteByFieldIn('follows', 'followerId', usersToDelete, apply);
  const followsFollowing = await deleteByFieldIn('follows', 'followingId', usersToDelete, apply);
  const likes = await deleteByFieldIn('reelLikes', 'userId', usersToDelete, apply);
  const saves = await deleteByFieldIn('reelSaves', 'userId', usersToDelete, apply);
  const views = await deleteByFieldIn('reelViews', 'userId', usersToDelete, apply);
  const collabBrand = await deleteByFieldIn('collaborations', 'brandId', usersToDelete, apply);
  const collabInfluencer = await deleteByFieldIn('collaborations', 'influencerId', usersToDelete, apply);

  if (apply) {
    for (const ids of chunk(usersToDelete, 450)) {
      const batch = db().batch();
      ids.forEach((id) => batch.delete(db().collection('users').doc(id)));
      await batch.commit();
    }
  }

  console.log(`follows (followerId) ${apply ? 'deleted' : 'would delete'}: ${followsFollower}`);
  console.log(`follows (followingId) ${apply ? 'deleted' : 'would delete'}: ${followsFollowing}`);
  console.log(`reelLikes ${apply ? 'deleted' : 'would delete'}: ${likes}`);
  console.log(`reelSaves ${apply ? 'deleted' : 'would delete'}: ${saves}`);
  console.log(`reelViews ${apply ? 'deleted' : 'would delete'}: ${views}`);
  console.log(`collaborations (brandId) ${apply ? 'deleted' : 'would delete'}: ${collabBrand}`);
  console.log(`collaborations (influencerId) ${apply ? 'deleted' : 'would delete'}: ${collabInfluencer}`);
  console.log(`users ${apply ? 'deleted' : 'would delete'}: ${usersToDelete.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

