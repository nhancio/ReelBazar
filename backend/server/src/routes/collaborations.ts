import { Router, Request, Response } from 'express';
import { db } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { generateCollaborationSuggestions } from '../services/matching';
import { createRateLimit } from '../middleware/rateLimit';
import { ValidationError, normalizeDocumentId } from '../utils/validation';

export const collaborationsRouter = Router();
collaborationsRouter.use(authMiddleware, requireRegistered);
const suggestionsRateLimit = createRateLimit({
  keyPrefix: 'collab-suggestions',
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many suggestion requests. Please try again later.',
});

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
