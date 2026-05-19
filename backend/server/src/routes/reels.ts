import { Router, Request, Response } from 'express';
import { db, storage, admin } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createRateLimit } from '../middleware/rateLimit';
import { ALLOWED_VIDEO_TYPES, assertAllowedMimeType, assertFileSignature, safeObjectName } from '../utils/uploadSecurity';
import {
  ValidationError,
  normalizeDocumentId,
  normalizeOptionalUrl,
  normalizeString,
  parseIntegerQuery,
} from '../utils/validation';

const FieldValue = admin.firestore.FieldValue;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_VIDEO_TYPES.has(file.mimetype));
  },
});

export const reelsRouter = Router();
const uploadRateLimit = createRateLimit({
  keyPrefix: 'reel-upload',
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: 'Too many video upload attempts. Please try again later.',
});

interface ReelDoc {
  id: string;
  creatorId: string;
  [key: string]: any; // Firestore document fields
}

type CreatorSummary = { id: string; name: string; avatarUrl: string | null; brandName: string | null } | null;

// Helper: get user data for a reel's creator
async function getCreatorData(creatorId: string) {
  const doc = await db().collection('users').doc(creatorId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return { id: doc.id, name: data.name, avatarUrl: data.avatarUrl, brandName: data.brandName };
}

// Helper: enrich reels with creator data
async function enrichReels(reels: ReelDoc[]) {
  const creatorIds = [...new Set(reels.map((r) => r.creatorId))].filter(Boolean);
  if (creatorIds.length === 0) return reels.map(r => ({ ...r, creator: null }));

  const creatorMap: Record<string, CreatorSummary> = {};
  
  // Use getAll for batch fetching
  const userRefs = creatorIds.map(id => db().collection('users').doc(id));
  const userDocs = await db().getAll(...userRefs);
  
  userDocs.forEach(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data) {
        creatorMap[doc.id] = { 
          id: doc.id, 
          name: data.name, 
          avatarUrl: data.avatarUrl, 
          brandName: data.brandName 
        };
      } else {
        creatorMap[doc.id] = null;
      }
    } else {
      creatorMap[doc.id] = null;
    }
  });

  return reels.map((r) => ({ ...r, creator: creatorMap[r.creatorId] || null }));
}

