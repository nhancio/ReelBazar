import { Router, Request, Response } from 'express';
import { db, admin } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';

const FieldValue = admin.firestore.FieldValue;

export const streaksRouter = Router();

// POST /streaks/checkin — call once per app open; idempotent within the same calendar day (UTC)
streaksRouter.post('/checkin', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRef = db().collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const data = userDoc.data()!;
    const todayUtc = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const lastCheckin: string | undefined = data.lastCheckinDate;

    // Already checked in today — return current streak without updating
    if (lastCheckin === todayUtc) {
      return res.json({
        streakCount: data.streakCount ?? 1,
        longestStreak: data.longestStreak ?? data.streakCount ?? 1,
        lastCheckinDate: todayUtc,
        alreadyCheckedIn: true,
      });
    }

    // Determine new streak: consecutive if yesterday, else reset to 1
    const yesterdayUtc = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const currentStreak: number = data.streakCount ?? 0;
    const newStreak = lastCheckin === yesterdayUtc ? currentStreak + 1 : 1;
    const newLongest = Math.max(data.longestStreak ?? 0, newStreak);

    await userRef.update({
      streakCount: newStreak,
      longestStreak: newLongest,
      lastCheckinDate: todayUtc,
      updatedAt: new Date().toISOString(),
    });

    // Record streak event for analytics
    await db().collection('streakEvents').add({
      userId,
      date: todayUtc,
      streakCount: newStreak,
      createdAt: new Date().toISOString(),
    });

    res.json({
      streakCount: newStreak,
      longestStreak: newLongest,
      lastCheckinDate: todayUtc,
      alreadyCheckedIn: false,
      isNewRecord: newStreak > (data.longestStreak ?? 0),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing streak checkin:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /streaks/me — get current user's streak info
streaksRouter.get('/me', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userDoc = await db().collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const data = userDoc.data()!;
    const todayUtc = new Date().toISOString().slice(0, 10);
    const lastCheckin: string | undefined = data.lastCheckinDate;
    const yesterdayUtc = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Streak is "alive" if checked in today or yesterday
    const isActive = lastCheckin === todayUtc || lastCheckin === yesterdayUtc;
    const activeStreak = isActive ? (data.streakCount ?? 0) : 0;

    res.json({
      streakCount: activeStreak,
      longestStreak: data.longestStreak ?? 0,
      lastCheckinDate: data.lastCheckinDate ?? null,
      checkedInToday: lastCheckin === todayUtc,
    });
  } catch (error: unknown) {
    console.error('Error fetching streak:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
