export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-16 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-gray-950 to-purple-600/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />

      <div className="relative text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-pink-400 text-sm font-medium uppercase tracking-wider">scroll, tap, shop</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
          Shop What{' '}
          <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Influencers
          </span>
          {' '}Wear
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed italic">
          "scroll, tap, shop"
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/app"
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-semibold text-lg hover:shadow-xl hover:shadow-pink-500/25 transition-all hover:-translate-y-0.5"
          >
            Start Shopping
          </a>
          <a
            href="#how-it-works"
            className="px-8 py-4 border-2 border-gray-700 text-gray-300 rounded-2xl font-semibold text-lg hover:border-pink-500 hover:text-pink-400 transition-all"
          >
            Learn More
          </a>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto">
          <div>
            <p className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">10K+</p>
            <p className="text-gray-500 text-sm mt-1">Influencers</p>
          </div>
          <div>
            <p className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">500+</p>
            <p className="text-gray-500 text-sm mt-1">Brands</p>
          </div>
          <div>
            <p className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">1M+</p>
            <p className="text-gray-500 text-sm mt-1">Reels</p>
          </div>
        </div>
      </div>
    </section>
  );
}