// Get feed with cursor-based pagination
reelsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { category, cursor, limit = '10' } = req.query;
    const take = parseIntegerQuery(limit, 10, 50);

    let query: FirebaseFirestore.Query = db().collection('reels');

    if (category) {
      const safeCategory = normalizeString(category, { maxLength: 20 });
      query = query.where('category', '==', safeCategory);
    } else {
      query = query.orderBy('createdAt', 'desc');
    }

    if (cursor) {
      const cursorDoc = await db().collection('reels').doc(normalizeDocumentId(cursor, 'Cursor')).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(take + 1).get();
    let reels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ReelDoc));

    const hasMore = reels.length > take;
    if (hasMore) reels = reels.slice(0, take);

    const enriched = await enrichReels(reels);

    res.json({
      reels: enriched,
      hasMore,
      nextCursor: hasMore ? reels[reels.length - 1]?.id : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching reels feed:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Get reel by ID
reelsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await db().collection('reels').doc(normalizeDocumentId(req.params.id, 'Reel id')).get();
    if (!doc.exists) return res.status(404).json({ message: 'Reel not found' });

    const data = doc.data();
    if (!data) return res.status(404).json({ message: 'Reel data missing' });

    const reel = { id: doc.id, ...data };
    const creator = await getCreatorData(data.creatorId);

    res.json({ reel: { ...reel, creator } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching reel:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Get user's reels
reelsRouter.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { cursor, limit = '10' } = req.query;
    const take = parseIntegerQuery(limit, 10, 50);
    const userId = normalizeDocumentId(req.params.userId, 'User id');

    let query = db().collection('reels')
      .where('creatorId', '==', userId);

    if (cursor) {
      const cursorDoc = await db().collection('reels').doc(normalizeDocumentId(cursor, 'Cursor')).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(take + 1).get();
    let reels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ReelDoc));

    const hasMore = reels.length > take;
    if (hasMore) reels = reels.slice(0, take);

    const enriched = await enrichReels(reels);
    res.json({ reels: enriched, hasMore, nextCursor: hasMore ? reels[reels.length - 1]?.id : undefined });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching user reels:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Get user's saved reels
reelsRouter.get('/saved/:userId', async (req: Request, res: Response) => {
  try {
    const { cursor, limit = '10' } = req.query;
    const take = parseIntegerQuery(limit, 10, 50);
    const userId = normalizeDocumentId(req.params.userId, 'User id');

    let query = db().collection('reelSaves')
      .where('userId', '==', userId);

    if (cursor) {
      const cursorDoc = await db().collection('reelSaves').doc(normalizeDocumentId(cursor, 'Cursor')).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(take + 1).get();
    const savedData = snapshot.docs.map((doc) => doc.data());
    const reelIds = savedData.map((d) => d.reelId);

    if (reelIds.length === 0) {
      return res.json({ reels: [], hasMore: false });
    }

    // Fetch the actual reel documents in a single batch
    const uniqueReelIds = [...new Set(reelIds.slice(0, take))];
    const reelsSnapshot = await db().collection('reels').where(admin.firestore.FieldPath.documentId(), 'in', uniqueReelIds).get();
    
    const reelsMap: Record<string, ReelDoc> = {};
    reelsSnapshot.docs.forEach((doc) => {
      reelsMap[doc.id] = { id: doc.id, ...doc.data() } as ReelDoc;
    });
    
    // Map back to original order and filter out potentially deleted reels
    const orderedReels = savedData.slice(0, take)
      .map(sd => reelsMap[sd.reelId])
      .filter((r): r is ReelDoc => !!r);

    const hasMore = savedData.length > take;
    const enriched = await enrichReels(orderedReels);
    
    res.json({ 
      reels: enriched, 
      hasMore, 
      nextCursor: hasMore ? snapshot.docs[take - 1].id : undefined 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching saved reels:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Upload reel — upload video to Firebase Storage
reelsRouter.post('/upload', uploadRateLimit, authMiddleware, requireRegistered, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    const { productLink, category, caption, brandTag } = req.body;

    const safeProductLink = normalizeOptionalUrl(productLink);
    const safeCategory = normalizeString(category, { maxLength: 20 });
    const safeCaption = normalizeString(caption, { maxLength: 500, allowEmpty: true, preserveNewlines: true });
    const safeBrandTag = normalizeString(brandTag, { maxLength: 80, allowEmpty: true });

    if (!safeProductLink || !safeCategory) {
      return res.status(400).json({ message: 'productLink and category are required' });
    }

    const validCategories = ['Men', 'Women', 'Kids'];
    if (!validCategories.includes(safeCategory)) {
      return res.status(400).json({ message: 'category must be one of: Men, Women, Kids' });
    }

    assertAllowedMimeType(req.file.mimetype, ALLOWED_VIDEO_TYPES, 'video');
    assertFileSignature(req.file.buffer, req.file.mimetype, 'Video');

    const filename = safeObjectName('reels', uuidv4(), req.file.originalname);
    const bucket = storage();
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    await file.makePublic();
    const videoUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    const now = new Date().toISOString();
    const reelData = {
      videoUrl,
      thumbnailUrl: null,
      productLink: safeProductLink,
      category: safeCategory,
      caption: safeCaption,
      brandTag: safeBrandTag,
      creatorId: req.user!.id,
      likesCount: 0,
      viewsCount: 0,
      savesCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db().collection('reels').add(reelData);
    const creator = await getCreatorData(req.user!.id);

    res.status(201).json({ reel: { id: docRef.id, ...reelData, creator }, url: videoUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading reel:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Like a reel
reelsRouter.post('/:id/like', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.id, 'Reel id');
    const userId = req.user!.id;
    const likeId = `${userId}_${reelId}`;

    const likeRef = db().collection('reelLikes').doc(likeId);
    const likeDoc = await likeRef.get();

    if (likeDoc.exists) {
      await likeRef.delete();
      await db().collection('reels').doc(reelId).update({
        likesCount: FieldValue.increment(-1),
      });
      return res.json({ liked: false });
    }

    await likeRef.set({ userId, reelId, createdAt: new Date().toISOString() });
    await db().collection('reels').doc(reelId).update({
      likesCount: FieldValue.increment(1),
    });
    res.json({ liked: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Save a reel
reelsRouter.post('/:id/save', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.id, 'Reel id');
    const userId = req.user!.id;
    const saveId = `${userId}_${reelId}`;

    const saveRef = db().collection('reelSaves').doc(saveId);
    const saveDoc = await saveRef.get();

    if (saveDoc.exists) {
      await saveRef.delete();
      await db().collection('reels').doc(reelId).update({
        savesCount: FieldValue.increment(-1),
      });
      return res.json({ saved: false });
    }

    await saveRef.set({ userId, reelId, createdAt: new Date().toISOString() });
    await db().collection('reels').doc(reelId).update({
      savesCount: FieldValue.increment(1),
    });
    res.json({ saved: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Record view
reelsRouter.post('/:id/view', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.id, 'Reel id');
    const userId = req.user!.id;
    const viewId = `${userId}_${reelId}`;

    const viewRef = db().collection('reelViews').doc(viewId);
    const viewDoc = await viewRef.get();

    if (!viewDoc.exists) {
      await viewRef.set({ userId, reelId, viewedAt: new Date().toISOString() });
      await db().collection('reels').doc(reelId).update({
        viewsCount: FieldValue.increment(1),
      });
    }

    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Delete reel
reelsRouter.delete('/:id', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.id, 'Reel id');
    const doc = await db().collection('reels').doc(reelId).get();
    if (!doc.exists) return res.status(404).json({ message: 'Reel not found' });

    const reel = doc.data();
    if (!reel) return res.status(404).json({ message: 'Reel data missing' });
    if (reel.creatorId !== req.user!.id) return res.status(403).json({ message: 'Not authorized' });

    // Delete video from Storage if it's in our bucket
    if (reel.videoUrl?.includes('storage.googleapis.com')) {
      const path = reel.videoUrl.split(`${storage().name}/`)[1];
      if (path) {
        await storage().file(path).delete().catch((err: unknown) => {
          console.error('Failed to delete video from storage:', err);
        });
      }
    }

    await db().collection('reels').doc(reelId).delete();
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting reel:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});
