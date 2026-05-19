import { Router, Request, Response } from 'express';
import { db } from '../utils/firebase';
import { authMiddleware } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';
import {
  ValidationError,
  normalizeOptionalEmail,
  normalizeOptionalUrl,
  normalizeString,
  normalizeStringArray,
  normalizeThemePreference,
} from '../utils/validation';

export const authRouter = Router();
const registerRateLimit = createRateLimit({
  keyPrefix: 'auth-register',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again later.',
});

// Register new user
authRouter.post('/register', registerRateLimit, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, username, email, phone, gender, dob, country, websiteLink, brandName, productCategories, interests, themePreference, persona } = req.body;
    const safeName = normalizeString(name, { minLength: 2, maxLength: 80 });
    const safeUsername =
      normalizeString(username, { minLength: 2, maxLength: 40, allowEmpty: true }) ??
      safeName!.replace(/\s+/g, '').toLowerCase();
    const safeEmail = normalizeOptionalEmail(email);
    const safeWebsiteLink = normalizeOptionalUrl(websiteLink);
    const safePhone = normalizeString(phone, { maxLength: 30, allowEmpty: true });
    const safeGender = normalizeString(gender, { maxLength: 32, allowEmpty: true });
    const safeDob = normalizeString(dob, { maxLength: 32, allowEmpty: true });
    const safeCountry = normalizeString(country, { maxLength: 80, allowEmpty: true });
    const safeBrandName = normalizeString(brandName, { maxLength: 120, allowEmpty: true });
    const safeProductCategories = normalizeStringArray(productCategories ?? interests, { maxItems: 10, maxLength: 40 });
    const safeInterests = normalizeStringArray(interests ?? productCategories, { maxItems: 20, maxLength: 60 });
    const safeThemePreference = normalizeThemePreference(themePreference) ?? 'dark';
    const validPersonas = ['Creator', 'Brand', 'User'];
    const safePersona = validPersonas.includes(persona) ? persona : 'Creator';

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
      name: safeName,
      username: safeUsername,
      email: safeEmail,
      phone: safePhone,
      gender: safeGender,
      dob: safeDob,
      country: safeCountry,
      websiteLink: safeWebsiteLink,
      brandName: safeBrandName,
      productCategories: safeProductCategories,
      interests: safeInterests,
      persona: safePersona,
      themePreference: safeThemePreference,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      followersCount: 0,
      followingCount: 0,
    };

    // Use firebaseUid as document ID for faster lookup
    const docRef = usersRef.doc(req.user!.firebaseUid);
    await docRef.set(userData);
    res.status(201).json({ user: { id: docRef.id, ...userData } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error registering user:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
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

    const { name, username, email, phone, gender, dob, country, websiteLink, brandName, productCategories, interests, themePreference, avatarUrl, persona } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = normalizeString(name, { minLength: 2, maxLength: 80 });
    if (username !== undefined) updates.username = normalizeString(username, { minLength: 2, maxLength: 40, allowEmpty: true });
    if (email !== undefined) updates.email = normalizeOptionalEmail(email);
    if (phone !== undefined) updates.phone = normalizeString(phone, { maxLength: 30, allowEmpty: true });
    if (gender !== undefined) updates.gender = normalizeString(gender, { maxLength: 32, allowEmpty: true });
    if (dob !== undefined) updates.dob = normalizeString(dob, { maxLength: 32, allowEmpty: true });
    if (country !== undefined) updates.country = normalizeString(country, { maxLength: 80, allowEmpty: true });
    if (websiteLink !== undefined) updates.websiteLink = normalizeOptionalUrl(websiteLink);
    if (brandName !== undefined) updates.brandName = normalizeString(brandName, { maxLength: 120, allowEmpty: true });
    if (productCategories !== undefined) updates.productCategories = normalizeStringArray(productCategories, { maxItems: 10, maxLength: 40 });
    if (interests !== undefined) updates.interests = normalizeStringArray(interests, { maxItems: 20, maxLength: 60 });
    if (themePreference !== undefined) updates.themePreference = normalizeThemePreference(themePreference);
    if (avatarUrl !== undefined) updates.avatarUrl = normalizeOptionalUrl(avatarUrl);
    if (persona !== undefined) {
      const validPersonas = ['Creator', 'Brand', 'User'];
      if (validPersonas.includes(persona)) updates.persona = persona;
    }

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
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});
