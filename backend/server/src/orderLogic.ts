const TRACKING_STEPS = [
  { status: 'confirmed', label: 'Order confirmed', timestamp: 'paidAt' },
  { status: 'packed', label: 'Packed at warehouse', timestamp: 'packedAt' },
  { status: 'shipped', label: 'Shipped with courier', timestamp: 'shippedAt' },
  { status: 'out_for_delivery', label: 'Out for delivery', timestamp: 'outForDeliveryAt' },
  { status: 'delivered', label: 'Delivered', timestamp: 'deliveredAt' },
] as const;

export function buildTracking(order: Record<string, any>) {
  if (order.status === 'cancelled' || order.status === 'failed') {
    const label = order.status === 'cancelled' ? 'Order cancelled' : 'Payment failed';
    return {
      currentStatus: order.status,
      steps: [{ status: order.status, label, at: order.updatedAt || order.createdAt, done: true }],
    };
  }

  const status = order.status || 'pending_payment';
  if (status === 'pending_payment' || !order.paidAt) {
    return {
      currentStatus: 'pending_payment',
      steps: [{ status: 'pending_payment', label: 'Awaiting payment', at: order.createdAt, done: false }],
    };
  }
  const statusIndex = TRACKING_STEPS.findIndex((step) => step.status === status);
  return {
    currentStatus: status,
    steps: TRACKING_STEPS.map((step, index) => ({
      status: step.status,
      label: step.label,
      at: order[step.timestamp] || (step.status === 'confirmed' ? order.paidAt : null) || null,
      done: statusIndex >= 0 && index <= statusIndex,
    })),
  };
}

export function canVerifyPayment(
  order: Record<string, any>,
  buyerId: string,
  razorpayOrderId: string,
  paymentId: string,
): boolean {
  return order.buyerId === buyerId
    && order.paymentProvider === 'razorpay'
    && order.razorpayOrderId === razorpayOrderId
    && (order.status === 'pending_payment'
      || (order.status === 'confirmed' && order.razorpayPaymentId === paymentId));
}

export function demoPaymentAllowed(environment: Record<string, string | undefined>): boolean {
  return !isProductionRuntime(environment);
}

export function isProductionRuntime(environment: Record<string, string | undefined>): boolean {
  return environment.NODE_ENV === 'production' || Boolean(environment.K_SERVICE);
}
