/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'indigo-dark': '#1E3A5F',
        'gold-earth': '#B8860B',
        'red-vermilion': '#C41E3A',
        'ink-gray': '#2C2C2C',
        'paper-white': '#F5F0E6',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
