/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f1e6',
          100: '#e9e3d4',
          200: '#d4c9a8',
          300: '#bfaa75',
          400: '#a88c4d',
          500: '#8B4513',
          600: '#7a3d11',
          700: '#5c2d0d',
          800: '#3d1f09',
          900: '#1f1004',
        },
        accent: {
          500: '#C41E3A',
        },
        paper: '#F5F5DC',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
