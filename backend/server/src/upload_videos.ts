import { initFirebaseAdmin, db } from './utils/firebase';
import fs from 'fs';
import path from 'path';

const sampleLinks = [
  'https://google.com',
  'https://microsoft.com',
  'https://instagram.com',
  'https://chatgpt.com',
  'https://gemini.google.com'
];

async function seedVideos() {
  initFirebaseAdmin();

  const sampleDataDir = path.resolve(__dirname, '../../../sample_data');
  const files = fs.readdirSync(sampleDataDir).filter(f => f.endsWith('.MOV') || f.endsWith('.mp4'));

  if (files.length === 0) {
    console.log('No video files found in sample_data directory');
    return;
  }

  console.log(`Found ${files.length} videos to seed...`);

  // Try to find a valid user to assign these reels to
  const usersSnapshot = await db().collection('users').limit(1).get();
  let creatorId = 'demo-influencer'; // default fallback
  if (!usersSnapshot.empty) {
    creatorId = usersSnapshot.docs[0].id;
  }
  
  console.log(`Assigning videos to creatorId: ${creatorId}`);

  const baseUrl = 'https://rb-app.nhancio.com/videos';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const link = sampleLinks[i % sampleLinks.length];
    
    // We serve the files directly from Netlify's public folder
    const videoUrl = `${baseUrl}/${file}`;
    
    console.log(`Creating database entry for ${videoUrl} with link ${link}...`);

    const now = new Date(Date.now() - i * 1000).toISOString(); // stagger the created times
    const reelData = {
      videoUrl,
      thumbnailUrl: null,
      productLink: link,
      category: ['Men', 'Women', 'Kids'][Math.floor(Math.random() * 3)],
      caption: `Check out this amazing find! ✨`,
      brandTag: 'ReelBazaar Select',
      creatorId: creatorId,
      likesCount: Math.floor(Math.random() * 500) + 100,
      viewsCount: Math.floor(Math.random() * 10000) + 2000,
      savesCount: Math.floor(Math.random() * 100) + 20,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db().collection('reels').add(reelData);
    console.log(`Created reel document ${docRef.id}`);
  }

  console.log('All done!');
  process.exit(0);
}

seedVideos().catch(console.error);