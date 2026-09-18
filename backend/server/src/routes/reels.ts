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
import { SAMPLE_PRODUCT } from './products';

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
  productId?: string;
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

// Helper: get product data for a reel's tagged product
async function getProductData(productId?: string) {
  if (!productId) return null;
  if (productId === SAMPLE_PRODUCT.id) return SAMPLE_PRODUCT;
  try {
    const doc = await db().collection('products').doc(productId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
  } catch {
    /* continue */
  }
  return null;
}

// Helper: enrich reels with creator data and product data
async function enrichReels(reels: ReelDoc[]) {
  const creatorIds = [...new Set(reels.map((r) => r.creatorId))].filter(Boolean);
  const productIds = [...new Set(reels.map((r) => r.productId))].filter(Boolean) as string[];

  const creatorMap: Record<string, CreatorSummary> = {};
  const productMap: Record<string, any> = {};

  if (creatorIds.length > 0) {
    const userRefs = creatorIds.map((id) => db().collection('users').doc(id));
    const userDocs = await db().getAll(...userRefs);

    userDocs.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          creatorMap[doc.id] = {
            id: doc.id,
            name: data.name,
            avatarUrl: data.avatarUrl,
            brandName: data.brandName,
          };
        } else {
          creatorMap[doc.id] = null;
        }
      } else {
        creatorMap[doc.id] = null;
      }
    });
  }

  if (productIds.length > 0) {
    const validFirestoreProductIds = productIds.filter((id) => id !== SAMPLE_PRODUCT.id);
    if (validFirestoreProductIds.length > 0) {
      const productRefs = validFirestoreProductIds.map((id) => db().collection('products').doc(id));
      const productDocs = await db().getAll(...productRefs);
      productDocs.forEach((doc) => {
        if (doc.exists) {
          productMap[doc.id] = { id: doc.id, ...doc.data() };
        }
      });
    }
    if (productIds.includes(SAMPLE_PRODUCT.id)) {
      productMap[SAMPLE_PRODUCT.id] = SAMPLE_PRODUCT;
    }
  }

  return reels.map((r) => {
    const creator = creatorMap[r.creatorId] || null;
    const product = r.productId ? (productMap[r.productId] || null) : null;
    return {
      ...r,
      creator,
      product,
      commissionRate: r.commissionRate ?? (product?.commissionRate || 10),
      ordersCount: r.ordersCount || 0,
      productLink: r.productLink || product?.productLink || '',
    };
  });
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
    }
    query = query.orderBy('createdAt', 'desc');

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

const SEARCH_WINDOW = 300;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'any', 'are', 'as', 'can', 'find', 'for', 'get', 'give', 'has', 'have',
  'how', 'i', 'in', 'is', 'it', 'like', 'looking', 'me', 'my', 'need', 'of', 'on', 'or',
  'please', 'reel', 'reels', 'show', 'some', 'something', 'that', 'the', 'to', 'want', 'was',
  'what', 'which', 'with', 'you',
]);

function queryTerms(raw: string): string[] {
  return [
    ...new Set(
      raw
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    ),
  ];
}

function scoreReel(
  reel: Record<string, unknown>,
  creator: Record<string, unknown> | null,
  product: Record<string, unknown> | null,
  terms: string[]
): number {
  const fields: Array<[string, number]> = [
    [String(reel.category ?? ''), 5],
    [String(reel.brandTag ?? ''), 4],
    [String(product?.name ?? ''), 4],
    [String(product?.brandName ?? ''), 4],
    [String(reel.caption ?? ''), 3],
    [String(creator?.username ?? ''), 2],
    [String(creator?.name ?? ''), 2],
    [String(creator?.brandName ?? ''), 2],
  ];

  let score = 0;
  for (const [value, weight] of fields) {
    if (!value) continue;
    const haystack = value.toLowerCase();
    for (const term of terms) {
      if (haystack === term) score += weight * 2;
      else if (haystack.includes(term)) score += weight;
    }
  }

  const engagement = Number(reel.likesCount ?? 0) + Number(reel.savesCount ?? 0) + Number(reel.ordersCount ?? 0) * 2;
  return score > 0 ? score + Math.min(engagement / 100, 1.5) : 0;
}

reelsRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const q = normalizeString(req.query.q, { maxLength: 200 });
    if (!q) return res.status(400).json({ message: 'A search query is required' });
    const limitParam = parseIntegerQuery(req.query.limit, 20, 50);
    const terms = queryTerms(q);

    if (!terms.length) {
      return res.json({ reels: [], query: q, terms, matched: 0 });
    }

    const snapshot = await db()
      .collection('reels')
      .orderBy('createdAt', 'desc')
      .limit(SEARCH_WINDOW)
      .get();

    const rawReels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ReelDoc));
    const enriched = await enrichReels(rawReels);

    const scored = enriched
      .map((reel) => ({
        reel,
        score: scoreReel(reel, reel.creator, reel.product, terms),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    res.json({
      reels: scored.slice(0, limitParam).map((entry) => entry.reel),
      query: q,
      terms,
      matched: scored.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error searching reels:', message);
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

    const rawReel = { id: doc.id, ...data } as ReelDoc;
    const [enriched] = await enrichReels([rawReel]);

    res.json({ reel: enriched });
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

    let query = db().collection('reels').where('creatorId', '==', userId);

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

    let query = db().collection('reelSaves').where('userId', '==', userId);

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

    const uniqueReelIds = [...new Set(reelIds.slice(0, take))];
    const reelsSnapshot = await db().collection('reels').where(admin.firestore.FieldPath.documentId(), 'in', uniqueReelIds).get();

    const reelsMap: Record<string, ReelDoc> = {};
    reelsSnapshot.docs.forEach((doc) => {
      reelsMap[doc.id] = { id: doc.id, ...doc.data() } as ReelDoc;
    });

    const orderedReels = savedData
      .slice(0, take)
      .map((sd) => reelsMap[sd.reelId])
      .filter((r): r is ReelDoc => !!r);

    const hasMore = savedData.length > take;
    const enriched = await enrichReels(orderedReels);

    res.json({
      reels: enriched,
      hasMore,
      nextCursor: hasMore ? snapshot.docs[take - 1].id : undefined,
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

    const { productLink, category, caption, brandTag, brandId, productId, commissionRate } = req.body;

    const safeProductLink = normalizeOptionalUrl(productLink);
    const safeCategory = normalizeString(category, { maxLength: 20 });
    const safeCaption = normalizeString(caption, { maxLength: 500, allowEmpty: true, preserveNewlines: true });
    const safeBrandTag = normalizeString(brandTag, { maxLength: 80, allowEmpty: true });
    const safeBrandId = brandId ? normalizeDocumentId(brandId, 'Brand id') : null;
    const safeProductId = productId ? normalizeDocumentId(productId, 'Product id') : null;
    const parsedCommissionRate = commissionRate !== undefined ? Number.parseFloat(commissionRate) : null;

    if (!safeCategory) {
      return res.status(400).json({ message: 'category is required' });
    }

    if (!safeProductLink && !safeProductId) {
      return res.status(400).json({ message: 'Either productLink or productId is required' });
    }

    const validCategories = ['Men', 'Women', 'Kids', 'Accessories', 'Footwear', 'Beauty'];
    if (!validCategories.includes(safeCategory)) {
      return res.status(400).json({ message: `category must be one of: ${validCategories.join(', ')}` });
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

    // If productId is provided, get product's info if available
    let productData: any = null;
    if (safeProductId) {
      productData = await getProductData(safeProductId);
    }

    const resolvedProductLink = safeProductLink || productData?.productLink || '';
    const resolvedCommissionRate = Number.isFinite(parsedCommissionRate) ? parsedCommissionRate : (productData?.commissionRate || 10);

    const now = new Date().toISOString();
    const reelData = {
      videoUrl,
      thumbnailUrl: null,
      productLink: resolvedProductLink,
      productId: safeProductId || null,
      commissionRate: resolvedCommissionRate,
      ordersCount: 0,
      category: safeCategory,
      caption: safeCaption,
      brandTag: safeBrandTag || productData?.brandName || null,
      brandId: safeBrandId,
      creatorId: req.user!.id,
      likesCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      commentsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db().collection('reels').add(reelData);
    const creator = await getCreatorData(req.user!.id);

    res.status(201).json({
      reel: { id: docRef.id, ...reelData, creator, product: productData },
      url: videoUrl,
    });
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

// Record share
reelsRouter.post('/:id/share', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.id, 'Reel id');
    const userId = req.user!.id;
    const shareId = `${userId}_${reelId}`;
    const now = new Date().toISOString();

    const reelRef = db().collection('reels').doc(reelId);
    const shareRef = db().collection('reelShares').doc(shareId);

    const result = await db().runTransaction(async (transaction) => {
      const [reelDoc, shareDoc] = await Promise.all([
        transaction.get(reelRef),
        transaction.get(shareRef),
      ]);

      if (!reelDoc.exists) {
        throw new ValidationError('Reel not found');
      }

      const currentShares = Number(reelDoc.data()?.sharesCount || 0);
      if (shareDoc.exists) {
        return { counted: false, sharesCount: currentShares };
      }

      transaction.set(shareRef, { userId, reelId, createdAt: now, lastSharedAt: now });
      transaction.update(reelRef, {
        sharesCount: FieldValue.increment(1),
        updatedAt: now,
      });

      return { counted: true, sharesCount: currentShares + 1 };
    });

    res.json(result);
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

// Record product-link click (drives creator payouts — ₹5/click)
const clickRateLimit = createRateLimit({
  keyPrefix: 'reel-click',
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many clicks. Please slow down.',
});

reelsRouter.post('/:id/click', clickRateLimit, async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.id, 'Reel id');
    const reelRef = db().collection('reels').doc(reelId);
    const reelDoc = await reelRef.get();
    if (!reelDoc.exists) return res.status(404).json({ message: 'Reel not found' });

    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const { verifyFirebaseToken } = await import('../utils/firebase');
      const decoded = await verifyFirebaseToken(authHeader.split(' ')[1]);
      userId = decoded?.uid ?? null;
    }

    await db().collection('reelClicks').add({
      reelId,
      creatorId: reelDoc.data()!.creatorId,
      userId,
      createdAt: new Date().toISOString(),
    });
    await reelRef.update({ clicksCount: FieldValue.increment(1) });

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
