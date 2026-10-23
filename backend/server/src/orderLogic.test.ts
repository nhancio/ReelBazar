import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTracking, canVerifyPayment, demoPaymentAllowed, isProductionRuntime } from './orderLogic';

test('tracking only advances from recorded fulfillment status', () => {
  const tracking = buildTracking({ status: 'confirmed', paidAt: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(tracking.steps.map((step) => step.done), [true, false, false, false, false]);
});

test('payment verification is bound to the buyer, provider, order, and replayed payment', () => {
  const order = {
    buyerId: 'buyer',
    paymentProvider: 'razorpay',
    razorpayOrderId: 'order_1',
    status: 'pending_payment',
  };
  assert.equal(canVerifyPayment(order, 'buyer', 'order_1', 'pay_1'), true);
  assert.equal(canVerifyPayment(order, 'other', 'order_1', 'pay_1'), false);
  assert.equal(canVerifyPayment(order, 'buyer', 'order_2', 'pay_1'), false);
  assert.equal(canVerifyPayment({ ...order, paymentProvider: 'demo' }, 'buyer', 'order_1', 'pay_1'), false);
  assert.equal(canVerifyPayment({ ...order, status: 'confirmed', razorpayPaymentId: 'pay_1' }, 'buyer', 'order_1', 'pay_1'), true);
  assert.equal(canVerifyPayment({ ...order, status: 'confirmed', razorpayPaymentId: 'pay_2' }, 'buyer', 'order_1', 'pay_1'), false);
});

test('demo payments are disabled in production and Cloud Functions', () => {
  assert.equal(demoPaymentAllowed({ NODE_ENV: 'development' }), true);
  assert.equal(demoPaymentAllowed({ NODE_ENV: 'production' }), false);
  assert.equal(demoPaymentAllowed({ NODE_ENV: 'development', K_SERVICE: 'api' }), false);
  assert.equal(isProductionRuntime({ NODE_ENV: 'development', K_SERVICE: 'api' }), true);
});
