import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#f5b301",
          dark: "#0b1f32",
          accent: "#5977ff"
        }
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
