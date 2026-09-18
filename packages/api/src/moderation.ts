import { api } from './client';

/** Closed set, mirrored from backend/server/src/routes/moderation.ts. */
export const REPORT_REASONS = [
  'sexual_content',
  'violence',
  'hate_speech',
  'harassment',
  'spam_or_scam',
  'intellectual_property',
  'self_harm',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** Human labels for the report sheet. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  sexual_content: 'Nudity or sexual content',
  violence: 'Violence or dangerous acts',
  hate_speech: 'Hate speech or symbols',
  harassment: 'Bullying or harassment',
  spam_or_scam: 'Spam, scam or misleading',
  intellectual_property: 'Uses my content without permission',
  self_harm: 'Suicide, self-harm or eating disorders',
  other: 'Something else',
};

export interface BlockedUser {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
}

export const moderationApi = {
  report: (input: {
    targetType: 'reel' | 'user';
    targetId: string;
    reason: ReportReason;
    details?: string;
  }) => api.post<{ reported: boolean }>('/moderation/reports', { body: input }),

  /** Toggles: returns the resulting state. */
  toggleBlock: (userId: string) =>
    api.post<{ blocked: boolean }>(`/moderation/blocks/${userId}`),

  getBlocked: () =>
    api.get<{ blockedIds: string[]; users: BlockedUser[] }>('/moderation/blocks'),
};
