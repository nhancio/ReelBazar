import { api, uploadFile } from './client';
import type { User } from '@reelbazaar/config';

export const usersApi = {
  getById: (id: string) =>
    api.get<{ user: User }>(`/users/${id}`),

  search: (query: string) =>
    api.get<{ users: User[] }>('/users/search', { params: { q: query } }),

  toggleFollow: (id: string) =>
    api.post<{ following: boolean }>(`/users/${id}/follow`),

  getFollowing: () =>
    api.get<{ followingIds: string[] }>('/users/me/following'),

  updateAvatar: async (file: File) => {
    const body = await uploadFile('/users/me/avatar', file);
    const avatarUrl =
      (body as { avatarUrl?: string; url?: string }).avatarUrl ??
      (body as { url?: string }).url;
    if (!avatarUrl) throw new Error('Upload succeeded but no avatar URL returned');
    return { avatarUrl };
  },

  updateProfile: (data: { name?: string; username?: string; productCategories?: string[]; interests?: string[]; themePreference?: 'dark' | 'light' }) =>
    api.put<{ user: User }>('/users/me', { body: data }),
};
