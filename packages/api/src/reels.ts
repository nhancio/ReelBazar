import { api, uploadFile } from './client';
import type { Reel, Category } from '@reelbazaar/config';

interface CreateReelPayload {
  productLink: string;
  category: Category;
  caption?: string;
  brandTag?: string;
}

interface ReelsResponse {
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

  create: (file: File, data: CreateReelPayload, onProgress?: (p: number) => void) =>
    uploadFile('/reels/upload', file, {
      productLink: data.productLink,
      category: data.category,
      ...(data.caption && { caption: data.caption }),
      ...(data.brandTag && { brandTag: data.brandTag }),
    }, onProgress),

  like: (id: string) =>
    api.post<{ liked: boolean }>(`/reels/${id}/like`),

  save: (id: string) =>
    api.post<{ saved: boolean }>(`/reels/${id}/save`),

  view: (id: string) =>
    api.post<void>(`/reels/${id}/view`),

  delete: (id: string) =>
    api.delete<void>(`/reels/${id}`),
};
