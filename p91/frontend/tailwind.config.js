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
          50: '#fef7ee',
          100: '#fdecd8',
          200: '#fad5b0',
          300: '#f6b87d',
          400: '#f19248',
          500: '#ed7424',
          600: '#de5a1a',
          700: '#b84417',
          800: '#93371b',
          900: '#77301a',
        }
      }
    },
  },
  plugins: [],
}
