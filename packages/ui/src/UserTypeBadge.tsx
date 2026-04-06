import React from 'react';
import type { UserType } from '@reelbazaar/config';

const badgeStyles: Record<UserType, string> = {
  influencer: 'bg-[#f6e7f7] text-[#8e73c9] border-[#d5c5f4]',
  viewer: 'bg-[#e8f2ff] text-[#5f91dd] border-[#c8dbfb]',
  brand: 'bg-[#fff1dd] text-[#d3943c] border-[#f4d6ac]',
};

const badgeLabels: Record<UserType, string> = {
  influencer: 'Influencer',
  viewer: 'Viewer',
  brand: 'Brand',
};

export function UserTypeBadge({ type }: { type: UserType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-[0_8px_18px_rgba(146,158,195,0.08)] ${badgeStyles[type]}`}>
      {badgeLabels[type]}
    </span>
  );
}
