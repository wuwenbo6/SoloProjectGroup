import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#C41E3A',
        secondary: '#D4AF37',
        folk: {
          red: '#C41E3A',
          gold: '#D4AF37',
          brown: '#8B4513',
          cream: '#FFF8DC'
        }
      }
    },
  },
  plugins: [],
}
export default config
