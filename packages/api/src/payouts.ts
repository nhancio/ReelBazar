import { api } from './client';
import type { PayoutRequest } from '@reelbazaar/config';

export type { PayoutRequest };

export interface ReelEarnings {
  reelId: string;
  caption: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  createdAt: string | null;
  views: number;
  clicks: number;
  viewEarnings: number;
  clickEarnings: number;
  salesCount?: number;
  salesCommissions?: number;
  totalEarnings: number;
}

export interface PayoutsSummary {
  currency: string;
  rates: { perView: number; perClick: number };
  totals: {
    reels: number;
    views: number;
    clicks: number;
    viewEarnings: number;
    clickEarnings: number;
    salesCount?: number;
    salesCommissions?: number;
    totalEarnings: number;
    paidOut: number;
    pendingBalance: number;
  };
  reels: ReelEarnings[];
  payoutHistory: Array<{
    id: string;
    amount: number;
    createdAt: string;
    note?: string;
    status?: string;
    payoutMethod?: string;
    upiId?: string;
  }>;
}

export interface RequestPayoutInput {
  amount: number;
  payoutMethod: 'upi' | 'bank_transfer';
  upiId?: string;
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
}

export const payoutsApi = {
  getMe: () => api.get<PayoutsSummary>('/payouts/me'),

  requestPayout: (data: RequestPayoutInput) =>
    api.post<{ payoutRequest: PayoutRequest; message: string }>('/payouts/request', {
      body: data,
    }),

  getPayoutHistory: () =>
    api.get<{ payoutHistory: PayoutRequest[] }>('/payouts/history'),
};
