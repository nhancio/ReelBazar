import { Router, Request, Response } from 'express';
import { db, admin } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { ValidationError, normalizeDocumentId, normalizeString, parseIntegerQuery } from '../utils/validation';

const FieldValue = admin.firestore.FieldValue;

export const commentsRouter = Router();

// GET /comments/reel/:reelId — paginated comments for a reel
commentsRouter.get('/reel/:reelId', async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.reelId, 'Reel id');
    const { cursor, limit = '20' } = req.query;
    const take = parseIntegerQuery(limit, 20, 50);

    let query = db()
      .collection('reelComments')
      .where('reelId', '==', reelId)
      .orderBy('createdAt', 'desc');

    if (cursor) {
      const cursorDoc = await db()
        .collection('reelComments')
        .doc(normalizeDocumentId(cursor, 'Cursor'))
        .get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(take + 1).get();
    let comments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const hasMore = comments.length > take;
    if (hasMore) comments = comments.slice(0, take);

    // Batch-fetch author data
    const authorIds = [...new Set(comments.map((c: any) => c.authorId as string))].filter(Boolean);
    const authorMap: Record<string, any> = {};
    if (authorIds.length > 0) {
      const authorRefs = authorIds.map((id) => db().collection('users').doc(id));
      const authorDocs = await db().getAll(...authorRefs);
      authorDocs.forEach((d) => {
        if (d.exists) {
          const data = d.data()!;
          authorMap[d.id] = { id: d.id, name: data.name, avatarUrl: data.avatarUrl, username: data.username };
        }
      });
    }

    const enriched = comments.map((c: any) => ({ ...c, author: authorMap[c.authorId] ?? null }));

    res.json({
      comments: enriched,
      hasMore,
      nextCursor: hasMore ? snapshot.docs[take - 1].id : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// POST /comments/reel/:reelId — add a comment
commentsRouter.post('/reel/:reelId', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const reelId = normalizeDocumentId(req.params.reelId, 'Reel id');
    const text = normalizeString(req.body.text, { minLength: 1, maxLength: 500, preserveNewlines: true });

    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    // Verify reel exists
    const reelDoc = await db().collection('reels').doc(reelId).get();
    if (!reelDoc.exists) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const userId = req.user!.id;
    const now = new Date().toISOString();

    const commentData = {
      reelId,
      authorId: userId,
      text,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db().collection('reelComments').add(commentData);

    // Increment commentsCount on the reel
    await db().collection('reels').doc(reelId).update({
      commentsCount: FieldValue.increment(1),
    });

    // Fetch author for response
    const authorDoc = await db().collection('users').doc(userId).get();
    const authorData = authorDoc.data();
    const author = authorDoc.exists && authorData
      ? { id: authorDoc.id, name: authorData.name, avatarUrl: authorData.avatarUrl, username: authorData.username }
      : null;

    res.status(201).json({
      comment: { id: docRef.id, ...commentData, author },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// DELETE /comments/:commentId — delete own comment
commentsRouter.delete('/:commentId', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const commentId = normalizeDocumentId(req.params.commentId, 'Comment id');
    const commentRef = db().collection('reelComments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const data = commentDoc.data()!;
    if (data.authorId !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await commentRef.delete();

    // Decrement commentsCount
    await db().collection('reels').doc(data.reelId).update({
      commentsCount: FieldValue.increment(-1),
    });

    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});
