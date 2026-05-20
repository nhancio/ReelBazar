import { api } from './client';
import type { AgeGroup, Collaboration, Gender, ProductListing, Reel, User } from '@reelbazaar/config';

export interface BrandMatch {
  brand: User;
  score: number;
  products: Array<{
    id: string;
    name?: string;
    imageUrl?: string;
    productLink?: string;
    price?: string;
    category?: string;
  }>;
  reason: string;
}

export interface InfluencerMatch {
  influencer: User;
  score: number;
  reason: string;
}

export interface BrandSearchPayload {
  gender: Gender | 'Any';
  ageGroup: AgeGroup | 'Any';
}

export interface ProductListingPayload extends BrandSearchPayload {
  imageUrl: string;
  productName?: string;
  productLink?: string;
}

export interface DealPayload {
  brandId: string;
  influencerId: string;
  status: 'accepted' | 'declined';
  productListingId?: string;
  conversationId?: string;
}

export const collaborationsApi = {
  getSuggestions: () =>
    api.get<{ collaborations: Collaboration[] }>('/collaborations/suggestions'),

  respond: (id: string, status: 'accepted' | 'declined') =>
    api.patch<{ collaboration: Collaboration }>(`/collaborations/${id}`, { body: { status } }),

  getMyCollaborations: () =>
    api.get<{ collaborations: Collaboration[] }>('/collaborations'),

  saveBrandSearch: (data: BrandSearchPayload) =>
    api.post<{ preference: BrandSearchPayload & { id: string; userId: string } }>('/collaborations/brand-search', { body: data }),

  getBrandMatches: () =>
    api.get<{ matches: BrandMatch[] }>('/collaborations/brand-matches'),

  createProductListing: (data: ProductListingPayload) =>
    api.post<{ listing: ProductListing }>('/collaborations/product-listings', { body: data }),

  getProductListings: () =>
    api.get<{ listings: ProductListing[] }>('/collaborations/product-listings'),

  getInfluencerMatches: (listingId: string) =>
    api.get<{ matches: InfluencerMatch[] }>(`/collaborations/product-listings/${listingId}/influencer-matches`),

  setDeal: (data: DealPayload) =>
    api.post<{ collaboration: Collaboration }>('/collaborations/deals', { body: data }),

  getDealBrands: () =>
    api.get<{ brands: User[] }>('/collaborations/deal-brands'),

  getBrandPerformance: (brandId: string) =>
    api.get<{ reels: Reel[] }>(`/collaborations/brand-performance/${brandId}`),
};
