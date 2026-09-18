import { api } from './client';

export interface Comment {
  id: string;
  reelId: string;
  authorId: string;
  text: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export const commentsApi = {
  getForReel: (reelId: string, cursor?: string) =>
    api.get<{ comments: Comment[]; hasMore: boolean; nextCursor?: string }>(
      `/comments/reel/${reelId}`,
      cursor ? { params: { cursor } } : undefined
    ),

  post: (reelId: string, text: string) =>
    api.post<{ comment: Comment }>(`/comments/reel/${reelId}`, { body: { text } }),

  delete: (commentId: string) => api.delete<void>(`/comments/${commentId}`),
};
