import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#ec4899',
          rose: '#be185d',
        },
      },
    },
  },
  plugins: [],
};

export default config;
