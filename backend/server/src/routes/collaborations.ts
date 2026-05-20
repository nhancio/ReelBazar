import { Router, Request, Response } from 'express';
import { db } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { generateCollaborationSuggestions } from '../services/matching';
import { createRateLimit } from '../middleware/rateLimit';
import { ValidationError, normalizeDocumentId, normalizeOptionalUrl, normalizeString } from '../utils/validation';

export const collaborationsRouter = Router();
collaborationsRouter.use(authMiddleware, requireRegistered);
const suggestionsRateLimit = createRateLimit({
  keyPrefix: 'collab-suggestions',
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many suggestion requests. Please try again later.',
});

const VALID_GENDERS = new Set(['Any', 'Male', 'Female', 'Non-binary', 'Prefer not to say']);
const VALID_AGE_GROUPS = new Set(['Any', '13-17', '18-24', '25-34', '35-44', '45+']);

function normalizeGender(value: unknown): string {
  const gender = normalizeString(value, { maxLength: 32 }) || 'Any';
  if (!VALID_GENDERS.has(gender)) throw new ValidationError('Invalid gender');
  return gender;
}

function normalizeAgeGroup(value: unknown): string {
  const ageGroup = normalizeString(value, { maxLength: 16 }) || 'Any';
  if (!VALID_AGE_GROUPS.has(ageGroup)) throw new ValidationError('Invalid age group');
  return ageGroup;
}

function getUserAgeGroup(user: FirebaseFirestore.DocumentData): string {
  if (typeof user.ageGroup === 'string') return user.ageGroup;
  if (typeof user.age === 'number') {
    if (user.age < 18) return '13-17';
    if (user.age < 25) return '18-24';
    if (user.age < 35) return '25-34';
    if (user.age < 45) return '35-44';
    return '45+';
  }
  if (typeof user.dob === 'string') {
    const born = Date.parse(user.dob);
    if (Number.isFinite(born)) {
      const age = Math.floor((Date.now() - born) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) return '13-17';
      if (age < 25) return '18-24';
      if (age < 35) return '25-34';
      if (age < 45) return '35-44';
      return '45+';
    }
  }
  return 'Any';
}

function scoreDemographics(target: { gender: string; ageGroup: string }, user: FirebaseFirestore.DocumentData): number {
  let score = 40;
  if (target.gender === 'Any' || !user.gender || target.gender === user.gender) score += 30;
  if (target.ageGroup === 'Any' || getUserAgeGroup(user) === target.ageGroup) score += 30;
  return score;
}

function serializeUser(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
  };
}

