/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#165DFF',
        success: '#00B42A',
        warning: '#FF7D00',
        danger: '#F53F3F',
        dark: '#1D2129',
        'dark-2': '#4E5969',
        'light-bg': '#F2F3F5',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}