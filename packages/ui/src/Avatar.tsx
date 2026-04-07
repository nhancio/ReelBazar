import React, { useEffect, useMemo, useState } from 'react';

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

const failedAvatarUrls = new Set<string>();

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const normalizedSrc = useMemo(() => (src || '').trim(), [src]);
  const [imgErrored, setImgErrored] = useState(false);

  useEffect(() => {
    setImgErrored(false);
  }, [normalizedSrc]);

  const shouldUseImage = Boolean(normalizedSrc) && !imgErrored && !failedAvatarUrls.has(normalizedSrc);

  if (shouldUseImage) {
    return (
      <img
        src={normalizedSrc}
        alt={name}
        className={`${sizeMap[size]} rounded-full border-4 border-white object-cover shadow-[0_18px_34px_rgba(134,154,201,0.22)]`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          if (normalizedSrc) failedAvatarUrls.add(normalizedSrc);
          setImgErrored(true);
        }}
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} flex items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-[#f3b1db] via-[#9abaff] to-[#728fea] font-semibold text-white shadow-[0_18px_34px_rgba(134,154,201,0.24)]`}>
      {initials}
    </div>
  );
}
