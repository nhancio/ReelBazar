import { api } from './client';
import type { Collaboration } from '@reelbazaar/config';

export const collaborationsApi = {
  getSuggestions: () =>
    api.get<{ collaborations: Collaboration[] }>('/collaborations/suggestions'),

  respond: (id: string, status: 'accepted' | 'declined') =>
    api.patch<{ collaboration: Collaboration }>(`/collaborations/${id}`, { body: { status } }),

  getMyCollaborations: () =>
    api.get<{ collaborations: Collaboration[] }>('/collaborations'),
};
