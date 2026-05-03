/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Syne", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg: "#050709",
        sf1: "#0c0f14",
        sf2: "#131820",
        sf3: "#1b2333",
        accent: "#f97316",
        cyan: "#22d3ee",
      },
    },
  },
  plugins: [],
};
