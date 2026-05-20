/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'daw-bg': '#0d0d1a',
        'daw-bg-light': '#1a1a2e',
        'daw-bg-lighter': '#252542',
        'daw-accent': '#00f5d4',
        'daw-accent-hover': '#00e0c0',
        'daw-warning': '#ff6b6b',
        'daw-warning-hover': '#ff5252',
        'daw-track-1': '#4ecdc4',
        'daw-track-2': '#45b7d1',
        'daw-track-3': '#96ceb4',
        'daw-track-4': '#ffeaa7',
        'daw-track-5': '#dfe6e9',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00f5d4, 0 0 10px #00f5d4' },
          '100%': { boxShadow: '0 0 10px #00f5d4, 0 0 20px #00f5d4, 0 0 30px #00f5d4' },
        }
      }
    },
  },
  plugins: [],
}
