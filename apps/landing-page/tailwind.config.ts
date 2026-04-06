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
          purple: '#8b5cf6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
