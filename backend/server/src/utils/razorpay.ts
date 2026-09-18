import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Razorpay payments wrapper.
 *
 * When RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured, checkouts
 * generate Razorpay Orders and payments are captured and verified via
 * signature verification and webhooks.
 *
 * Without keys configured, the app runs in "demo payments" mode: checkout
 * marks the order as confirmed immediately so the full buy → track flow
 * remains demoable.
 */

let client: Razorpay | null = null;

export function razorpayEnabled(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

export function razorpay(): Razorpay {
  if (!client) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
    client = new Razorpay({
      key_id,
      key_secret,
    });
  }
  return client;
}

export interface CreateRazorpayOrderInput {
  amountInRupees: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string | number>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

/**
 * Create an order in Razorpay.
 * Amount is converted to subunits (paise for INR).
 */
export async function createRazorpayOrder(input: CreateRazorpayOrderInput): Promise<RazorpayOrderResult> {
  const amountInPaise = Math.round(input.amountInRupees * 100);
  const order = await razorpay().orders.create({
    amount: amountInPaise,
    currency: input.currency || 'INR',
    receipt: input.receipt.slice(0, 40),
    notes: input.notes,
  });

  return {
    id: order.id,
    amount: typeof order.amount === 'number' ? order.amount : Number(order.amount),
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
  };
}

/**
 * Verify webhook signature sent by Razorpay in `x-razorpay-signature` header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !signature) return false;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

/**
 * Verify payment signature sent from client after standard Razorpay checkout.
 */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret?: string;
}): boolean {
  const secret = input.secret || process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !input.razorpaySignature) return false;
  try {
    const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(input.razorpaySignature, 'utf8');
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}
