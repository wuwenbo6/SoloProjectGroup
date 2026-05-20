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
          50: '#f5f2f0',
          100: '#e6dfd9',
          200: '#cdbeb4',
          300: '#b39e8e',
          400: '#9a7e68',
          500: '#815e42',
          600: '#674b35',
          700: '#4d3828',
          800: '#33251a',
          900: '#1a120d',
        },
        bamboo: {
          50: '#f0f7f2',
          100: '#d9e8dd',
          200: '#b3d1bb',
          300: '#8eba99',
          400: '#68a377',
          500: '#428c55',
          600: '#357044',
          700: '#285433',
          800: '#1a3822',
          900: '#0d1c11',
        },
        gold: {
          50: '#fff9e6',
          100: '#ffefb3',
          200: '#ffe480',
          300: '#ffd94d',
          400: '#ffcf1a',
          500: '#e6b800',
          600: '#b38f00',
          700: '#806600',
          800: '#4d3d00',
          900: '#1a1400',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}