async function productsForBrand(brandId: string) {
  const productsSnap = await db().collection('brandProducts').where('brandId', '==', brandId).limit(3).get();
  return productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function collaborationId(brandId: string, influencerId: string, productListingId?: string | null) {
  return [brandId, influencerId, productListingId || 'general'].join('_');
}

// Get AI-suggested collaborations
collaborationsRouter.get('/suggestions', suggestionsRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userDoc = await db().collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ message: 'User not found' });

    const user = { id: userDoc.id, ...userDoc.data() };
    const collaborations = await generateCollaborationSuggestions(user);
    res.json({ collaborations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching suggestions:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get my collaborations
collaborationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Query collaborations where user is brand or influencer
    const [asBrand, asInfluencer] = await Promise.all([
      db().collection('collaborations').where('brandId', '==', userId).get(),
      db().collection('collaborations').where('influencerId', '==', userId).get(),
    ]);

    const allDocs = [...asBrand.docs, ...asInfluencer.docs];

    const collaborations = await Promise.all(
      allDocs.map(async (doc) => {
        const data = doc.data();
        const [brandDoc, influencerDoc] = await Promise.all([
          db().collection('users').doc(data.brandId).get(),
          db().collection('users').doc(data.influencerId).get(),
        ]);
        const brandData = brandDoc.exists ? brandDoc.data() : null;
        const infData = influencerDoc.exists ? influencerDoc.data() : null;
        return {
          id: doc.id,
          score: (data.score as number) || 0,
          ...data,
          brand: brandData ? { id: brandDoc.id, name: brandData.name, brandName: brandData.brandName, avatarUrl: brandData.avatarUrl } : null,
          influencer: infData ? { id: influencerDoc.id, name: infData.name, avatarUrl: infData.avatarUrl, gender: infData.gender, age: infData.age } : null,
        };
      })
    );

    // Sort by score descending
    collaborations.sort((a, b) => b.score - a.score);

    res.json({ collaborations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching collaborations:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

collaborationsRouter.post('/brand-search', suggestionsRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date().toISOString();
    const preference = {
      userId,
      gender: normalizeGender(req.body.gender),
      ageGroup: normalizeAgeGroup(req.body.ageGroup),
      updatedAt: now,
    };

    await db().collection('brandSearchPreferences').doc(userId).set(
      { ...preference, createdAt: now },
      { merge: true }
    );

    res.json({ preference: { id: userId, ...preference } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

collaborationsRouter.get('/brand-matches', suggestionsRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const prefDoc = await db().collection('brandSearchPreferences').doc(userId).get();
    const pref = prefDoc.exists ? prefDoc.data() : { gender: 'Any', ageGroup: 'Any' };
    const target = {
      gender: String(pref?.gender || 'Any'),
      ageGroup: String(pref?.ageGroup || 'Any'),
    };

    const usersSnap = await db().collection('users').get();
    const brandDocs = usersSnap.docs.filter((doc) => {
      const data = doc.data();
      return doc.id !== userId && (data.persona === 'Brand' || data.userType === 'brand' || Boolean(data.brandName));
    });

    const matches = await Promise.all(brandDocs.map(async (doc) => {
      const data = doc.data();
      const products = await productsForBrand(doc.id);
      const categories = Array.isArray(data.productCategories) ? data.productCategories : [];
      const genderBonus = target.gender === 'Any' || categories.includes(target.gender === 'Male' ? 'Men' : 'Women') ? 10 : 0;
      const score = Math.min(100, Math.round(scoreDemographics(target, data) + genderBonus + Math.min(products.length * 5, 15)));
      return {
        brand: serializeUser(doc),
        products,
        score,
        reason: `${target.gender === 'Any' ? 'Broad gender' : target.gender} and ${target.ageGroup === 'Any' ? 'all ages' : target.ageGroup} audience fit`,
      };
    }));

    matches.sort((a, b) => b.score - a.score);
    res.json({ matches: matches.slice(0, 5) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error matching brands:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

collaborationsRouter.post('/product-listings', suggestionsRateLimit, async (req: Request, res: Response) => {
  try {
    const brandId = req.user!.id;
    const imageUrl = normalizeOptionalUrl(req.body.imageUrl);
    if (!imageUrl) return res.status(400).json({ message: 'imageUrl is required' });

    const now = new Date().toISOString();
    const listing = {
      brandId,
      imageUrl,
      gender: normalizeGender(req.body.gender),
      ageGroup: normalizeAgeGroup(req.body.ageGroup),
      productName: normalizeString(req.body.productName, { maxLength: 80, allowEmpty: true }),
      productLink: normalizeOptionalUrl(req.body.productLink),
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db().collection('productListings').add(listing);
    res.status(201).json({ listing: { id: docRef.id, ...listing } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

collaborationsRouter.get('/product-listings', async (req: Request, res: Response) => {
  try {
    const snap = await db().collection('productListings').where('brandId', '==', req.user!.id).get();
    const listings = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    listings.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ listings });
  } catch (error: unknown) {
    console.error('Error loading listings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

collaborationsRouter.get('/product-listings/:id/influencer-matches', suggestionsRateLimit, async (req: Request, res: Response) => {
  try {
    const listingId = normalizeDocumentId(req.params.id, 'Product listing id');
    const listingDoc = await db().collection('productListings').doc(listingId).get();
    const listing = listingDoc.data();
    if (!listingDoc.exists || !listing) return res.status(404).json({ message: 'Product listing not found' });
    if (listing.brandId !== req.user!.id) return res.status(403).json({ message: 'Not authorized' });

    const usersSnap = await db().collection('users').get();
    const influencerDocs = usersSnap.docs.filter((doc) => {
      const data = doc.data();
      return doc.id !== req.user!.id && (data.persona === 'Creator' || data.userType === 'influencer' || (!data.persona && !data.brandName));
    });

    const target = { gender: String(listing.gender || 'Any'), ageGroup: String(listing.ageGroup || 'Any') };
    const matches = influencerDocs.map((doc) => {
      const data = doc.data();
      const interests = Array.isArray(data.interests) ? data.interests : [];
      const categories = Array.isArray(data.productCategories) ? data.productCategories : [];
      const interestScore = [...interests, ...categories].length ? 10 : 0;
      const score = Math.min(100, Math.round(scoreDemographics(target, data) + interestScore));
      return {
        influencer: serializeUser(doc),
        score,
        reason: `${target.gender === 'Any' ? 'Broad gender' : target.gender} and ${target.ageGroup === 'Any' ? 'all ages' : target.ageGroup} creator fit`,
      };
    });

    matches.sort((a, b) => b.score - a.score);
    res.json({ matches: matches.slice(0, 5) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

collaborationsRouter.post('/deals', async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const brandId = normalizeDocumentId(req.body.brandId, 'Brand id');
    const influencerId = normalizeDocumentId(req.body.influencerId, 'Influencer id');
    const status = normalizeString(req.body.status, { maxLength: 16 });
    if (status !== 'accepted' && status !== 'declined') {
      return res.status(400).json({ message: 'Status must be accepted or declined' });
    }
    if (currentUserId !== brandId && currentUserId !== influencerId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const productListingId = req.body.productListingId ? normalizeDocumentId(req.body.productListingId, 'Product listing id') : null;
    const now = new Date().toISOString();
    const docRef = db().collection('collaborations').doc(collaborationId(brandId, influencerId, productListingId));
    await docRef.set({
      brandId,
      influencerId,
      productListingId,
      status,
      score: status === 'accepted' ? 100 : 0,
      source: 'chat-deal',
      updatedAt: now,
      createdAt: now,
    }, { merge: true });

    if (req.body.conversationId) {
      const conversationId = normalizeString(req.body.conversationId, { maxLength: 300 });
      await db().collection('conversations').doc(conversationId!).collection('messages').add({
        senderId: currentUserId,
        text: status === 'accepted' ? 'Deal accepted' : 'No deal',
        kind: 'deal-status',
        status,
        createdAt: now,
      });
    }

    const snap = await docRef.get();
    res.json({ collaboration: { id: snap.id, ...snap.data() } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

collaborationsRouter.get('/deal-brands', async (req: Request, res: Response) => {
  try {
    const snap = await db().collection('collaborations')
      .where('influencerId', '==', req.user!.id)
      .where('status', '==', 'accepted')
      .get();

    const brandIds = Array.from(new Set(snap.docs.map((doc) => doc.data().brandId as string).filter(Boolean)));
    if (brandIds.length === 0) return res.json({ brands: [] });

    const brandDocs = await db().getAll(...brandIds.map((id) => db().collection('users').doc(id)));
    const brands = brandDocs.filter((doc) => doc.exists).map(serializeUser);
    res.json({ brands });
  } catch (error: unknown) {
    console.error('Error loading deal brands:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

collaborationsRouter.get('/brand-performance/:brandId', async (req: Request, res: Response) => {
  try {
    const brandId = normalizeDocumentId(req.params.brandId, 'Brand id');
    const currentUserId = req.user!.id;
    if (brandId !== currentUserId) return res.status(403).json({ message: 'Not authorized' });

    const brandDoc = await db().collection('users').doc(brandId).get();
    const brand = brandDoc.data();
    const brandName = String(brand?.brandName || brand?.name || '').trim();

    const byBrandId = await db().collection('reels').where('brandId', '==', brandId).get();
    const reelMap = new Map<string, any>();
    byBrandId.docs.forEach((doc) => reelMap.set(doc.id, { id: doc.id, ...doc.data() }));

    if (brandName) {
      const byTag = await db().collection('reels').where('brandTag', '==', brandName).get();
      byTag.docs.forEach((doc) => reelMap.set(doc.id, { id: doc.id, ...doc.data() }));
    }

    const reels = Array.from(reelMap.values()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ reels });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// Respond to collaboration
collaborationsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Status must be accepted or declined' });
    }

    const docRef = db().collection('collaborations').doc(normalizeDocumentId(req.params.id, 'Collaboration id'));
    const currentUserId = req.user!.id;
    const existingDoc = await docRef.get();
    const existingData = existingDoc.data();

    if (!existingDoc.exists || !existingData) {
      return res.status(404).json({ message: 'Collaboration not found' });
    }

    if (existingData.brandId !== currentUserId && existingData.influencerId !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized to update this collaboration' });
    }

    await docRef.update({ status, updatedAt: new Date().toISOString() });

    const doc = await docRef.get();
    const data = doc.data();
    if (!data) return res.status(404).json({ message: 'Collaboration not found' });

    const [brandDoc, influencerDoc] = await Promise.all([
      db().collection('users').doc(data.brandId).get(),
      db().collection('users').doc(data.influencerId).get(),
    ]);
    const brandData = brandDoc.exists ? brandDoc.data() : null;
    const infData = influencerDoc.exists ? influencerDoc.data() : null;

    res.json({
      collaboration: {
        id: doc.id,
        ...data,
        brand: brandData ? { id: brandDoc.id, name: brandData.name, brandName: brandData.brandName, avatarUrl: brandData.avatarUrl } : null,
        influencer: infData ? { id: influencerDoc.id, name: infData.name, avatarUrl: infData.avatarUrl } : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating collaboration:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});
