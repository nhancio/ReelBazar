import { Router, Request, Response } from 'express';
import { db } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';
import { ValidationError, normalizeString } from '../utils/validation';

export const payoutsRouter = Router();

/** Creator earnings: ₹1 per unique reel view, ₹5 per product-link click. */
export const PAYOUT_RATE_PER_VIEW = 1;
export const PAYOUT_RATE_PER_CLICK = 5;
export const MINIMUM_PAYOUT_AMOUNT = 500; // ₹500 minimum payout

const payoutRequestRateLimit = createRateLimit({
  keyPrefix: 'payout-request',
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many payout requests. Please try again later.',
});

// Helper: Calculate full balance for user
async function calculateUserBalance(userId: string) {
  // 1. Reels view/click earnings
  const reelsSnapshot = await db().collection('reels').where('creatorId', '==', userId).get();
  
  const reelEarningsMap = new Map<string, { views: number; clicks: number; salesCount: number; salesCommissions: number }>();

  reelsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    reelEarningsMap.set(doc.id, {
      views: data.viewsCount ?? 0,
      clicks: data.clicksCount ?? 0,
      salesCount: 0,
      salesCommissions: 0,
    });
  });

  // 2. Creator product sales commissions from creatorEarnings ledger
  const earningsSnapshot = await db()
    .collection('creatorEarnings')
    .where('creatorId', '==', userId)
    .where('status', '==', 'confirmed')
    .get();

  let totalSalesCommissions = 0;
  let totalSalesCount = earningsSnapshot.docs.length;

  earningsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const amount = Number(data.amount || 0);
    totalSalesCommissions += amount;

    if (data.reelId && reelEarningsMap.has(data.reelId)) {
      const entry = reelEarningsMap.get(data.reelId)!;
      entry.salesCount += 1;
      entry.salesCommissions += amount;
    }
  });

  const reels = reelsSnapshot.docs.map((doc) => {
    const data = doc.data();
    const stats = reelEarningsMap.get(doc.id) || { views: 0, clicks: 0, salesCount: 0, salesCommissions: 0 };
    const viewEarnings = stats.views * PAYOUT_RATE_PER_VIEW;
    const clickEarnings = stats.clicks * PAYOUT_RATE_PER_CLICK;
    const totalEarnings = viewEarnings + clickEarnings + stats.salesCommissions;

    return {
      reelId: doc.id,
      caption: data.caption ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      category: data.category ?? null,
      createdAt: data.createdAt ?? null,
      views: stats.views,
      clicks: stats.clicks,
      viewEarnings,
      clickEarnings,
      salesCount: stats.salesCount,
      salesCommissions: stats.salesCommissions,
      totalEarnings,
    };
  });

  reels.sort((a, b) => b.totalEarnings - a.totalEarnings);

  const totalViews = reels.reduce((sum, r) => sum + r.views, 0);
  const totalClicks = reels.reduce((sum, r) => sum + r.clicks, 0);
  const viewEarnings = totalViews * PAYOUT_RATE_PER_VIEW;
  const clickEarnings = totalClicks * PAYOUT_RATE_PER_CLICK;
  const totalEarnings = viewEarnings + clickEarnings + totalSalesCommissions;

  // 3. Paid out amounts (from completed/processing payoutRequests and payouts collections)
  const [requestsSnap, legacySnap] = await Promise.all([
    db().collection('payoutRequests').where('userId', '==', userId).get(),
    db().collection('payouts').where('creatorId', '==', userId).get(),
  ]);

  const paidOutRequests = requestsSnap.docs
    .filter((d) => ['completed', 'processing'].includes(d.data().status))
    .reduce((sum, d) => sum + Number(d.data().amount || 0), 0);

  const legacyPaidOut = legacySnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
  const totalPaidOut = paidOutRequests + legacyPaidOut;
  const pendingBalance = Math.max(0, totalEarnings - totalPaidOut);

  const payoutHistory = requestsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .concat(
      legacySnap.docs.map((doc) => ({
        id: doc.id,
        amount: doc.data().amount,
        createdAt: doc.data().createdAt,
        status: 'completed',
        payoutMethod: 'bank_transfer',
        ...doc.data(),
      }))
    )
    .sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return {
    rates: { perView: PAYOUT_RATE_PER_VIEW, perClick: PAYOUT_RATE_PER_CLICK },
    totals: {
      reels: reels.length,
      views: totalViews,
      clicks: totalClicks,
      viewEarnings,
      clickEarnings,
      salesCount: totalSalesCount,
      salesCommissions: totalSalesCommissions,
      totalEarnings,
      paidOut: totalPaidOut,
      pendingBalance,
    },
    reels,
    payoutHistory,
  };
}

// GET /payouts/me — earnings summary + per-reel breakdown for the signed-in creator
payoutsRouter.get('/me', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const creatorId = req.user!.id;
    const balance = await calculateUserBalance(creatorId);

    res.json({
      currency: 'INR',
      ...balance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error computing payouts:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /payouts/request — submit payout request
payoutsRouter.post('/request', payoutRequestRateLimit, authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const amount = Number.parseFloat(req.body.amount);
    const payoutMethod = req.body.payoutMethod;
    const upiId = normalizeString(req.body.upiId, { maxLength: 80, allowEmpty: true });
    const bankDetails = req.body.bankDetails || null;

    if (!Number.isFinite(amount) || amount < MINIMUM_PAYOUT_AMOUNT) {
      return res.status(400).json({
        message: `Minimum payout amount is ₹${MINIMUM_PAYOUT_AMOUNT}`,
      });
    }

    if (!payoutMethod || !['upi', 'bank_transfer'].includes(payoutMethod)) {
      return res.status(400).json({ message: 'payoutMethod must be "upi" or "bank_transfer"' });
    }

    if (payoutMethod === 'upi' && !upiId) {
      return res.status(400).json({ message: 'Valid UPI ID is required for UPI payout' });
    }

    if (payoutMethod === 'bank_transfer') {
      if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
        return res.status(400).json({
          message: 'Account number, IFSC code, and account holder name are required for bank transfer',
        });
      }
    }

    // Verify user has sufficient balance
    const balance = await calculateUserBalance(userId);
    if (balance.totals.pendingBalance < amount) {
      return res.status(400).json({
        message: `Insufficient balance. Available to withdraw: ₹${balance.totals.pendingBalance}`,
      });
    }

    const now = new Date().toISOString();
    const userDoc = await db().collection('users').doc(userId).get();
    const userData = userDoc.data();

    const payoutDocData = {
      userId,
      userType: userData?.persona || userData?.userType || 'creator',
      amount,
      currency: 'INR',
      payoutMethod,
      upiId: upiId || null,
      bankDetails: bankDetails ? {
        accountNumber: normalizeString(bankDetails.accountNumber, { maxLength: 40 }),
        ifscCode: normalizeString(bankDetails.ifscCode, { maxLength: 20 }),
        accountHolderName: normalizeString(bankDetails.accountHolderName, { maxLength: 100 }),
      } : null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db().collection('payoutRequests').add(payoutDocData);

    res.status(201).json({
      payoutRequest: { id: docRef.id, ...payoutDocData },
      message: 'Payout request submitted successfully. Processing time is typically 1-2 business days.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating payout request:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// GET /payouts/history — get user's payout requests
payoutsRouter.get('/history', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const snapshot = await db()
      .collection('payoutRequests')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const payoutHistory = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ payoutHistory });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Internal server error' });
  }
});
