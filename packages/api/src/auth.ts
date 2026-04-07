import { api } from './client';
import type { User, Gender } from '@reelbazaar/config';

interface RegisterPayload {
  firebaseUid: string;
  email: string | null;
  name: string;
  username?: string;
  phone?: string;
  gender?: Gender;
  dob?: string;
  country?: string;
  websiteLink?: string;
  brandName?: string;
  productCategories?: string[];
  interests?: string[];
  themePreference?: 'dark' | 'light';
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<{ user: User; token: string }>('/auth/register', { body: data }),

  getProfile: () =>
    api.get<{ user: User }>('/auth/me'),

  updateProfile: (data: Partial<Omit<RegisterPayload, 'firebaseUid'>>) =>
    api.patch<{ user: User }>('/auth/me', { body: data }),
};
