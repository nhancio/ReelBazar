export const APP_NAME = 'Rava';

/**
 * Three bundlers, three env mechanisms, and each one only substitutes a *literal* member
 * expression: Metro rewrites `process.env.EXPO_PUBLIC_*`, Vite rewrites
 * `import.meta.env.VITE_*`, webpack/Next rewrites `process.env.NEXT_PUBLIC_*`. A dynamic
 * `process.env[key]` lookup is left alone and reads undefined in the bundle, so the names
 * have to be spelled out below rather than looked up.
 *
 * Both maps are also lazily guarded, because the identifier itself is missing in the other
 * bundlers' output: `process` is undefined in a Vite browser build, and `import.meta` is a
 * syntax error outside a module. Touching either unguarded at module scope throws on import
 * and takes the whole app down with a blank screen.
 */
const PROCESS_ENV: Record<string, string | undefined> =
  typeof process === 'undefined' || !process.env
    ? {}
    : {
        EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_APP_ORIGIN: process.env.EXPO_PUBLIC_APP_ORIGIN,
        EXPO_PUBLIC_LANDING_ORIGIN: process.env.EXPO_PUBLIC_LANDING_ORIGIN,
        EXPO_PUBLIC_RAZORPAY_KEY_ID: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_APP_ORIGIN: process.env.NEXT_PUBLIC_APP_ORIGIN,
        NEXT_PUBLIC_LANDING_ORIGIN: process.env.NEXT_PUBLIC_LANDING_ORIGIN,
        NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      };

const getViteEnv = (): Record<string, string | undefined> => {
  try {
    // Avoid raw import.meta token so CommonJS tsc builds compile cleanly
    const meta = new Function('return typeof import.meta !== "undefined" ? import.meta : undefined')();
    return meta?.env || {};
  } catch {
    return {};
  }
};

const VITE_ENV: Record<string, string | undefined> = getViteEnv();

const getEnvVar = (key: string): string | undefined => PROCESS_ENV[key] || VITE_ENV[key];

export const RAZORPAY_KEY_ID =
  getEnvVar('EXPO_PUBLIC_RAZORPAY_KEY_ID') ||
  getEnvVar('NEXT_PUBLIC_RAZORPAY_KEY_ID') ||
  getEnvVar('VITE_RAZORPAY_KEY_ID') ||
  '';

export const API_BASE_URL =
  getEnvVar('EXPO_PUBLIC_API_URL') ||
  getEnvVar('NEXT_PUBLIC_API_URL') ||
  getEnvVar('VITE_API_URL') ||
  '/api/v1';

/** Public web app (SPA / Expo web export). */
export const APP_ORIGIN =
  getEnvVar('EXPO_PUBLIC_APP_ORIGIN') ||
  getEnvVar('NEXT_PUBLIC_APP_ORIGIN') ||
  getEnvVar('VITE_APP_ORIGIN') ||
  'https://app.rava.one';

/** Marketing / landing site. */
export const LANDING_ORIGIN =
  getEnvVar('EXPO_PUBLIC_LANDING_ORIGIN') ||
  getEnvVar('NEXT_PUBLIC_LANDING_ORIGIN') ||
  getEnvVar('VITE_LANDING_ORIGIN') ||
  'https://rava.one';

export const CATEGORIES = ['Men', 'Women', 'Kids', 'Accessories', 'Footwear', 'Beauty'] as const;
export type Category = (typeof CATEGORIES)[number];

export const USER_TYPES = ['influencer', 'viewer', 'brand'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_TYPE_LABELS: Record<UserType, string> = {
  influencer: 'Promote brands in reels, earn money',
  viewer: 'Explore & Shop Trends',
  brand: 'Promote Your Products',
};

export const PERSONAS = ['Creator', 'Brand', 'User'] as const;
export type Persona = (typeof PERSONAS)[number];

export const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45+'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export interface User {
  id: string;
  email: string | null;
  name: string;
  username?: string | null;
  userType?: UserType;
  persona?: Persona;
  phone?: string | null;
  gender?: Gender | null;
  dob?: string | null;
  country?: string | null;
  websiteLink?: string | null;
  brandName?: string | null;
  productCategories?: Category[];
  interests?: string[];
  avatarUrl?: string | null;
  firebaseUid?: string;
  createdAt?: string;
  updatedAt?: string;
  followersCount?: number;
  followingCount?: number;
  themePreference?: 'dark' | 'light';
  streakCount?: number;
  longestStreak?: number;
  lastCheckinDate?: string;
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
  brandId?: string | null;
  productId?: string;
  product?: BrandProduct;
  commissionRate?: number;
  ordersCount?: number;
  likesCount: number;
  viewsCount: number;
  sharesCount: number;
  clicksCount: number;
  savesCount: number;
  commentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandProduct {
  id: string;
  brandId: string;
  brandName?: string | null;
  brandAvatarUrl?: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  images?: string[];
  category: Category | string;
  price: number;
  originalPrice?: number | null;
  currency: 'INR' | string;
  commissionRate: number;
  inStock: boolean;
  inventoryCount?: number;
  productLink?: string | null;
  sku?: string | null;
  isSample?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const SAMPLE_PRODUCT: BrandProduct = {
  id: 'sample-rava-tee',
  brandId: 'rava-demo-brand',
  brandName: 'Rava Studio',
  brandAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  name: 'Rava Signature Oversized Tee',
  description:
    'Heavyweight 240 GSM cotton oversized tee with the Rava monogram. Unisex fit, pre-shrunk, made in India. High quality streetwear crafted for creator lifestyle.',
  imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
  images: [
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
  ],
  category: 'Men',
  price: 999,
  originalPrice: 1499,
  currency: 'INR',
  commissionRate: 15,
  inStock: true,
  inventoryCount: 100,
  productLink: 'https://rava.one/products/sample-tee',
  sku: 'RAVA-TEE-001',
  isSample: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export interface OrderTrackingStep {
  status: string;
  label: string;
  at: string;
  done: boolean;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | string;

export interface Order {
  id: string;
  buyerId: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  shippingAddress?: ShippingAddress | string | null;
  productId: string;
  productName: string;
  productImageUrl?: string | null;
  quantity?: number;
  brandId: string;
  brandName?: string | null;
  reelId?: string | null;
  creatorId?: string | null;
  amount: number;
  currency: 'INR' | string;
  platformFee?: number;
  creatorCommission?: number;
  brandPayout?: number;
  paymentProvider: 'razorpay' | 'demo' | string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  status: OrderStatus;
  courierName?: string | null;
  trackingNumber?: string | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  tracking?: { currentStatus: string; steps: OrderTrackingStep[] };
  createdAt: string;
  updatedAt: string;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  userType?: 'creator' | 'brand' | 'influencer' | 'viewer' | string;
  amount: number;
  currency: 'INR' | string;
  payoutMethod: 'upi' | 'bank_transfer';
  upiId?: string | null;
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  } | null;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

export interface BrandMatchPreference {
  id?: string;
  userId: string;
  gender: Gender | 'Any';
  ageGroup: AgeGroup | 'Any';
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductListing {
  id: string;
  brandId: string;
  imageUrl: string;
  gender: Gender | 'Any';
  ageGroup: AgeGroup | 'Any';
  productName?: string | null;
  productLink?: string | null;
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
