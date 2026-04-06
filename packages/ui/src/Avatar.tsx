import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-10 w-10 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-xl',
};

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeMap[size]} rounded-full border-4 border-white object-cover shadow-[0_18px_34px_rgba(134,154,201,0.22)]`}
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} flex items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-[#f3b1db] via-[#9abaff] to-[#728fea] font-semibold text-white shadow-[0_18px_34px_rgba(134,154,201,0.24)]`}>
      {initials}
    </div>
  );
}
