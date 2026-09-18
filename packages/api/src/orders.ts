import { api } from './client';
import type { Order, OrderTrackingStep, ShippingAddress, OrderStatus } from '@reelbazaar/config';

export type { Order, OrderTrackingStep, ShippingAddress, OrderStatus };

export interface CheckoutInput {
  productId: string;
  reelId?: string;
  creatorId?: string;
  quantity?: number;
  shippingAddress?: ShippingAddress | string;
  buyerName?: string;
  buyerPhone?: string;
}

export interface CheckoutResponse {
  order: Order;
  razorpayOrderId?: string | null;
  keyId?: string | null;
  amount: number;
  currency: string;
  paymentUrl: string;
  demoMode: boolean;
}

export interface VerifyPaymentInput {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  order: Order;
}

export interface UpdateFulfillmentInput {
  status: 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  courierName?: string;
  trackingNumber?: string;
}

export const ordersApi = {
  checkout: (input: string | CheckoutInput) => {
    const payload = typeof input === 'string' ? { productId: input } : input;
    return api.post<CheckoutResponse>('/orders/checkout', {
      body: payload,
    });
  },

  verifyPayment: (data: VerifyPaymentInput) =>
    api.post<VerifyPaymentResponse>('/orders/verify', {
      body: data,
    }),

  getMine: () => api.get<{ orders: Order[] }>('/orders/me'),
  getBuyerOrders: () => api.get<{ orders: Order[] }>('/orders/my'),

  getBrandOrders: () => api.get<{ orders: Order[] }>('/orders/brand'),

  getById: (id: string) => api.get<{ order: Order }>(`/orders/${id}`),
  getOrderById: (id: string) => api.get<{ order: Order }>(`/orders/${id}`),

  updateFulfillment: (id: string, data: UpdateFulfillmentInput) =>
    api.patch<{ order: Order }>(`/orders/${id}/fulfillment`, {
      body: data,
    }),
};
