import { Router, Request, Response } from 'express';
import { db, admin, storage } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const FieldValue = admin.firestore.FieldValue;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const usersRouter = Router();

usersRouter.put('/me', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    // Basic validation
    const allowedFields = ['name', 'username', 'brandName', 'productCategories', 'interests', 'themePreference'];
    const updateData: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

usersRouter.post('/me/avatar', authMiddleware, requireRegistered, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required' });
  }

  try {
    const bucket = storage();
    const filename = `avatars/${req.user!.id}-${uuidv4()}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });

    await file.makePublic();
    const avatarUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    await db().collection('users').doc(req.user!.id).update({
      avatarUrl
    });

    res.json({ avatarUrl });
  } catch (error: any) {
    console.error('Error uploading avatar:', error.message);
    res.status(500).json({ message: 'Internal server error' });
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
    const targetUserId = req.params.id;
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

    const queryLower = q.toLowerCase().trim();

    if (queryLower.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    // Firestore doesn't support full-text search natively.
    // We search by name prefix and also fetch brands to filter client-side.
    const snapshot = await db().collection('users').limit(100).get();

    const users = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return { id: doc.id, name: data.name, email: data.email, avatarUrl: data.avatarUrl, brandName: data.brandName };
      })
      .filter((u) =>
        u.name?.toLowerCase().includes(queryLower) ||
        u.brandName?.toLowerCase().includes(queryLower) ||
        u.email?.toLowerCase().includes(queryLower)
      )
      .slice(0, 20);

    res.json({ users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error searching users:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await db().collection('users').doc(req.params.id).get();

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
        email: data.email,
        phone: data.phone,
        gender: data.gender,
        age: data.age,
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
    res.status(500).json({ message: 'Internal server error' });
  }
});
