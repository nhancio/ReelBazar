import { Router, Request, Response } from 'express';
import { db } from '../utils/firebase';
import { authMiddleware } from '../middleware/auth';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/;

// Register new user
authRouter.post('/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, username, email, phone, gender, dob, country, websiteLink, brandName, productCategories, interests, themePreference } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }

    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (websiteLink && !URL_REGEX.test(websiteLink)) {
      return res.status(400).json({ message: 'Website link must be a valid URL' });
    }

    // Check if already registered
    const usersRef = db().collection('users');
    let existingDoc = await usersRef.doc(req.user!.firebaseUid).get();
    
    if (!existingDoc.exists) {
      // Check for legacy user by firebaseUid field
      const snapshot = await usersRef.where('firebaseUid', '==', req.user!.firebaseUid).limit(1).get();
      if (!snapshot.empty) {
        existingDoc = snapshot.docs[0];
      }
    }

    if (existingDoc.exists) {
      return res.status(409).json({ message: 'User already registered', user: { id: existingDoc.id, ...existingDoc.data() } });
    }

    const now = new Date().toISOString();
    const userData = {
      firebaseUid: req.user!.firebaseUid,
      name: name.trim(),
      username: username || name.trim().replace(/\s+/g, '').toLowerCase(),
      email: email || null,
      phone: phone || null,
      gender: gender || null,
      dob: dob || null,
      country: country || null,
      websiteLink: websiteLink || null,
      brandName: brandName || null,
      productCategories: productCategories || interests || [],
      interests: interests || productCategories || [],
      themePreference: themePreference || 'dark',
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    // Use firebaseUid as document ID for faster lookup
    const docRef = usersRef.doc(req.user!.firebaseUid);
    await docRef.set(userData);
    res.status(201).json({ user: { id: docRef.id, ...userData } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error registering user:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user profile
authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(404).json({ message: 'User not registered' });
    }

    const doc = await db().collection('users').doc(req.user.id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: { id: doc.id, ...doc.data() } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching profile:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update profile
authRouter.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(403).json({ message: 'User not registered' });
    }

    const { name, username, email, phone, gender, dob, country, websiteLink, brandName, productCategories, interests, themePreference, avatarUrl } = req.body;

    if (email !== undefined && email !== null && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (websiteLink !== undefined && websiteLink !== null && !URL_REGEX.test(websiteLink)) {
      return res.status(400).json({ message: 'Website link must be a valid URL' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (gender !== undefined) updates.gender = gender;
    if (dob !== undefined) updates.dob = dob;
    if (country !== undefined) updates.country = country;
    if (websiteLink !== undefined) updates.websiteLink = websiteLink;
    if (brandName !== undefined) updates.brandName = brandName;
    if (productCategories !== undefined) updates.productCategories = productCategories;
    if (interests !== undefined) updates.interests = interests;
    if (themePreference !== undefined) updates.themePreference = themePreference;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    console.log('[authRouter.patch:/me] updateProfile request', {
      userId: req.user.id,
      updates,
    });

    await db().collection('users').doc(req.user.id).update(updates);
    const doc = await db().collection('users').doc(req.user.id).get();

    res.json({ user: { id: doc.id, ...doc.data() } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating profile:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});
