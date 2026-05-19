import { Router, Request, Response } from 'express';
import { db, admin, storage } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createRateLimit } from '../middleware/rateLimit';
import { ALLOWED_IMAGE_TYPES, assertAllowedMimeType, assertFileSignature, safeObjectName } from '../utils/uploadSecurity';
import {
  ValidationError,
  normalizeDocumentId,
  normalizeString,
  normalizeStringArray,
  normalizeThemePreference,
} from '../utils/validation';

const FieldValue = admin.firestore.FieldValue;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_IMAGE_TYPES.has(file.mimetype));
  },
});

export const usersRouter = Router();
const avatarRateLimit = createRateLimit({
  keyPrefix: 'users-avatar',
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many avatar upload attempts. Please try again later.',
});

usersRouter.put('/me', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    // Basic validation
    const allowedFields = ['name', 'username', 'brandName', 'productCategories', 'interests', 'themePreference'];
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'name') updateData[field] = normalizeString(updates[field], { minLength: 2, maxLength: 80 });
        if (field === 'username') updateData[field] = normalizeString(updates[field], { minLength: 2, maxLength: 40, allowEmpty: true });
        if (field === 'brandName') updateData[field] = normalizeString(updates[field], { maxLength: 120, allowEmpty: true });
        if (field === 'productCategories') updateData[field] = normalizeStringArray(updates[field], { maxItems: 10, maxLength: 40 });
        if (field === 'interests') updateData[field] = normalizeStringArray(updates[field], { maxItems: 20, maxLength: 60 });
        if (field === 'themePreference') updateData[field] = normalizeThemePreference(updates[field]);
      }
    }

    console.log('[usersRouter.put:/me] updateProfile request', {
      userId: req.user!.id,
      updateData,
    });

    await db().collection('users').doc(req.user!.id).update(updateData);
    
    // Fetch updated user
    const doc = await db().collection('users').doc(req.user!.id).get();
    res.json({ user: { id: doc.id, ...doc.data() } });
  } catch (error: any) {
    console.error('Error updating profile:', error.message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? error.message : 'Internal server error',
    });
  }
});

usersRouter.post('/me/avatar', avatarRateLimit, authMiddleware, requireRegistered, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required' });
  }

  try {
    assertAllowedMimeType(req.file.mimetype, ALLOWED_IMAGE_TYPES, 'image');
    assertFileSignature(req.file.buffer, req.file.mimetype, 'Image');

    const bucket = storage();
    const filename = safeObjectName('avatars', `${req.user!.id}-${uuidv4()}`, req.file.originalname);
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    await file.makePublic();
    const avatarUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    await db().collection('users').doc(req.user!.id).update({
      avatarUrl
    });

    res.json({ avatarUrl, url: avatarUrl });
  } catch (error: any) {
    console.error('Error uploading avatar:', error.message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? error.message : 'Internal server error',
    });
  }
});

usersRouter.get('/me/following', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const snapshot = await db().collection('follows').where('followerId', '==', currentUserId).get();
    
    const followingIds = snapshot.docs.map(doc => doc.data().followingId);
    res.json({ followingIds });
  } catch (error: any) {
    console.error('Error fetching following list:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

usersRouter.post('/:id/follow', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const targetUserId = normalizeDocumentId(req.params.id, 'User id');
    const currentUserId = req.user!.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const targetUserRef = db().collection('users').doc(targetUserId);
    const targetUserDoc = await targetUserRef.get();

    if (!targetUserDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followId = `${currentUserId}_${targetUserId}`;
    const followRef = db().collection('follows').doc(followId);
    const followDoc = await followRef.get();

    const currentUserRef = db().collection('users').doc(currentUserId);

    if (followDoc.exists) {
      // Unfollow
      await followRef.delete();
      await targetUserRef.update({
        followersCount: FieldValue.increment(-1),
      });
      await currentUserRef.update({
        followingCount: FieldValue.increment(-1),
      });
      return res.json({ following: false });
    } else {
      // Follow
      await followRef.set({
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: new Date().toISOString()
      });
      await targetUserRef.update({
        followersCount: FieldValue.increment(1),
      });
      await currentUserRef.update({
        followingCount: FieldValue.increment(1),
      });
      return res.json({ following: true });
    }
  } catch (error: any) {
    console.error('Error toggling follow:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

usersRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const queryLower = normalizeString(q, { minLength: 2, maxLength: 80 })!.toLowerCase();

    // Firestore doesn't support full-text search natively.
    // We search by name prefix and also fetch brands to filter client-side.
    const snapshot = await db().collection('users').limit(100).get();

    const users = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return { id: doc.id, name: data.name, avatarUrl: data.avatarUrl, brandName: data.brandName, username: data.username };
      })
      .filter((u) =>
        u.name?.toLowerCase().includes(queryLower) ||
        u.brandName?.toLowerCase().includes(queryLower) ||
        u.username?.toLowerCase().includes(queryLower)
      )
      .slice(0, 20);

    res.json({ users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error searching users:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = normalizeDocumentId(req.params.id, 'User id');
    const doc = await db().collection('users').doc(userId).get();

    if (!doc.exists) return res.status(404).json({ message: 'User not found' });

    const data = doc.data();
    if (!data) return res.status(404).json({ message: 'User data missing' });

    // Count reels
    const reelsSnapshot = await db().collection('reels').where('creatorId', '==', doc.id).get();

    res.json({
      user: {
        id: doc.id,
        name: data.name,
        username: data.username,
        brandName: data.brandName,
        productCategories: data.productCategories,
        interests: data.interests,
        themePreference: data.themePreference,
        avatarUrl: data.avatarUrl,
        createdAt: data.createdAt,
        followersCount: data.followersCount || 0,
        followingCount: data.followingCount || 0,
        _count: { reels: reelsSnapshot.size },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching user:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});
