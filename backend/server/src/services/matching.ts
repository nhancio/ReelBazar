import { db } from '../utils/firebase';

interface UserData {
  id: string;
  name?: string;
  userType?: string;
  gender?: string | null;
  age?: number | null;
  brandName?: string | null;
  avatarUrl?: string | null;
  productCategories?: string[];
  [key: string]: unknown;
}

interface ScoredMatch {
  userId: string;
  score: number;
}

function getAgeGroup(age: number | null | undefined): string {
  if (!age) return 'unknown';
  if (age < 18) return '13-17';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  return '45+';
}

function genderToCategory(gender: string | null | undefined): string[] {
  if (!gender) return ['Men', 'Women'];
  if (gender === 'Male') return ['Men'];
  if (gender === 'Female') return ['Women'];
  return ['Men', 'Women'];
}

function calculateMatchScore(brand: UserData, influencer: UserData): number {
  let score = 0;

  // Category overlap (0-40 points)
  const brandCategories: string[] = brand.productCategories || [];
  const influencerCategories = genderToCategory(influencer.gender);
  const categoryOverlap = brandCategories.filter((c: string) => influencerCategories.includes(c));
  score += (categoryOverlap.length / Math.max(brandCategories.length, 1)) * 40;

  // Age group relevance (0-30 points)
  const ageGroup = getAgeGroup(influencer.age);
  const ageScores: Record<string, number> = {
    '18-24': 30, '25-34': 25, '13-17': 20, '35-44': 15, '45+': 10, unknown: 15,
  };
  score += ageScores[ageGroup] || 15;

  // Gender match bonus (0-20 points)
  if (brandCategories.length > 0) {
    const genderCats = genderToCategory(influencer.gender);
    const genderMatch = brandCategories.some((c: string) => genderCats.includes(c));
    if (genderMatch) score += 20;
  } else {
    score += 10;
  }

  // Base compatibility
  score += 10;

  return Math.min(score, 100);
}

export async function generateCollaborationSuggestions(currentUser: UserData) {
  return [];
}
