import { Router, Request, Response } from 'express';
import { db, admin } from '../utils/firebase';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';
import {
  razorpayEnabled,
  createRazorpayOrder,
  verifyWebhookSignature,
  verifyPaymentSignature,
  getRazorpayKeyId,
} from '../utils/razorpay';
import { SAMPLE_PRODUCT } from './products';
import { ValidationError, normalizeDocumentId, normalizeString } from '../utils/validation';
import { buildTracking, canVerifyPayment, demoPaymentAllowed, isProductionRuntime } from '../orderLogic';

const FieldValue = admin.firestore.FieldValue;

export const ordersRouter = Router();

const checkoutRateLimit = createRateLimit({
  keyPrefix: 'order-checkout',
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many checkout attempts. Please try again later.',
});

const APP_ORIGIN = process.env.APP_ORIGIN || 'https://app.rava.one';

async function getProduct(productId: string): Promise<FirebaseFirestore.DocumentData | null> {
  if (productId === SAMPLE_PRODUCT.id) return SAMPLE_PRODUCT;
  const doc = await db().collection('products').doc(productId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Record creator commission and brand earnings ledgers upon confirmed payment.
 */
async function recordOrderSettlement(orderId: string, orderData: FirebaseFirestore.DocumentData) {
  try {
    const now = new Date().toISOString();

    // 1. Decrement inventory
    if (orderData.productId && orderData.productId !== SAMPLE_PRODUCT.id) {
      const qty = orderData.quantity || 1;
      await db().collection('products').doc(orderData.productId).update({
        inventoryCount: FieldValue.increment(-qty),
      }).catch(() => {});
    }

    // 2. Increment reel orders count
    if (orderData.reelId) {
      await db().collection('reels').doc(orderData.reelId).update({
        ordersCount: FieldValue.increment(1),
      }).catch(() => {});
    }

    // 3. Record Creator Commission Ledger
    if (orderData.creatorId && (orderData.creatorCommission ?? 0) > 0) {
      const creatorRef = db().collection('creatorEarnings').doc(`${orderId}_creator`);
      await creatorRef.set({
        orderId,
        creatorId: orderData.creatorId,
        amount: orderData.creatorCommission,
        productId: orderData.productId,
        reelId: orderData.reelId || null,
        status: 'confirmed',
        createdAt: now,
      }, { merge: true });
    }

    // 4. Record Brand Payout Ledger
    if (orderData.brandId && (orderData.brandPayout ?? 0) > 0) {
      const brandRef = db().collection('brandEarnings').doc(`${orderId}_brand`);
      await brandRef.set({
        orderId,
        brandId: orderData.brandId,
        amount: orderData.brandPayout,
        productId: orderData.productId,
        status: 'confirmed',
        createdAt: now,
      }, { merge: true });
    }
  } catch (err) {
    console.error('Error recording order settlement:', err);
  }
}

// POST /orders/checkout — start a purchase; creates an order & Razorpay order
ordersRouter.post('/checkout', checkoutRateLimit, authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const productId = normalizeDocumentId(req.body.productId, 'Product id');
    if (productId === SAMPLE_PRODUCT.id && isProductionRuntime(process.env)) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const product = await getProduct(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.inStock === false) return res.status(409).json({ message: 'Product is out of stock' });

    const quantity = Math.max(1, Math.min(50, Number.parseInt(req.body.quantity || '1', 10) || 1));
    if (Number.isFinite(product.inventoryCount) && product.inventoryCount < quantity) {
      return res.status(409).json({ message: 'Requested quantity is not available' });
    }
    const useRazorpay = razorpayEnabled();
    if (!useRazorpay && !demoPaymentAllowed(process.env)) {
      return res.status(503).json({ message: 'Payments are temporarily unavailable' });
    }

    const reelId = req.body.reelId ? normalizeDocumentId(req.body.reelId, 'Reel id') : null;
    let creatorId: string | null = null;
    if (reelId) {
      const reelDoc = await db().collection('reels').doc(reelId).get();
      if (!reelDoc.exists) return res.status(404).json({ message: 'Reel not found' });
      const reelData = reelDoc.data()!;
      if (reelData.productId !== productId) return res.status(400).json({ message: 'Reel is not tagged with this product' });
      creatorId = reelData.creatorId || null;
    }

    const inputAddress = req.body.shippingAddress;
    const shippingAddress = inputAddress && typeof inputAddress === 'object'
      ? {
          street: normalizeString(inputAddress.street, { minLength: 1, maxLength: 200 }),
          city: normalizeString(inputAddress.city, { minLength: 1, maxLength: 100 }),
          state: normalizeString(inputAddress.state, { minLength: 1, maxLength: 100 }),
          pincode: normalizeString(inputAddress.pincode, { minLength: 6, maxLength: 6 }),
          country: normalizeString(inputAddress.country || 'India', { minLength: 1, maxLength: 60 }),
        }
      : null;
    if (
      !shippingAddress?.street || !shippingAddress.city || !shippingAddress.state
      || !shippingAddress.pincode || !/^\d{6}$/.test(shippingAddress.pincode)
    ) {
      return res.status(400).json({ message: 'A complete delivery address with a valid 6-digit pincode is required' });
    }
    const buyerName = normalizeString(req.body.buyerName, { maxLength: 100, allowEmpty: true });
    const buyerPhone = normalizeString(req.body.buyerPhone, { maxLength: 25, allowEmpty: true });

    const buyerDoc = await db().collection('users').doc(req.user!.id).get();
    const buyer = buyerDoc.data();

    // Split calculations:
    // P = Total product price
    // F = Platform fee (5%)
    // C = Creator commission (% r_c of P, if creator tagged)
    // B = Brand payout = P - (F + C)
    const unitPrice = product.price || 0;
    const totalAmount = unitPrice * quantity;
    const commissionRate = typeof product.commissionRate === 'number' ? product.commissionRate : 10;
    const platformFee = Math.round(totalAmount * 0.05);
    const creatorCommission = creatorId ? Math.round(totalAmount * (commissionRate / 100)) : 0;
    const brandPayout = Math.max(0, totalAmount - (platformFee + creatorCommission));

    const now = new Date().toISOString();
    const orderRef = db().collection('orders').doc();
    let razorpayOrderId: string | null = null;
    let paymentUrl: string;

    const orderData: Record<string, unknown> = {
      buyerId: req.user!.id,
      buyerName: buyerName || buyer?.name || 'Customer',
      buyerEmail: buyer?.email ?? null,
      buyerPhone: buyerPhone || (buyer?.phone ?? null),
      shippingAddress,
      productId,
      productName: product.name,
      productImageUrl: product.imageUrl ?? null,
      quantity,
      brandId: product.brandId,
      brandName: product.brandName ?? null,
      reelId,
      creatorId,
      amount: totalAmount,
      currency: product.currency ?? 'INR',
      platformFee,
      creatorCommission,
      brandPayout,
      paymentProvider: useRazorpay ? 'razorpay' : 'demo',
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      status: 'pending_payment',
      paidAt: null,
      courierName: null,
      trackingNumber: null,
      shippedAt: null,
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
    };

    if (useRazorpay) {
      const rzpOrder = await createRazorpayOrder({
        amountInRupees: totalAmount,
        currency: product.currency ?? 'INR',
        receipt: orderRef.id,
        notes: {
          orderId: orderRef.id,
          buyerId: req.user!.id,
          productId,
          creatorId: creatorId || '',
        },
      });

      razorpayOrderId = rzpOrder.id;
      orderData.razorpayOrderId = razorpayOrderId;
      paymentUrl = `${APP_ORIGIN}/orders?orderId=${orderRef.id}&razorpayOrderId=${razorpayOrderId}`;
    } else {
      // Demo mode: no payment provider configured — mark paid immediately
      orderData.status = 'confirmed';
      orderData.paidAt = now;
      paymentUrl = `${APP_ORIGIN}/orders?success=1&orderId=${orderRef.id}&demo=1`;
    }

    await orderRef.set(orderData);

    if (!useRazorpay) {
      await recordOrderSettlement(orderRef.id, orderData);
    }

    res.status(201).json({
      order: { id: orderRef.id, ...orderData, tracking: buildTracking(orderData) },
      razorpayOrderId,
      keyId: getRazorpayKeyId(),
      amount: totalAmount,
      currency: product.currency ?? 'INR',
      paymentUrl,
      demoMode: !useRazorpay,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating checkout:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// POST /orders/verify — verify Razorpay payment signature from client
ordersRouter.post('/verify', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const orderId = normalizeDocumentId(req.body.orderId, 'Order id');
    const razorpayOrderId = normalizeString(req.body.razorpayOrderId, { maxLength: 256 });
    const razorpayPaymentId = normalizeString(req.body.razorpayPaymentId, { maxLength: 256 });
    const razorpaySignature = normalizeString(req.body.razorpaySignature, { maxLength: 512 });

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'razorpayOrderId, razorpayPaymentId, and razorpaySignature are required' });
    }

    const isValid = verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    const orderRef = db().collection('orders').doc(orderId);
    const now = new Date().toISOString();
    const result = await db().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) return { error: 'not-found' as const };
      const data = snapshot.data()!;
      if (data.buyerId !== req.user!.id) return { error: 'forbidden' as const };
      if (data.paymentProvider !== 'razorpay' || data.razorpayOrderId !== razorpayOrderId) {
        return { error: 'mismatch' as const };
      }
      if (!canVerifyPayment(data, req.user!.id, razorpayOrderId, razorpayPaymentId)) {
        return { error: 'conflict' as const };
      }
      if (data.status === 'confirmed') return { data, newlyConfirmed: false };

      const updates = {
        status: 'confirmed',
        paidAt: data.paidAt || now,
        razorpayPaymentId,
        razorpaySignature,
        updatedAt: now,
      };
      transaction.update(orderRef, updates);
      return { data: { ...data, ...updates }, newlyConfirmed: true };
    });

    if ('error' in result) {
      const status = result.error === 'not-found' ? 404
        : result.error === 'forbidden' ? 403
          : result.error === 'mismatch' ? 400 : 409;
      const message = result.error === 'not-found' ? 'Order not found'
        : result.error === 'forbidden' ? 'Not authorized'
          : result.error === 'mismatch' ? 'Payment does not match this order'
            : 'Order is not awaiting this payment';
      return res.status(status).json({ message });
    }
    if (result.newlyConfirmed) await recordOrderSettlement(orderId, result.data);

    res.json({
      success: true,
      order: { id: orderId, ...result.data, tracking: buildTracking(result.data) },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error verifying payment:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// GET /orders/my and /orders/me — buyer's orders, newest first
const getBuyerOrdersHandler = async (req: Request, res: Response) => {
  try {
    const snapshot = await db()
      .collection('orders')
      .where('buyerId', '==', req.user!.id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data, tracking: buildTracking(data) };
    });

    res.json({ orders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching orders:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

ordersRouter.get('/my', authMiddleware, requireRegistered, getBuyerOrdersHandler);
ordersRouter.get('/me', authMiddleware, requireRegistered, getBuyerOrdersHandler);

// GET /orders/brand — brand's incoming orders to fulfill
ordersRouter.get('/brand', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const snapshot = await db()
      .collection('orders')
      .where('brandId', '==', req.user!.id)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data, tracking: buildTracking(data) };
    });

    res.json({ orders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching brand orders:', message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /orders/:id/fulfillment — brand updates fulfillment status & courier tracking
ordersRouter.patch('/:id/fulfillment', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const id = normalizeDocumentId(req.params.id, 'Order id');
    const orderRef = db().collection('orders').doc(id);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return res.status(404).json({ message: 'Order not found' });

    const data = orderDoc.data()!;
    if (data.brandId !== req.user!.id) return res.status(403).json({ message: 'Not authorized' });

    const status = normalizeString(req.body.status, { maxLength: 40 });
    const validStatuses = ['packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const courierName = normalizeString(req.body.courierName, { maxLength: 100, allowEmpty: true });
    const trackingNumber = normalizeString(req.body.trackingNumber, { maxLength: 100, allowEmpty: true });

    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      status,
      updatedAt: now,
    };
    if (courierName !== undefined) updates.courierName = courierName || null;
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber || null;
    if (status === 'packed' && !data.packedAt) updates.packedAt = now;
    if (status === 'shipped' && !data.shippedAt) updates.shippedAt = now;
    if (status === 'out_for_delivery' && !data.outForDeliveryAt) updates.outForDeliveryAt = now;
    if (status === 'delivered' && !data.deliveredAt) updates.deliveredAt = now;

    await orderRef.update(updates);
    const updated = await orderRef.get();
    const updatedData = updated.data()!;

    res.json({ order: { id: updated.id, ...updatedData, tracking: buildTracking(updatedData) } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// GET /orders/:id — single order with tracking timeline (buyer or brand)
ordersRouter.get('/:id', authMiddleware, requireRegistered, async (req: Request, res: Response) => {
  try {
    const id = normalizeDocumentId(req.params.id, 'Order id');
    const doc = await db().collection('orders').doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: 'Order not found' });

    const data = doc.data()!;
    if (data.buyerId !== req.user!.id && data.brandId !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json({ order: { id: doc.id, ...data, tracking: buildTracking(data) } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

/**
 * Razorpay webhook handler — mounted in app.ts with a raw body parser
 */
export async function razorpayWebhookHandler(req: Request, res: Response) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
      return res.status(503).json({ message: 'Webhook not configured' });
    }

    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    const isValid = verifyWebhookSignature(rawBody, signature, secret);
    if (!isValid) {
      console.warn('Invalid Razorpay webhook signature');
      return res.status(403).json({ message: 'Invalid webhook signature' });
    }

    const payload = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody);
    const event = payload?.event ?? '';
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;

    const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;
    const notesOrderId = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;
    const receiptOrderId = orderEntity?.receipt;

    // Resolve order document reference by internal ID or Razorpay Order ID
    let orderDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    let orderRef: FirebaseFirestore.DocumentReference | null = null;

    const targetOrderId = notesOrderId || receiptOrderId;
    if (targetOrderId && typeof targetOrderId === 'string') {
      const ref = db().collection('orders').doc(targetOrderId);
      const doc = await ref.get();
      if (doc.exists) {
        orderDoc = doc;
        orderRef = ref;
      }
    }

    if (!orderDoc && rzpOrderId) {
      const snapshot = await db()
        .collection('orders')
        .where('razorpayOrderId', '==', rzpOrderId)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        orderDoc = snapshot.docs[0];
        orderRef = orderDoc.ref;
      }
    }

    if (orderDoc && orderRef && orderDoc.data()?.razorpayOrderId === rzpOrderId) {
      const now = new Date().toISOString();

      if (event === 'payment.captured' || event === 'order.paid') {
        const confirmation = await db().runTransaction(async (transaction) => {
          const snapshot = await transaction.get(orderRef);
          if (!snapshot.exists) return null;
          const currentData = snapshot.data()!;
          if (currentData.razorpayOrderId !== rzpOrderId || currentData.status !== 'pending_payment') return null;
          const updates = {
            status: 'confirmed',
            paidAt: currentData.paidAt || now,
            razorpayPaymentId: paymentId || currentData.razorpayPaymentId || null,
            updatedAt: now,
          };
          transaction.update(orderRef, updates);
          return { ...currentData, ...updates };
        });
        if (confirmation) await recordOrderSettlement(orderDoc.id, confirmation);
      } else if (event === 'payment.failed') {
        await db().runTransaction(async (transaction) => {
          const snapshot = await transaction.get(orderRef);
          if (snapshot.exists && snapshot.data()?.razorpayOrderId === rzpOrderId && snapshot.data()?.status === 'pending_payment') {
            transaction.update(orderRef, { status: 'failed', updatedAt: now });
          }
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error: unknown) {
    console.error('Error handling Razorpay webhook:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
