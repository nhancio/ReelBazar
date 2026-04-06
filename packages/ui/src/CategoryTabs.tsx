import React from 'react';
import { CATEGORIES, type Category } from '@reelbazaar/config';

interface CategoryTabsProps {
  active: Category | undefined;
  onChange: (category: Category | undefined) => void;
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto px-1 py-1">
      <button
        onClick={() => onChange(undefined)}
        className={`whitespace-nowrap shrink-0 rounded-full px-5 py-2 text-[15px] font-semibold transition-all backdrop-blur-md ${
          !active
            ? 'bg-white text-black shadow-lg'
            : 'bg-black/30 text-white/80 border border-white/10 hover:bg-black/50 hover:text-white'
        }`}
      >
        All
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`whitespace-nowrap shrink-0 rounded-full px-5 py-2 text-[15px] font-semibold transition-all backdrop-blur-md ${
            active === cat
              ? 'bg-white text-black shadow-lg'
              : 'bg-black/30 text-white/80 border border-white/10 hover:bg-black/50 hover:text-white'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
