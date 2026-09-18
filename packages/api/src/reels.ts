import { api, uploadFile, type UploadSource } from './client';
import type { Reel, Category } from '@reelbazaar/config';

export interface CreateReelPayload {
  productLink?: string;
  category: Category;
  caption?: string;
  brandTag?: string;
  brandId?: string;
  productId?: string;
  commissionRate?: number;
}

export interface ReelsResponse {
  reels: Reel[];
  nextCursor?: string;
  hasMore: boolean;
}

export const reelsApi = {
  getFeed: (category?: Category, cursor?: string) =>
    api.get<ReelsResponse>('/reels', {
      params: {
        ...(category && { category }),
        ...(cursor && { cursor }),
        limit: '10',
      },
    }),

  /**
   * Relevance search, used by the Search tab and the AI assistant. Scoring happens
   * server-side; `terms` comes back so the UI can show what the query was understood as.
   */
  search: (q: string, limit = 20) =>
    api.get<{ reels: Reel[]; query: string; terms: string[]; matched: number }>(
      '/reels/search',
      { params: { q, limit: String(limit) } }
    ),

  getById: (id: string) =>
    api.get<{ reel: Reel }>(`/reels/${id}`),

  getUserReels: (userId: string, cursor?: string) =>
    api.get<ReelsResponse>(`/reels/user/${userId}`, {
      params: { ...(cursor && { cursor }), limit: '10' },
    }),

  getSavedReels: (userId: string, cursor?: string) =>
    api.get<ReelsResponse>(`/reels/saved/${userId}`, {
      params: { ...(cursor && { cursor }), limit: '10' },
    }),

  // `UploadSource` is `File` on web and a `{ uri, name, type }` descriptor on iOS/Android,
  // which is what expo-image-picker and expo-camera hand back.
  create: (file: UploadSource, data: CreateReelPayload, onProgress?: (p: number) => void) =>
    uploadFile(
      '/reels/upload',
      file,
      {
        ...(data.productLink && { productLink: data.productLink }),
        category: data.category,
        ...(data.caption && { caption: data.caption }),
        ...(data.brandTag && { brandTag: data.brandTag }),
        ...(data.brandId && { brandId: data.brandId }),
        ...(data.productId && { productId: data.productId }),
        ...(data.commissionRate !== undefined && { commissionRate: String(data.commissionRate) }),
      },
      onProgress
    ),

  like: (id: string) =>
    api.post<{ liked: boolean }>(`/reels/${id}/like`),

  save: (id: string) =>
    api.post<{ saved: boolean }>(`/reels/${id}/save`),

  view: (id: string) =>
    api.post<void>(`/reels/${id}/view`),

  share: (id: string) =>
    api.post<{ counted: boolean; sharesCount?: number }>(`/reels/${id}/share`),

  click: (id: string) =>
    api.post<void>(`/reels/${id}/click`),

  delete: (id: string) =>
    api.delete<void>(`/reels/${id}`),
};
