import { api, uploadFile, type UploadSource } from './client';
import type { BrandProduct } from '@reelbazaar/config';

export type Product = BrandProduct;

export interface CreateProductInput {
  name: string;
  description?: string;
  category: string;
  price: number | string;
  originalPrice?: number | string;
  commissionRate?: number | string;
  inventoryCount?: number | string;
  productLink?: string;
  sku?: string;
  inStock?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  price?: number | string;
  originalPrice?: number | string;
  commissionRate?: number | string;
  inventoryCount?: number | string;
  productLink?: string;
  sku?: string;
  inStock?: boolean;
}

export const productsApi = {
  getCatalog: (params?: { cursor?: string; brandId?: string; category?: string; q?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.brandId) query.set('brandId', params.brandId);
    if (params?.category) query.set('category', params.category);
    if (params?.q) query.set('q', params.q);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return api.get<{ products: Product[]; hasMore: boolean; nextCursor?: string }>(
      `/products${qs ? `?${qs}` : ''}`
    );
  },

  getById: (id: string) => api.get<{ product: Product }>(`/products/${id}`),
  getProductById: (id: string) => api.get<{ product: Product }>(`/products/${id}`),

  getBrandProducts: (brandId: string) =>
    api.get<{ products: Product[] }>(`/products/brand/${brandId}`),

  searchProducts: (q: string) =>
    api.get<{ products: Product[] }>(`/products?q=${encodeURIComponent(q)}`),

  create: (
    fields: CreateProductInput,
    image?: UploadSource | null,
    onProgress?: (percent: number) => void
  ): Promise<{ product: Product }> => {
    const cleanFields = Object.fromEntries(
      Object.entries(fields)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ) as Record<string, string>;
    if (image) {
      return uploadFile('/products', image, cleanFields, onProgress) as unknown as Promise<{
        product: Product;
      }>;
    }
    return api.post<{ product: Product }>('/products', { body: cleanFields });
  },

  createProduct: (
    fields: CreateProductInput,
    image?: UploadSource | null,
    onProgress?: (percent: number) => void
  ) => productsApi.create(fields, image, onProgress),

  updateProduct: (
    id: string,
    fields: UpdateProductInput,
    image?: UploadSource | null
  ): Promise<{ product: Product }> => {
    const cleanFields = Object.fromEntries(
      Object.entries(fields)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ) as Record<string, string>;
    if (image) {
      return uploadFile(`/products/${id}`, image, cleanFields) as unknown as Promise<{
        product: Product;
      }>;
    }
    return api.put<{ product: Product }>(`/products/${id}`, { body: cleanFields });
  },

  toggleStock: (id: string, inStock: boolean) =>
    api.put<{ product: Product }>(`/products/${id}`, { body: { inStock } }),

  deleteProduct: (id: string) => api.delete<void>(`/products/${id}`),
  remove: (id: string) => api.delete<void>(`/products/${id}`),
};
