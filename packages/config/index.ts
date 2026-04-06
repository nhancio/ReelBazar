export const APP_NAME = 'ReelBazaar';

const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  return undefined;
};

export const API_BASE_URL = getEnvVar('NEXT_PUBLIC_API_URL') || getEnvVar('VITE_API_URL') || 'https://reelbazar-backend.vercel.app/api';

export const CATEGORIES = ['Men', 'Women', 'Kids'] as const;
export type Category = (typeof CATEGORIES)[number];

export const USER_TYPES = ['influencer', 'viewer', 'brand'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_TYPE_LABELS: Record<UserType, string> = {
  influencer: 'Promote brands in reels, earn money',
  viewer: 'Explore & Shop Trends',
  brand: 'Promote Your Products',
};

export const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45+'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export interface User {
  id: string;
  email: string | null;
  name: string;
  userType?: UserType;
  phone?: string | null;
  gender?: Gender | null;
  dob?: string | null;
  country?: string | null;
  websiteLink?: string | null;
  brandName?: string | null;
  productCategories?: Category[];
  avatarUrl?: string | null;
  firebaseUid?: string;
  createdAt?: string;
  updatedAt?: string;
  followersCount?: number;
  followingCount?: number;
}

export interface Reel {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  productLink: string;
  category: Category;
  creatorId: string;
  creator?: User;
  brandTag?: string | null;
  likesCount: number;
  viewsCount: number;
  savesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Collaboration {
  id: string;
  brandId: string;
  influencerId: string;
  brand?: User;
  influencer?: User;
  score: number;
  status: 'suggested' | 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
