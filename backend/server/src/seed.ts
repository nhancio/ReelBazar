import { initFirebaseAdmin, db } from './utils/firebase';

initFirebaseAdmin();

async function deleteCollection(collectionName: string) {
  const snapshot = await db().collection(collectionName).get();
  const batch = db().batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  if (snapshot.size > 0) await batch.commit();
}

async function main() {
  console.log('Clearing existing data...');
  await deleteCollection('reelViews');
  await deleteCollection('reelSaves');
  await deleteCollection('reelLikes');
  await deleteCollection('collaborations');
  await deleteCollection('reels');

  await deleteCollection('users');

  console.log('Creating seed data...');
  const now = new Date().toISOString();

  // Create brands
  const brand1Ref = await db().collection('users').add({
    firebaseUid: 'demo-brand-1',
    email: 'streetwear@demo.com',
    name: 'Urban Edge',
    userType: 'brand',
    brandName: 'Urban Edge Streetwear',
    productCategories: ['Men', 'Women'],
    phone: null, gender: null, age: null, avatarUrl: null,
    createdAt: now, updatedAt: now,
  });

  const brand2Ref = await db().collection('users').add({
    firebaseUid: 'demo-brand-2',
    email: 'kidsfashion@demo.com',
    name: 'Tiny Trends',
    userType: 'brand',
    brandName: 'Tiny Trends Kids',
    productCategories: ['Kids'],
    phone: null, gender: null, age: null, avatarUrl: null,
    createdAt: now, updatedAt: now,
  });

  const brand3Ref = await db().collection('users').add({
    firebaseUid: 'demo-brand-3',
    email: 'luxe@demo.com',
    name: 'Luxe Label',
    userType: 'brand',
    brandName: 'Luxe Label',
    productCategories: ['Women'],
    phone: null, gender: null, age: null, avatarUrl: null,
    createdAt: now, updatedAt: now,
  });

  // Create influencers
  const inf1Ref = await db().collection('users').add({
    firebaseUid: 'demo-influencer-1',
    email: 'priya@demo.com',
    name: 'Priya Fashion',
    userType: 'influencer',
    phone: '+91-9876543210',
    gender: 'Female', age: 24,
    brandName: null, productCategories: [], avatarUrl: null,
    createdAt: now, updatedAt: now,
  });

  const inf2Ref = await db().collection('users').add({
    firebaseUid: 'demo-influencer-2',
    email: 'rahul@demo.com',
    name: 'Rahul Style',
    userType: 'influencer',
    phone: '+91-9876543211',
    gender: 'Male', age: 28,
    brandName: null, productCategories: [], avatarUrl: null,
    createdAt: now, updatedAt: now,
  });

  const inf3Ref = await db().collection('users').add({
    firebaseUid: 'demo-influencer-3',
    email: 'sneha@demo.com',
    name: 'Sneha Trends',
    userType: 'influencer',
    phone: '+91-9876543212',
    gender: 'Female', age: 22,
    brandName: null, productCategories: [], avatarUrl: null,
    createdAt: now, updatedAt: now,
  });

  // Create viewer
  await db().collection('users').add({
    firebaseUid: 'demo-viewer-1',
    email: 'viewer@demo.com',
    name: 'Fashion Lover',
    userType: 'viewer',
    phone: null, gender: null, age: null,
    brandName: null, productCategories: [], avatarUrl: null,
    createdAt: now, updatedAt: now,
  });

  // Create sample reels
  const sampleReels = [
    { creatorId: inf1Ref.id, category: 'Women', caption: 'Summer collection vibes! Check out this gorgeous dress', productLink: 'https://example.com/dress-1', brandTag: 'Urban Edge Streetwear', likes: 156, views: 2340, saves: 45 },
    { creatorId: inf2Ref.id, category: 'Men', caption: 'Street style essentials for the modern man', productLink: 'https://example.com/jacket-1', brandTag: 'Urban Edge Streetwear', likes: 89, views: 1200, saves: 23 },
    { creatorId: inf3Ref.id, category: 'Women', caption: 'Luxe evening wear that turns heads', productLink: 'https://example.com/gown-1', brandTag: 'Luxe Label', likes: 234, views: 4500, saves: 78 },
    { creatorId: inf1Ref.id, category: 'Kids', caption: 'Adorable matching sets for your little ones', productLink: 'https://example.com/kids-set-1', brandTag: 'Tiny Trends Kids', likes: 67, views: 890, saves: 12 },
    { creatorId: inf2Ref.id, category: 'Men', caption: 'Casual Friday done right', productLink: 'https://example.com/casual-1', brandTag: 'Urban Edge Streetwear', likes: 145, views: 1890, saves: 34 },
    { creatorId: inf3Ref.id, category: 'Women', caption: 'Workwear that slays', productLink: 'https://example.com/blazer-1', brandTag: 'Luxe Label', likes: 198, views: 3200, saves: 56 },
    { creatorId: brand1Ref.id, category: 'Men', caption: 'New arrivals just dropped!', productLink: 'https://example.com/new-1', brandTag: 'Urban Edge Streetwear', likes: 312, views: 5600, saves: 89 },
    { creatorId: brand3Ref.id, category: 'Women', caption: 'Elegance redefined', productLink: 'https://example.com/luxe-1', brandTag: 'Luxe Label', likes: 445, views: 7800, saves: 123 },
  ];

  for (const reel of sampleReels) {
    await db().collection('reels').add({
      videoUrl: 'https://storage.googleapis.com/demo-reelbazaar.firebasestorage.app/sample-reel.mp4',
      thumbnailUrl: null,
      caption: reel.caption,
      productLink: reel.productLink,
      category: reel.category,
      brandTag: reel.brandTag,
      creatorId: reel.creatorId,
      likesCount: reel.likes,
      viewsCount: reel.views,
      savesCount: reel.saves,
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    });
  }

  console.log('Seed data created successfully!');
  console.log(`  Brands: ${brand1Ref.id}, ${brand2Ref.id}, ${brand3Ref.id}`);
  console.log(`  Influencers: ${inf1Ref.id}, ${inf2Ref.id}, ${inf3Ref.id}`);
  console.log(`  Reels: ${sampleReels.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
