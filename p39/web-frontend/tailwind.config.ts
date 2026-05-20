import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef7ed",
          100: "#fdecd5",
          200: "#fad5aa",
          300: "#f6b874",
          400: "#f1923e",
          500: "#ed741a",
          600: "#de5a10",
          700: "#b84310",
          800: "#933615",
          900: "#772f15",
        },
        craft: {
          wood: "#8B4513",
          bronze: "#CD7F32",
          silk: "#FFF8DC",
          jade: "#00A86B",
        }
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
