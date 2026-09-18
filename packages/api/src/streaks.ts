import { api } from './client';

export const streaksApi = {
  checkin: () =>
    api.post<{
      streakCount: number;
      longestStreak: number;
      lastCheckinDate: string;
      alreadyCheckedIn: boolean;
      isNewRecord?: boolean;
    }>('/streaks/checkin'),

  getMe: () =>
    api.get<{
      streakCount: number;
      longestStreak: number;
      lastCheckinDate: string | null;
      checkedInToday: boolean;
    }>('/streaks/me'),
};
