import { Router, Request, Response } from 'express';
import { db, storage } from '../utils/firebase';
import { authMiddleware, requireBrand, requireRegistered } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  ValidationError,
  normalizeDocumentId,
  normalizeOptionalUrl,
  normalizeString,
  parseIntegerQuery,
} from '../utils/validation';
import { SAMPLE_PRODUCT } from '../constants/sampleProduct';
import { isProductionRuntime } from '../orderLogic';

export { SAMPLE_PRODUCT };

export const productsRouter = Router();

const createProductRateLimit = createRateLimit({
  keyPrefix: 'product-create',
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many product listings. Please try again later.',
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

const VALID_CATEGORIES = ['Men', 'Women', 'Kids', 'Accessories', 'Footwear', 'Beauty'];

async function enrichProductsWithBrands(products: any[]) {
  const brandIds = [...new Set(products.map((p) => p.brandId).filter(Boolean))];
  if (!brandIds.length) return products;

  const brandMap = new Map<string, { brandName: string; avatarUrl?: string | null }>();
  await Promise.all(
    brandIds.map(async (id) => {
      try {
        const userDoc = await db().collection('users').doc(id).get();
        if (userDoc.exists) {
          const data = userDoc.data()!;
          brandMap.set(id, {
            brandName: data.brandName || data.name || 'Brand',
            avatarUrl: data.avatarUrl || null,
          });
        }
      } catch {
        /* continue */
      }
    })
  );

  return products.map((p) => {
    const brand = brandMap.get(p.brandId);
    return {
      ...p,
      brandName: brand?.brandName || p.brandName || 'Brand',
      brandAvatarUrl: brand?.avatarUrl || p.brandAvatarUrl || null,
    };
  });
}

// GET /products — public catalog with category/search/brand filters & cursor pagination
productsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { cursor, limit = '20', brandId, category, q } = req.query;
    const take = parseIntegerQuery(limit, 20, 50);

    let query: FirebaseFirestore.Query = db().collection('products');
    if (brandId) {
      query = query.where('brandId', '==', normalizeDocumentId(brandId, 'Brand id'));
    }
    if (category) {
      const safeCategory = normalizeString(category, { maxLength: 30 });
      query = query.where('category', '==', safeCategory);
    }
    query = query.orderBy('createdAt', 'desc');

    if (cursor) {
      const cursorDoc = await db().collection('products').doc(normalizeDocumentId(cursor, 'Cursor')).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.limit(take + 1).get();
    let products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // In-memory text search filter if q is provided
    if (q) {
      const term = String(q).toLowerCase().trim();
      products = products.filter((p: any) =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        (p.brandName && p.brandName.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
    }

    const hasMore = products.length > take;
    if (hasMore) products = products.slice(0, take);

    // Keep the demo flow alive: an empty catalog still shows the sample product.
    if (products.length === 0 && !cursor && !brandId && !isProductionRuntime(process.env)) {
      products = [SAMPLE_PRODUCT];
    }

    const enriched = await enrichProductsWithBrands(products);

    res.json({
      products: enriched,
      hasMore,
      nextCursor: hasMore ? products[products.length - 1]?.id : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching products:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// GET /products/brand/:brandId — all products for a specific brand
productsRouter.get('/brand/:brandId', async (req: Request, res: Response) => {
  try {
    const brandId = normalizeDocumentId(req.params.brandId, 'Brand id');
    const snapshot = await db()
      .collection('products')
      .where('brandId', '==', brandId)
      .orderBy('createdAt', 'desc')
      .get();

    let products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    products = await enrichProductsWithBrands(products);

    res.json({ products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// GET /products/:id — public product detail
productsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = normalizeDocumentId(req.params.id, 'Product id');
    if (id === SAMPLE_PRODUCT.id && !isProductionRuntime(process.env)) {
      return res.json({ product: SAMPLE_PRODUCT });
    }

    const doc = await db().collection('products').doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: 'Product not found' });
    const product = { id: doc.id, ...doc.data() };
    const [enriched] = await enrichProductsWithBrands([product]);
    res.json({ product: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});

// POST /products — brands list a product (multipart with optional image or JSON)
productsRouter.post(
  '/',
  createProductRateLimit,
  authMiddleware,
  requireRegistered,
  requireBrand,
  imageUpload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const name = normalizeString(req.body.name, { minLength: 2, maxLength: 120 });
      const description = normalizeString(req.body.description, {
        maxLength: 2000,
        allowEmpty: true,
        preserveNewlines: true,
      });
      const category = normalizeString(req.body.category, { maxLength: 30 });
      const productLink = normalizeOptionalUrl(req.body.productLink);
      const sku = normalizeString(req.body.sku, { maxLength: 60, allowEmpty: true });

      if (!name || !category || !VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: `name and a valid category are required (${VALID_CATEGORIES.join(', ')})` });
      }

      const price = Number.parseFloat(req.body.price);
      if (!Number.isFinite(price) || price < 1 || price > 10_000_000) {
        return res.status(400).json({ message: 'price must be a number between 1 and 10000000' });
      }

      const originalPrice = req.body.originalPrice ? Number.parseFloat(req.body.originalPrice) : null;
      const commissionRate = req.body.commissionRate !== undefined ? Number.parseFloat(req.body.commissionRate) : 10;
      const inventoryCount = req.body.inventoryCount !== undefined ? Number.parseInt(req.body.inventoryCount, 10) : 50;
      const inStock = req.body.inStock !== undefined ? req.body.inStock === true || req.body.inStock === 'true' : true;

      let imageUrl: string | null = req.body.imageUrl || null;
      if (req.file) {
        const bucket = storage();
        const ext = req.file.mimetype.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
        const objectName = `products/${req.user!.id}/${uuidv4()}.${ext}`;
        const file = bucket.file(objectName);
        await file.save(req.file.buffer, {
          resumable: false,
          metadata: { contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000, immutable' },
        });
        await file.makePublic();
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${objectName}`;
      }

      const brandDoc = await db().collection('users').doc(req.user!.id).get();
      const brandData = brandDoc.data();
      const now = new Date().toISOString();
      const productData = {
        brandId: req.user!.id,
        brandName: brandData?.brandName || brandData?.name || 'Brand',
        brandAvatarUrl: brandData?.avatarUrl || null,
        name,
        description: description || null,
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
        productLink: productLink || null,
        sku: sku || null,
        category,
        price,
        originalPrice: originalPrice || null,
        currency: 'INR',
        commissionRate: Number.isFinite(commissionRate) ? commissionRate : 10,
        inStock,
        inventoryCount: Number.isFinite(inventoryCount) ? inventoryCount : 50,
        isSample: false,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await db().collection('products').add(productData);
      res.status(201).json({ product: { id: docRef.id, ...productData } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating product:', message);
      res.status(error instanceof ValidationError ? 400 : 500).json({
        message: error instanceof ValidationError ? message : 'Internal server error',
      });
    }
  }
);

// PUT /products/:id — brand updates product listing
productsRouter.put(
  '/:id',
  authMiddleware,
  requireRegistered,
  requireBrand,
  imageUpload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const id = normalizeDocumentId(req.params.id, 'Product id');
      const doc = await db().collection('products').doc(id).get();
      if (!doc.exists) return res.status(404).json({ message: 'Product not found' });
      if (doc.data()?.brandId !== req.user!.id) return res.status(403).json({ message: 'Not authorized' });

      const updates: Record<string, any> = {};

      if (req.body.name !== undefined) {
        updates.name = normalizeString(req.body.name, { minLength: 2, maxLength: 120 });
      }
      if (req.body.description !== undefined) {
        updates.description = normalizeString(req.body.description, {
          maxLength: 2000,
          allowEmpty: true,
          preserveNewlines: true,
        });
      }
      if (req.body.category !== undefined) {
        const category = normalizeString(req.body.category, { maxLength: 30 });
        if (category && VALID_CATEGORIES.includes(category)) {
          updates.category = category;
        }
      }
      if (req.body.price !== undefined) {
        const price = Number.parseFloat(req.body.price);
        if (Number.isFinite(price) && price >= 1) updates.price = price;
      }
      if (req.body.originalPrice !== undefined) {
        const op = Number.parseFloat(req.body.originalPrice);
        updates.originalPrice = Number.isFinite(op) ? op : null;
      }
      if (req.body.commissionRate !== undefined) {
        const cr = Number.parseFloat(req.body.commissionRate);
        if (Number.isFinite(cr)) updates.commissionRate = cr;
      }
      if (req.body.inventoryCount !== undefined) {
        const ic = Number.parseInt(req.body.inventoryCount, 10);
        if (Number.isFinite(ic)) updates.inventoryCount = ic;
      }
      if (req.body.inStock !== undefined) {
        updates.inStock = req.body.inStock === true || req.body.inStock === 'true';
      }
      if (req.body.productLink !== undefined) {
        updates.productLink = normalizeOptionalUrl(req.body.productLink) || null;
      }
      if (req.body.sku !== undefined) {
        updates.sku = normalizeString(req.body.sku, { maxLength: 60, allowEmpty: true }) || null;
      }

      if (req.file) {
        const bucket = storage();
        const ext = req.file.mimetype.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
        const objectName = `products/${req.user!.id}/${uuidv4()}.${ext}`;
        const file = bucket.file(objectName);
        await file.save(req.file.buffer, {
          resumable: false,
          metadata: { contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000, immutable' },
        });
        await file.makePublic();
        const newImageUrl = `https://storage.googleapis.com/${bucket.name}/${objectName}`;
        updates.imageUrl = newImageUrl;
        updates.images = [newImageUrl];
      }

      updates.updatedAt = new Date().toISOString();

      await doc.ref.update(updates);
      const updatedDoc = await doc.ref.get();
      res.json({ product: { id: updatedDoc.id, ...updatedDoc.data() } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(error instanceof ValidationError ? 400 : 500).json({
        message: error instanceof ValidationError ? message : 'Internal server error',
      });
    }
  }
);

// DELETE /products/:id — brand removes their listing
productsRouter.delete('/:id', authMiddleware, requireRegistered, requireBrand, async (req: Request, res: Response) => {
  try {
    const id = normalizeDocumentId(req.params.id, 'Product id');
    const doc = await db().collection('products').doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: 'Product not found' });
    if (doc.data()?.brandId !== req.user!.id) return res.status(403).json({ message: 'Not authorized' });

    await doc.ref.delete();
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Internal server error',
    });
  }
});
