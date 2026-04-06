const demoReels = [
  {
    creator: 'Priya Fashion',
    caption: 'Summer collection vibes!',
    brand: 'Urban Edge',
    likes: '2.3K',
    category: 'Women',
  },
  {
    creator: 'Rahul Style',
    caption: 'Street style essentials',
    brand: 'Urban Edge',
    likes: '1.2K',
    category: 'Men',
  },
  {
    creator: 'Sneha Trends',
    caption: 'Luxe evening wear',
    brand: 'Luxe Label',
    likes: '4.5K',
    category: 'Women',
  },
  {
    creator: 'Tiny Trends',
    caption: 'Adorable matching sets',
    brand: 'Tiny Trends Kids',
    likes: '890',
    category: 'Kids',
  },
];

export default function DemoReels() {
  return (
    <section id="demo" className="py-24 px-4 bg-gray-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Trending Reels</h2>
          <p className="text-gray-400 mt-4">Preview what's hot on ReelBazaar right now.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {demoReels.map((reel, index) => (
            <div
              key={index}
              className="aspect-[9/16] bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden relative group cursor-pointer border border-gray-800 hover:border-pink-500/50 transition-all"
            >
              {/* Placeholder gradient background */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

              {/* Category badge */}
              <div className="absolute top-3 left-3">
                <span className="px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-400 text-xs font-medium border border-pink-500/30">
                  {reel.category}
                </span>
              </div>

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white font-semibold text-sm">@{reel.creator}</p>
                <p className="text-pink-400 text-xs mt-0.5">{reel.brand}</p>
                <p className="text-gray-300 text-xs mt-1 line-clamp-1">{reel.caption}</p>
                <div className="flex items-center gap-1 mt-2">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="text-gray-400 text-xs">{reel.likes}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
