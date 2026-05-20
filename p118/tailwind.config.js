/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: "#165DFF",
        secondary: "#FF7D00",
        success: "#00B42A",
        danger: "#F53F3F",
        dark: {
          900: "#121417",
          800: "#1D2129",
          700: "#272E3B",
          600: "#4E5969",
        }
      },
    },
  },
  plugins: [],
};
