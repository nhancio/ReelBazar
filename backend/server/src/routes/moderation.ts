/**
 * Reporting and blocking.
 *
 * These are not nice-to-haves. App Store Review Guideline 1.2 and Google Play's
 * User Generated Content policy both require an app with user-uploaded media to provide a
 * way to report objectionable content, a way to block abusive users, and a mechanism for
 * acting on reports. Rava ships user video, so review will look for exactly this.
 */
import { Router, Request, Response } from 'express';
import { db, admin } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';
import { ValidationError, normalizeDocumentId, normalizeString } from '../utils/validation';

const FieldValue = admin.firestore.FieldValue;

export const moderationRouter = Router();

/** Reasons the client may submit. Kept as a closed set so the moderation queue is filterable. */
export const REPORT_REASONS = [
  'sexual_content',
  'violence',
  'hate_speech',
  'harassment',
  'spam_or_scam',
  'intellectual_property',
  'self_harm',
  'other',
] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

/** Abuse guard: reporting is unauthenticated-adjacent and a natural spam target. */
const reportRateLimit = createRateLimit({
  keyPrefix: 'report',
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many reports submitted. Please try again later.',
});

function parseReason(value: unknown): ReportReason {
  const reason = normalizeString(value, { maxLength: 40 });
  if (!reason || !REPORT_REASONS.includes(reason as ReportReason)) {
    throw new ValidationError(`reason must be one of: ${REPORT_REASONS.join(', ')}`);
  }
  return reason as ReportReason;
}

/** Report a reel or a user. */
moderationRouter.post(
  '/reports',
  reportRateLimit,
  authMiddleware,
  requireRegistered,
  async (req: Request, res: Response) => {
    try {
      const reporterId = req.user!.id;
      const targetType = normalizeString(req.body?.targetType, { maxLength: 10 });
      if (targetType !== 'reel' && targetType !== 'user') {
        throw new ValidationError("targetType must be 'reel' or 'user'");
      }

      const targetId = normalizeDocumentId(req.body?.targetId, 'targetId');
      const reason = parseReason(req.body?.reason);
      const details = normalizeString(req.body?.details, {
        maxLength: 1000,
        allowEmpty: true,
        preserveNewlines: true,
      });

      // Confirm the target exists so the queue never fills with reports on nothing.
      const collection = targetType === 'reel' ? 'reels' : 'users';
      const target = await db().collection(collection).doc(targetId).get();
      if (!target.exists) return res.status(404).json({ message: 'Target not found' });

      if (targetType === 'user' && targetId === reporterId) {
        throw new ValidationError('You cannot report yourself');
      }

      // One report per reporter per target: re-reporting refreshes rather than duplicates.
      const reportId = `${reporterId}_${targetType}_${targetId}`;
      await db().collection('reports').doc(reportId).set(
        {
          reporterId,
          targetType,
          targetId,
          targetOwnerId: targetType === 'reel' ? target.data()?.creatorId ?? null : targetId,
          reason,
          details: details ?? null,
          status: 'open',
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Denormalised counter so a moderation view can sort by most-reported cheaply.
      await db()
        .collection(collection)
        .doc(targetId)
        .set({ reportCount: FieldValue.increment(1) }, { merge: true })
        .catch(() => undefined);

      res.status(201).json({ reported: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!(error instanceof ValidationError)) console.error('Error creating report:', message);
      res.status(error instanceof ValidationError ? 400 : 500).json({
        message: error instanceof ValidationError ? message : 'Internal server error',
      });
    }
  }
);

/** Block or unblock a user. Idempotent per direction. */
moderationRouter.post(
  '/blocks/:id',
  authMiddleware,
  requireRegistered,
  async (req: Request, res: Response) => {
    try {
      const blockerId = req.user!.id;
      const blockedId = normalizeDocumentId(req.params.id, 'User id');

      if (blockerId === blockedId) throw new ValidationError('You cannot block yourself');

      const target = await db().collection('users').doc(blockedId).get();
      if (!target.exists) return res.status(404).json({ message: 'User not found' });

      const ref = db().collection('blocks').doc(`${blockerId}_${blockedId}`);
      const existing = await ref.get();

      if (existing.exists) {
        await ref.delete();
        return res.json({ blocked: false });
      }

      await ref.set({
        blockerId,
        blockedId,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Blocking implies unfollowing in both directions — otherwise the blocked account keeps
      // showing up through the follow graph.
      await Promise.all([
        db().collection('follows').doc(`${blockerId}_${blockedId}`).delete().catch(() => undefined),
        db().collection('follows').doc(`${blockedId}_${blockerId}`).delete().catch(() => undefined),
      ]);

      res.json({ blocked: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!(error instanceof ValidationError)) console.error('Error toggling block:', message);
      res.status(error instanceof ValidationError ? 400 : 500).json({
        message: error instanceof ValidationError ? message : 'Internal server error',
      });
    }
  }
);

/** The signed-in user's block list, hydrated enough to render a management screen. */
moderationRouter.get(
  '/blocks',
  authMiddleware,
  requireRegistered,
  async (req: Request, res: Response) => {
    try {
      const snapshot = await db()
        .collection('blocks')
        .where('blockerId', '==', req.user!.id)
        .get();

      const blockedIds = snapshot.docs.map((doc) => doc.data().blockedId as string);
      const users = await Promise.all(
        blockedIds.map(async (id) => {
          const doc = await db().collection('users').doc(id).get();
          if (!doc.exists) return null;
          const data = doc.data() ?? {};
          return {
            id: doc.id,
            name: data.name ?? null,
            username: data.username ?? null,
            avatarUrl: data.avatarUrl ?? null,
          };
        })
      );

      res.json({ blockedIds, users: users.filter(Boolean) });
    } catch (error: unknown) {
      console.error('Error listing blocks:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);
