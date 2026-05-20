/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a56db',
        secondary: '#7e3af2',
        accent: '#0694a2',
        dark: '#1f2937',
        light: '#f9fafb',
      },
    },
  },
  plugins: [],
}
