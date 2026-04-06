const roles = [
  {
    title: 'Join as Influencer',
    description: 'Create fashion reels, collaborate with brands, and earn from your content.',
    href: '/app?role=influencer',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    title: 'Join as Brand',
    description: 'Promote your products through authentic influencer partnerships.',
    href: '/app?role=brand',
    gradient: 'from-purple-500 to-violet-500',
  },
  {
    title: 'Start Shopping',
    description: 'Discover the latest trends and shop directly from fashion reels.',
    href: '/app?role=viewer',
    gradient: 'from-amber-500 to-orange-500',
  },
];

export default function CTASection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to Get Started?</h2>
          <p className="text-gray-400 mt-4">Choose your path and join the fashion revolution.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((role, index) => (
            <a
              key={index}
              href={role.href}
              className="group block bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-gray-600 transition-all hover:-translate-y-1"
            >
              <div className={`w-full h-1.5 rounded-full bg-gradient-to-r ${role.gradient} mb-6`} />
              <h3 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">
                {role.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">{role.description}</p>
              <div className="mt-6 flex items-center gap-2 text-pink-400 font-medium text-sm">
                Get Started
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
