/**
 * Seed script: adds dummy Brand users and their products to Firestore.
 * Also sets all existing users without a `persona` field to "Creator".
 *
 * Usage:
 *   npx ts-node src/seedBrandsAndProducts.ts
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json
 */
import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!admin.apps.length) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch {
    admin.initializeApp();
  }
}

const db = admin.firestore();

const DUMMY_BRANDS = [
  {
    name: 'StyleVault',
    brandName: 'StyleVault',
    username: 'stylevault',
    email: 'hello@stylevault.com',
    persona: 'Brand' as const,
    websiteLink: 'https://stylevault.com',
    interests: ['Fashion'],
    productCategories: ['Fashion'],
    products: [
      { name: 'Classic White Tee', description: 'Premium cotton crew neck', price: '₹799', productLink: 'https://stylevault.com/white-tee', imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400' },
      { name: 'Slim Fit Jeans', description: 'Stretch denim, dark wash', price: '₹1,499', productLink: 'https://stylevault.com/slim-jeans', imageUrl: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=400' },
      { name: 'Leather Sneakers', description: 'Handcrafted Italian leather', price: '₹2,999', productLink: 'https://stylevault.com/sneakers', imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400' },
    ],
  },
  {
    name: 'GlowUp Beauty',
    brandName: 'GlowUp Beauty',
    username: 'glowupbeauty',
    email: 'info@glowupbeauty.com',
    persona: 'Brand' as const,
    websiteLink: 'https://glowupbeauty.com',
    interests: ['Beauty'],
    productCategories: ['Beauty'],
    products: [
      { name: 'Hydrating Face Serum', description: 'Vitamin C + Hyaluronic Acid', price: '₹599', productLink: 'https://glowupbeauty.com/serum', imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400' },
      { name: 'Matte Lipstick Set', description: '6 shades, long-lasting formula', price: '₹899', productLink: 'https://glowupbeauty.com/lipstick', imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400' },
      { name: 'SPF 50 Sunscreen', description: 'Lightweight, non-greasy', price: '₹449', productLink: 'https://glowupbeauty.com/sunscreen', imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400' },
    ],
  },
  {
    name: 'TechNova',
    brandName: 'TechNova',
    username: 'technova',
    email: 'support@technova.in',
    persona: 'Brand' as const,
    websiteLink: 'https://technova.in',
    interests: ['Electronics'],
    productCategories: ['Electronics'],
    products: [
      { name: 'Wireless Earbuds Pro', description: 'ANC, 30hr battery, IPX5', price: '₹2,499', productLink: 'https://technova.in/earbuds-pro', imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=400' },
      { name: 'Smart Watch Ultra', description: 'AMOLED, health tracking', price: '₹4,999', productLink: 'https://technova.in/smartwatch', imageUrl: 'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=400' },
      { name: 'Portable Charger 20K', description: '20000mAh, fast charge', price: '₹1,299', productLink: 'https://technova.in/powerbank', imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400' },
    ],
  },
  {
    name: 'UrbanNest',
    brandName: 'UrbanNest',
    username: 'urbannest',
    email: 'hello@urbannest.co',
    persona: 'Brand' as const,
    websiteLink: 'https://urbannest.co',
    interests: ['Lifestyle'],
    productCategories: ['Lifestyle'],
    products: [
      { name: 'Scented Candle Set', description: 'Lavender, Vanilla, Sandalwood', price: '₹699', productLink: 'https://urbannest.co/candles', imageUrl: 'https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=400' },
      { name: 'Minimalist Desk Lamp', description: 'USB-C, 3 brightness levels', price: '₹1,199', productLink: 'https://urbannest.co/desk-lamp', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400' },
    ],
  },
];

async function main() {
  console.log('--- Seeding brands and products ---\n');

  for (const brand of DUMMY_BRANDS) {
    const { products, ...userData } = brand;
    const now = new Date().toISOString();

    const existing = await db.collection('users').where('username', '==', userData.username).limit(1).get();
    let brandDocId: string;

    if (!existing.empty) {
      brandDocId = existing.docs[0].id;
      await db.collection('users').doc(brandDocId).update({ ...userData, updatedAt: now });
      console.log(`Updated existing brand: ${userData.brandName} (${brandDocId})`);
    } else {
      const ref = db.collection('users').doc();
      brandDocId = ref.id;
      await ref.set({
        ...userData,
        firebaseUid: brandDocId,
        avatarUrl: null,
        followersCount: 0,
        followingCount: 0,
        themePreference: 'dark',
        createdAt: now,
        updatedAt: now,
      });
      console.log(`Created brand: ${userData.brandName} (${brandDocId})`);
    }

    for (const product of products) {
      const prodRef = db.collection('brandProducts').doc();
      await prodRef.set({
        ...product,
        brandId: brandDocId,
        createdAt: now,
      });
      console.log(`  + Product: ${product.name}`);
    }
  }

  console.log('\n--- Setting existing users without persona to "Creator" ---\n');

  const allUsers = await db.collection('users').get();
  let updated = 0;
  for (const userDoc of allUsers.docs) {
    const data = userDoc.data();
    if (!data.persona) {
      await db.collection('users').doc(userDoc.id).update({ persona: 'Creator' });
      console.log(`Set persona=Creator for: ${data.username || data.name || userDoc.id}`);
      updated++;
    }
  }
  console.log(`\nUpdated ${updated} existing users to Creator persona.`);
  console.log('\nDone! Brands and products seeded successfully.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
