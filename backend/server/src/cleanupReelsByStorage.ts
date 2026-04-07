import { initFirebaseAdmin, db, storage } from './utils/firebase';

initFirebaseAdmin();

function getBasenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    if (!path) return null;
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function listBucketBasenames(): Promise<Set<string>> {
  const bucket = storage();
  const prefixes = ['videos/', 'reels/'];
  const out = new Set<string>();

  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix, autoPaginate: true });
    for (const f of files) {
      const name = f.name.split('/').filter(Boolean).pop();
      if (name) out.add(name);
    }
  }
  return out;
}

async function deleteRelated(collectionName: string, reelIds: string[], apply: boolean): Promise<number> {
  let deleted = 0;
  for (const group of chunk(reelIds, 10)) {
    const snap = await db().collection(collectionName).where('reelId', 'in', group).get();
    if (snap.empty) continue;
    if (apply) {
      for (const docs of chunk(snap.docs, 450)) {
        const batch = db().batch();
        docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    deleted += snap.size;
  }
  return deleted;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY RUN (no changes)'}`);

  const keepBasenames = await listBucketBasenames();
  console.log(`Found ${keepBasenames.size} files in bucket under videos/ + reels/`);

  const reelsSnap = await db().collection('reels').get();
  const toDelete: string[] = [];
  const toKeep: string[] = [];

  reelsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as { videoUrl?: string };
    const videoUrl = data.videoUrl || '';
    const base = getBasenameFromUrl(videoUrl);
    if (base && keepBasenames.has(base)) toKeep.push(docSnap.id);
    else toDelete.push(docSnap.id);
  });

  console.log(`Reels total: ${reelsSnap.size}`);
  console.log(`Keep reels : ${toKeep.length}`);
  console.log(`Delete reels: ${toDelete.length}`);

  const likes = await deleteRelated('reelLikes', toDelete, apply);
  const saves = await deleteRelated('reelSaves', toDelete, apply);
  const views = await deleteRelated('reelViews', toDelete, apply);

  if (apply && toDelete.length > 0) {
    for (const ids of chunk(toDelete, 450)) {
      const batch = db().batch();
      ids.forEach((id) => batch.delete(db().collection('reels').doc(id)));
      await batch.commit();
    }
  }

  console.log(`reelLikes ${apply ? 'deleted' : 'would delete'}: ${likes}`);
  console.log(`reelSaves ${apply ? 'deleted' : 'would delete'}: ${saves}`);
  console.log(`reelViews ${apply ? 'deleted' : 'would delete'}: ${views}`);
  console.log(`reels ${apply ? 'deleted' : 'would delete'}: ${toDelete.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

